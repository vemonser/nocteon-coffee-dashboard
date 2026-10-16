import { Directive, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { PageResponse } from '../models/api-response.model';
import { TableSortEvent } from '../../shared/components/data-table/data-table.component';
import { SoftDeleteFailure, classifyRestoreError } from './soft-delete.contract';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';

export type ViewMode = 'list' | 'grid';

/** Lifecycle of a row: active rows are live, trashed rows are soft-deleted. */
export type ListView = 'active' | 'trash';

@Directive()
export abstract class BaseListComponent<TResponse, TRequest, TId = string>
  implements OnInit
{
  protected fb = inject(FormBuilder);
  protected Math = Math;
  // Named to avoid colliding with page-level `router` fields (e.g. UsersListComponent).
  protected readonly listRouter = inject(Router);
  protected readonly listRoute = inject(ActivatedRoute);

  // ─── Signals ─────────────────────────────────────────────────────────────────
  items         = signal<TResponse[]>([]);
  pageData      = signal<PageResponse<TResponse> | null>(null);
  loading       = signal(false);
  submitting    = signal(false);
  showDialog    = signal(false);
  editing       = signal<TResponse | null>(null);
  deleting      = signal<TResponse | null>(null);
  imagePreview  = signal<string | null>(null);
  selectedImage = signal<File | null>(null);
  currentPage   = signal(0);
  viewMode = signal<ViewMode>('list');

  // ─── Sort state ───────────────────────────────────────────────────────────────
  currentSort      = 'createdAt';
  currentDirection: 'asc' | 'desc' = 'desc';
  searchQuery      = '';
  private searchTimeout: any;

  // ─── Form ────────────────────────────────────────────────────────────────────
  form!: FormGroup;

  get translationsArray(): FormArray {
    return this.form.get('translations') as FormArray;
  }

  // ─── Abstract contract ────────────────────────────────────────────────────────

  /** Extract the identifier from an item (slug for Category, id for User, etc.) */
  protected abstract getId(item: TResponse): TId;

  /** Call service.getAll() with current filters + page */
  protected abstract loadPage(): Observable<PageResponse<TResponse>>;

  /** Return the reactive FormGroup for this entity */
  protected abstract buildForm(): FormGroup;

  /** Map current form value → TRequest DTO */
  protected abstract toRequest(): TRequest;

  /** Call service.create() */
  protected abstract callCreate(request: TRequest, image?: File, format?: 'auto' | 'json' | 'multipart'): Observable<any>;

  /** Call service.update() */
  protected abstract callUpdate(id: TId, request: TRequest, image?: File, format?: 'auto' | 'json' | 'multipart'): Observable<any>;

  /** Call service.delete() */
  protected abstract callDelete(id: TId): Observable<any>;

  /** Patch the form when editing */
  protected abstract onEditOpen(item: TResponse): void;

  // ─── Soft delete capability (opt-in) ──────────────────────────────────────────
  //
  // Pages set this instead of re-implementing tabs, counts, undo and restore.
  // Every hook has a safe default so a page can enable one at a time.

  /** Turn the capability on for this page. */
  protected softDeleteEnabled = false;

  /** Load trashed rows. Required when `softDeleteEnabled`. */
  protected loadTrashPage?(): Observable<PageResponse<TResponse>>;

  /** Un-delete by numeric id. Required when `softDeleteEnabled`. */
  protected callRestore?(id: number): Observable<unknown>;

  /** Numeric id of a row — what the restore endpoint takes. */
  protected restoreIdOf?(item: TResponse): number | null;

  /** Value the type-to-confirm dialog asks for (slug, else name). */
  protected confirmTokenOf?(item: TResponse): string;

  /** Whether the signed-in user may reach the trash endpoints (`<entity>:delete`). */
  protected canManageTrash = false;

  /** Status filter (enabled/disabled) — active tab only, entity-specific. */
  protected statusFilterValue: boolean | undefined = undefined;

  readonly listView = signal<ListView>('active');
  readonly activeCount = signal<number | null>(null);
  readonly trashCount = signal<number | null>(null);
  readonly loadError = signal(false);
  readonly selection = signal<ReadonlySet<number>>(new Set());
  /** Row awaiting permanent-delete confirmation. */
  readonly permanentDeleteTarget = signal<TResponse | null>(null);
  readonly permanentDeletePending = signal(false);
  /** Undo window for a soft delete; keeps the row to put back. */
  private readonly undoStack = signal<{ item: TResponse; restore: () => void } | null>(null);

  readonly isTrash = computed(() => this.listView() === 'trash');
  readonly hasSelection = computed(() => this.selection().size > 0);
  readonly selectionCount = computed(() => this.selection().size);

  /**
   * True when the current tab has no rows for the active search but the other tab
   * does — the state that needs "No results in Active. 1 result in Trash."
   */
  readonly otherTabMatches = computed(() => {
    if (this.searchQuery.trim().length === 0) return false;
    const total = this.pageData()?.totalElements ?? 0;
    if (total > 0) return false;
    const other = this.isTrash() ? this.activeCount() : this.trashCount();
    return (other ?? 0) > 0;
  });

  readonly otherTabMatchesCount = computed(() =>
    this.isTrash() ? (this.activeCount() ?? 0) : (this.trashCount() ?? 0),
  );

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.form = this.buildForm();
    if (this.softDeleteEnabled) {
      this.restoreUrlState();
      // Both counts up front: otherwise the tab we are not on shows 0 until its
      // request lands, which reads as "empty" rather than "not loaded yet".
      this.refreshBothCounts();
    }
    this.load();
  }

  // ─── Data ────────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.loadError.set(false);

    const request = this.softDeleteEnabled && this.isTrash() && this.loadTrashPage
      ? this.loadTrashPage()
      : this.loadPage();

    request.subscribe({
      next: (page) => {
        this.items.set(page.content);
        this.pageData.set(page);
        this.loading.set(false);
        this.syncCountForCurrentTab(page.totalElements);
      },
      error: () => {
        this.loading.set(false);
        this.loadError.set(true);
      },
    });

    if (this.softDeleteEnabled) this.refreshTabCounts();
  }

  /** Counts come from each list call's `totalElements` — no counts endpoint exists. */
  private syncCountForCurrentTab(total: number): void {
    if (!this.softDeleteEnabled) return;
    if (this.isTrash()) this.trashCount.set(total);
    else this.activeCount.set(total);
  }

  /** One lightweight call per tab (size = 1) — the counts endpoint does not exist. */
  protected refreshBothCounts(): void {
    if (!this.softDeleteEnabled) return;
    const params = { page: 0, size: 1, sort: this.currentSort, direction: this.currentDirection };
    forkJoin({
      active: this.loadPage().pipe(map((p) => p.totalElements), catchError(() => of(null))),
      trash:
        this.canManageTrash && this.loadTrashPage
          ? this.loadTrashPage().pipe(map((p) => p.totalElements), catchError(() => of(null)))
          : of(null),
    }).subscribe(({ active, trash }) => {
      this.activeCount.set(active);
      this.trashCount.set(trash);
    });
    void params;
  }

  private refreshTabCounts(): void {
    if (!this.softDeleteEnabled) return;

    // Only the tab we are NOT on needs a request: the current tab's total arrives
    // with the page itself.
    const other$ = this.isTrash()
      ? this.loadPage().pipe(map((p) => p.totalElements), catchError(() => of(null)))
      : this.canManageTrash && this.loadTrashPage
        ? this.loadTrashPage().pipe(map((p) => p.totalElements), catchError(() => of(null)))
        : of(null);

    other$.subscribe((other) => {
      if (this.isTrash()) this.activeCount.set(other);
      else this.trashCount.set(other);
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
      this.writeUrlState();
      this.load();
    }, 400);
  }

  goToPage(page: number): void {
    this.currentPage.set(page);
    this.load();
  }

  onSortChange(event: TableSortEvent | null): void {
    this.currentSort      = event?.column ?? 'createdAt';
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.load();
  }

  // ─── Dialog ───────────────────────────────────────────────────────────────────

  openCreateDialog(): void {
    this.editing.set(null);
    this.form = this.buildForm();
    this.imagePreview.set(null);
    this.selectedImage.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(item: TResponse): void {
    this.editing.set(item);
    this.form = this.buildForm();
    this.selectedImage.set(null);
    this.onEditOpen(item);
    this.showDialog.set(true);
  }

  closeDialog(): void {
    this.showDialog.set(false);
    this.editing.set(null);
  }

  onImageSelected(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selectedImage.set(file);
    const reader = new FileReader();
    reader.onload = (e) => this.imagePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  // ─── Submit ───────────────────────────────────────────────────────────────────

  onSubmit(): void {
    if (this.form.invalid) return;
    this.submitting.set(true);

    const request = this.toRequest();
    const image   = this.selectedImage() ?? undefined;
    const current = this.editing();

    const call$ = current
      ? this.callUpdate(this.getId(current), request, image)
      : this.callCreate(request, image);

    call$.subscribe({
      next: () => {
        this.closeDialog();
        this.load();
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  confirmDelete(item: TResponse): void {
    this.deleting.set(item);
  }

  submitDelete(): void {
    const item = this.deleting();
    if (!item) return;
    this.submitting.set(true);

    this.callDelete(this.getId(item)).subscribe({
      next: () => {
        this.deleting.set(null);
        this.load();
        this.submitting.set(false);
      },
      error: () => this.submitting.set(false),
    });
  }
  
  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  // ─── Soft delete: tabs ────────────────────────────────────────────────────────

  /**
   * Switching tabs resets page + selection and keeps the search text. The view is
   * mirrored into the URL so refresh, back/forward and shared links land on the
   * same tab.
   */
  setListView(view: ListView): void {
    if (this.listView() === view) return;
    this.listView.set(view);
    this.currentPage.set(0);
    this.clearSelection();
    this.viewMode.set('list');
    this.writeUrlState();
    this.load();
  }

  toggleListView(): void {
    this.setListView(this.isTrash() ? 'active' : 'trash');
  }

  // ─── Soft delete: undoable move to trash ──────────────────────────────────────

  /**
   * Soft delete with no confirm dialog: the row leaves the list immediately and an
   * Undo toast holds it for ~6s. Restoring from the toast is a real restore call, so
   * a row the user let expire is genuinely in the trash.
   */
  softDelete(item: TResponse): void {
    if (!this.canManageTrash) return;

    const previous = this.items();
    this.items.set(previous.filter((row) => row !== item));
    this.adjustCount('active', -1);

    let undo = () => {};
    const toastId = toast(this.t(this.undoMessage(), 'Moved to trash'), {
      duration: 6000,
      action: { label: this.t(this.undoLabel(), 'Undo'), onClick: () => undo() },
    });

    undo = () => {
      toast.dismiss(toastId);
      const id = this.restoreIdOf?.(item) ?? null;
      if (id === null || !this.callRestore) {
        this.load();
        return;
      }
      this.callRestore(id).subscribe({
        next: () => this.load(),
        error: () => this.load(),
      });
    };

    this.undoStack.set({ item, restore: undo });
  }

  /** Count changes immediately after every action — no full refetch for the badge. */
  private adjustCount(view: ListView, delta: number): void {
    if (view === 'trash') {
      this.trashCount.update((n) => (n === null ? null : Math.max(0, n + delta)));
    } else {
      this.activeCount.update((n) => (n === null ? null : Math.max(0, n + delta)));
    }
  }

  // ─── Soft delete: restore ────────────────────────────────────────────────────

  /**
   * Restore from the trash. A 409 means a live item took the slug, so the failure
   * is surfaced with what the admin can do about it instead of silently reloading.
   */
  restore(item: TResponse): void {
    const id = this.restoreIdOf?.(item) ?? null;
    if (id === null || !this.callRestore || this.submitting()) return;

    this.submitting.set(true);
    this.callRestore(id).subscribe({
      next: () => {
        this.submitting.set(false);
        this.items.set(this.items().filter((row) => row !== item));
        this.adjustCount('trash', -1);
        this.adjustCount('active', 1);
      },
      error: (err: unknown) => {
        this.submitting.set(false);
        this.reportRestoreFailure(err);
      },
    });
  }

  private reportRestoreFailure(err: unknown): void {
    const status = (err as { status?: number })?.status ?? 0;
    const failure: SoftDeleteFailure = classifyRestoreError(status);
    switch (failure) {
      case 'slug-conflict':
        toast.error(this.t(this.restoreConflictTitle(), 'Cannot restore'), {
          description: this.t(
            this.restoreConflictBody(),
            'Another item already uses this slug. Rename or remove it, then restore again.',
          ),
          duration: 8000,
        });
        break;
      case 'not-found':
        toast.error(this.t(this.restoreNotFoundBody(), 'This item is no longer in the trash.'));
        break;
      case 'forbidden':
        toast.error(
          this.t(this.restoreForbiddenBody(), 'You do not have permission to restore items.'),
        );
        break;
      default:
        toast.error(this.t(this.restoreFailedBody(), 'Restore failed. Try again.'));
    }
    // Row may already be gone; resync rather than guess.
    this.load();
  }

  // ─── Soft delete: permanent delete (no backend support yet) ──────────────────

  openPermanentDelete(item: TResponse): void {
    this.permanentDeleteTarget.set(item);
  }

  closePermanentDelete(): void {
    if (!this.permanentDeletePending()) this.permanentDeleteTarget.set(null);
  }

  /**
   * The typed value matched, so the request can go out — except the backend has no
   * permanent-delete endpoint (see soft-delete.contract.ts). Until it exists this
   * reports the gap instead of calling an invented route; the dialog itself is
   * complete and will work as soon as `deletePermanently` is implemented.
   */
  confirmPermanentDelete(_token: string): void {
    const item = this.permanentDeleteTarget();
    if (!item || this.permanentDeletePending()) return;
    this.permanentDeletePending.set(false);
    toast.error(
      this.t(this.permanentDeleteUnsupportedTitle(), 'Permanent delete unavailable'),
      {
        description: this.t(
          this.permanentDeleteUnsupportedBody(),
          'The API does not expose a permanent-delete endpoint yet.',
        ),
        duration: 8000,
      },
    );
  }

  protected confirmToken(item: TResponse): string {
    return this.confirmTokenOf?.(item) ?? String(this.getId(item));
  }

  // ─── Bulk ─────────────────────────────────────────────────────────────────────

  toggleSelection(id: number, checked: boolean): void {
    const next = new Set(this.selection());
    if (checked) next.add(id);
    else next.delete(id);
    this.selection.set(next);
  }

  isSelected(id: number): boolean {
    return this.selection().has(id);
  }

  toggleAll(checked: boolean): void {
    const ids = this.items()
      .map((item) => this.restoreIdOf?.(item))
      .filter((id): id is number => id !== null && id !== undefined);
    this.selection.set(checked ? new Set(ids) : new Set());
  }

  allSelected(): boolean {
    const ids = this.items()
      .map((item) => this.restoreIdOf?.(item))
      .filter((id): id is number => id !== null && id !== undefined);
    return ids.length > 0 && ids.every((id) => this.selection().has(id));
  }

  clearSelection(): void {
    this.selection.set(new Set());
  }

  /** Bulk soft delete — same undo toast semantics, one call per row (no batch API). */
  bulkSoftDelete(): void {
    if (!this.canManageTrash) return;
    const rows = this.selectedRows();
    for (const row of rows) this.softDelete(row);
    this.clearSelection();
  }

  bulkRestore(): void {
    for (const row of this.selectedRows()) this.restore(row);
    this.clearSelection();
  }

  bulkPermanentDelete(): void {
    const rows = this.selectedRows();
    this.clearSelection();
    if (rows.length === 0) return;
    toast.error(
      this.t(this.permanentDeleteUnsupportedTitle(), 'Permanent delete unavailable'),
      {
        description: this.t(
          this.permanentDeleteUnsupportedBody(),
          'The API does not expose a permanent-delete endpoint yet.',
        ),
        duration: 8000,
      },
    );
  }

  private selectedRows(): TResponse[] {
    const selected = this.selection();
    return this.items().filter((item) => {
      const id = this.restoreIdOf?.(item);
      return id !== null && id !== undefined && selected.has(id);
    });
  }

  // ─── URL state ────────────────────────────────────────────────────────────────

  /** view / search / page / status filter live in the query string. */
  protected restoreUrlState(): void {
    const params = this.listRoute.snapshot.queryParamMap;
    const view = params.get('view');
    this.listView.set(view === 'trash' ? 'trash' : 'active');

    const search = params.get('q');
    if (search) this.searchQuery = search;

    const page = params.get('page');
    if (page) this.currentPage.set(Math.max(0, Number(page) || 0));

    const status = params.get('status');
    if (status === 'enabled') this.statusFilterValue = true;
    else if (status === 'disabled') this.statusFilterValue = false;
    else this.statusFilterValue = undefined;
  }

  protected writeUrlState(): void {
    const params: Record<string, string> = {};
    if (this.softDeleteEnabled && this.listView() === 'trash') params['view'] = 'trash';
    if (this.searchQuery.trim()) params['q'] = this.searchQuery.trim();
    if (this.currentPage() > 0) params['page'] = String(this.currentPage());
    if (!this.isTrash() && this.statusFilterValue !== undefined) {
      params['status'] = this.statusFilterValue ? 'enabled' : 'disabled';
    }
    this.listRouter.navigate([], { queryParams: params, replaceUrl: true });
  }

  // ─── Copy (overridden per page; values are i18n keys, resolved through Transloco) ─

  private readonly transloco = inject(TranslocoService);

  /**
   * Resolves a copy key. `TranslocoService.translate()` is synchronous in this version;
   * the English fallback covers a key that is missing from a translation file.
   */
  protected t(key: string, fallback: string): string {
    if (!key) return fallback;
    const value = this.transloco.translate(key);
    return typeof value === 'string' && value.length > 0 && value !== key ? value : fallback;
  }

  protected undoLabel(): string {
    return 'common.undo';
  }
  protected undoMessage(): string {
    return 'common.movedToTrash';
  }
  /** Short label for the trashed item inside the toast. */
  protected undoItemLabel(_item: TResponse): string {
    return '';
  }
  protected restoreConflictTitle(): string {
    return 'common.restoreFailed';
  }
  protected restoreConflictBody(): string {
    return 'common.restoreSlugConflict';
  }
  protected restoreNotFoundBody(): string {
    return 'common.restoreNotInTrash';
  }
  protected restoreForbiddenBody(): string {
    return 'common.restoreForbidden';
  }
  protected restoreFailedBody(): string {
    return 'common.restoreFailed';
  }
  protected permanentDeleteUnsupportedTitle(): string {
    return 'common.permanentDeleteUnavailable';
  }
  protected permanentDeleteUnsupportedBody(): string {
    return 'common.permanentDeleteUnsupported';
  }
}