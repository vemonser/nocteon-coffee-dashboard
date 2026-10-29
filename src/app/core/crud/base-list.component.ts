import { Directive, OnInit, computed, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';
import { ActivatedRoute, Router } from '@angular/router';
import { PageResponse } from '../models/api-response.model';
import { TableSortEvent } from '../../shared/components/data-table/data-table.component';
import { SoftDeleteFailure, classifyRestoreError } from './soft-delete.contract';
import { NotifyService } from '../notify/notify.service';
import { TranslocoService } from '@jsverse/transloco';
import { toast } from '@spartan-ng/brain/sonner';
import { PermissionService } from '../auth/permission.service';

export type ViewMode = 'list' | 'grid';

/** Lifecycle of a row: active rows are live, trashed rows are soft-deleted. */
export type ListView = 'active' | 'trash';

/** Progress of an Active <-> Trash swap: idle, animating out, animating in. */
export type ViewPhase = 'idle' | 'out' | 'in';

/** Animation names the host stylesheets own (see `styles/index.css`). */
const VIEW_OUT_ANIMATION = 'lifecycle-view-out';
const VIEW_IN_ANIMATION = 'lifecycle-view-in';

/**
 * Backstop only: if the out animation never reports back (animations disabled by
 * something `prefers-reduced-motion` cannot see) the swap must still happen. Not
 * the real duration — that lives in CSS.
 */
const VIEW_SWITCH_FALLBACK_MS = 700;

@Directive()
export abstract class BaseListComponent<TResponse, TRequest, TId = string>
  implements OnInit
{
  protected readonly notify = inject(NotifyService);
  protected fb = inject(FormBuilder);
  protected readonly permissionService = inject(PermissionService);
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

  /**
   * Rows per page. The pager's per-page select feeds this and the concrete
   * `loadPage()` implementations pass it to the backend as `size`.
   * Default 20 (project convention); SQLite-backed endpoints cap similarly.
   */
  readonly pageSize = signal(20);

  /** Choices for the pager's per-page select. */
  readonly pageSizeOptions = [10, 20, 50] as const;
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

  /**
   * Permission slugs gating the create/update/delete actions for this entity.
   * `null` means "not gated" (allowed) so pages that do not set them keep the
   * previous behaviour. Subclasses set these to the relevant `entity:*` slugs.
   */
  protected createPermission: string | null = null;
  protected updatePermission: string | null = null;
  protected deletePermission: string | null = null;

  readonly canCreate = computed(() =>
    this.createPermission ? this.permissionService.has(this.createPermission) : true,
  );
  readonly canUpdate = computed(() =>
    this.updatePermission ? this.permissionService.has(this.updatePermission) : true,
  );
  readonly canDelete = computed(() =>
    this.deletePermission ? this.permissionService.has(this.deletePermission) : true,
  );

  /** Status filter (enabled/disabled) — active tab only, entity-specific. */
  protected statusFilterValue: boolean | undefined = undefined;

  /**
   * How a row is edited. `'dialog'` (the default) opens the shared create/edit
   * dialog; `'page'` navigates to the row's own detail page instead. Lists that
   * keep their detail page as the single edit surface set `'page'` and override
   * `goToDetail()`. The dialog path is never removed — it stays the default.
   */
  protected editMode: 'dialog' | 'page' = 'dialog';

  readonly listView = signal<ListView>('active');
  readonly activeCount = signal<number | null>(null);
  readonly trashCount = signal<number | null>(null);
  readonly loadError = signal(false);
  readonly selection = signal<ReadonlySet<number>>(new Set());
  /** Row awaiting permanent-delete confirmation. */
  readonly permanentDeleteTarget = signal<TResponse | null>(null);
  readonly permanentDeletePending = signal(false);
  /** Pending bulk action behind a confirm dialog: 'trash' | 'permanent' | none. */
  readonly bulkConfirm = signal<'trash' | 'permanent' | null>(null);
  /** Undo window for a soft delete; keeps the row to put back. */
  private readonly undoStack = signal<{ item: TResponse; restore: () => void } | null>(null);
  /** Ids with an in-flight trash request — blocks double-click double DELETEs. */
  private readonly trashPending = new Set<TId>();

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
    const clamped = Math.max(0, page);
    if (clamped === this.currentPage()) return;
    this.currentPage.set(clamped);
    this.writeUrlState();
    this.load();
  }

  /**
   * Rows-per-page change from the pager select: reset to the first page and
   * reload. Kept in one place so every list behaves identically.
   */
  onPageSizeChange(size: number): void {
    if (size === this.pageSize()) return;
    this.pageSize.set(size);
    this.currentPage.set(0);
    this.writeUrlState();
    this.load();
  }

  onSortChange(event: TableSortEvent | null): void {
    this.currentSort      = event?.column ?? 'createdAt';
    this.currentDirection = event?.direction ?? 'desc';
    this.currentPage.set(0);
    this.writeUrlState();
    this.load();
  }

  // ─── Dialog ───────────────────────────────────────────────────────────────────

  /**
   * Inline error for the create/edit dialog — backend messages (a duplicate
   * identifier, a rejected field) rendered ABOVE the submit button so the
   * reason sits where the user is looking, not only in a corner toast.
   * Cleared whenever the dialog opens, closes or is re-submitted.
   */
  readonly dialogError = signal<string | null>(null);

  openCreateDialog(): void {
    this.editing.set(null);
    this.form = this.buildForm();
    this.imagePreview.set(null);
    this.selectedImage.set(null);
    this.dialogError.set(null);
    this.showDialog.set(true);
  }

  openEditDialog(item: TResponse): void {
    this.editing.set(item);
    this.form = this.buildForm();
    this.selectedImage.set(null);
    this.onEditOpen(item);
    this.dialogError.set(null);
    this.showDialog.set(true);
  }

  /**
   * Entry point for a row's edit action. With `editMode === 'page'` this hands
   * off to `goToDetail()`; otherwise it opens the shared dialog. Kept in one
   * place so every list routes its edit action identically.
   */
  protected onEditAction(item: TResponse): void {
    if (this.editMode === 'page') {
      this.goToDetail(item);
      return;
    }
    this.openEditDialog(item);
  }

  /**
   * Navigate to a row's detail page. No-op by default — a list opts in by
   * overriding it (Categories routes by slug; trash rows stay inert because a
   * trashed entity has no reachable detail page).
   */
  protected goToDetail(_item: TResponse): void {}

  /** Navigate after a successful create. No-op by default. */
  protected afterCreate(_item: TResponse): void {}

  closeDialog(): void {
    this.showDialog.set(false);
    this.editing.set(null);
    this.imagePreview.set(null);
    this.selectedImage.set(null);
    this.dialogError.set(null);
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
    if (this.form.invalid) {
      // Show inline errors and focus the first invalid control.
      this.form.markAllAsTouched();
      const firstInvalid = this._firstInvalidControl(this.form.controls);
      if (firstInvalid) {
        firstInvalid.focus();
      }
      // Also state the block reason above the submit button — the focused
      // field may sit outside the visible part of a long dialog.
      this.dialogError.set(this.t('common.fixErrors', 'Please fix the highlighted fields to continue.'));
      return;
    }
    this.dialogError.set(null);
    this.submitting.set(true);

    const request = this.toRequest();
    const image   = this.selectedImage() ?? undefined;
    const current = this.editing();

    const call$ = current
      ? this.callUpdate(this.getId(current), request, image)
      : this.callCreate(request, image);

    const wasEditing = !!current;

    call$.subscribe({
      next: (res) => {
        this.closeDialog();
        this.load();
        this.submitting.set(false);
        // Page-edit lists go straight to the new entity's detail page.
        if (!wasEditing) {
          const created = (res as { data?: TResponse } | null)?.data;
          if (created) this.afterCreate(created);
        }
        this.notify.success(
          wasEditing ? 'notify.updated' : 'notify.created',
          wasEditing ? 'Updated successfully' : 'Created successfully',
        );
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = this.notify.backendMessage(err) ?? this.notify.t('notify.errorFallback', 'Something went wrong. Please try again.');
        this.dialogError.set(msg);
        this.notify.apiError(err, 'notify.errorFallback', 'Something went wrong. Please try again.');
      },
    });
  }

  /** Walk form controls and return the first one that is invalid + touched. */
  private _firstInvalidControl(controls: { [key: string]: unknown }): { focus(): void } | null {
    for (const key of Object.keys(controls)) {
      const control = controls[key];
      if (typeof control === 'object' && control !== null && 'invalid' in control && 'touched' in control) {
        const c = control as { invalid: boolean; touched: boolean; focus(): void };
        if (c.invalid && c.touched) {
          return typeof c.focus === 'function' ? c : null;
        }
      }
      if (control && typeof control === 'object' && 'controls' in control) {
        const result = this._firstInvalidControl(
          (control as { controls: { [key: string]: unknown } }).controls,
        );
        if (result) return result;
      }
    }
    return null;
  }

  /**
   * Keys for the confirm-first delete flow. The base toasts "Deleted
   * successfully"; soft-delete lists override this — for them "delete" means
   * "move to trash" and the toast says so.
   */
  protected deleteToastKey(): string {
    return 'notify.deleted';
  }

  protected deleteToastFallback(): string {
    return 'Deleted successfully';
  }

  // ─── Delete ───────────────────────────────────────────────────────────────────

  confirmDelete(item: TResponse): void {
    this.deleting.set(item);
  }

  /** Dialog confirm → the real call. Errors surface the backend's reason. */
  submitDelete(): void {
    const item = this.deleting();
    if (!item) return;
    this.submitting.set(true);

    this.callDelete(this.getId(item)).subscribe({
      next: () => {
        this.deleting.set(null);
        this.load();
        this.submitting.set(false);
        this.notify.success(this.deleteToastKey(), this.deleteToastFallback());
      },
      error: (err) => {
        this.submitting.set(false);
        // Close the dialog either way — the 409 reason ("still used
        // elsewhere") is in the toast; leaving the modal open traps the
        // user in a dead dialog.
        this.deleting.set(null);
        this.notify.apiError(err, 'notify.errorFallback', 'Something went wrong. Please try again.');
      },
    });
  }
  
  toggleView(mode: ViewMode): void {
    this.viewMode.set(mode);
  }

  // ─── Soft delete: tabs ────────────────────────────────────────────────────────

  /**
   * Progress of the Active <-> Trash swap. Hosts paint it on the panel root
   * (`[attr.data-view-phase]`) and mark the parts that change with `.view-fade`,
   * so the swap crosses over instead of cutting.
   */
  readonly viewPhase = signal<ViewPhase>('idle');

  private pendingView: ListView | null = null;
  private viewSwitchTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Switching tabs resets page + selection and keeps the search text. The view is
   * mirrored into the URL so refresh, back/forward and shared links land on the
   * same tab.
   *
   * Active and Trash live on one page, so the swap is faded rather than cut: the
   * region animates out, the state flips, then it animates in. Durations live in
   * CSS (`styles/index.css`); the phase advances on `animationend`, so there is
   * no second copy of them here.
   */
  setListView(view: ListView): void {
    if (this.listView() === view) return;

    if (this.prefersReducedMotion()) {
      this.applyListView(view);
      return;
    }

    // A second switch mid-flight just re-targets: the out animation is already
    // running, so the phase value does not change and the CSS does not restart.
    this.pendingView = view;
    this.viewPhase.set('out');
    this.clearViewSwitchTimer();
    this.viewSwitchTimer = setTimeout(() => this.finishViewSwitch(), VIEW_SWITCH_FALLBACK_MS);
  }

  /** Bind on the panel root: `(animationend)="onViewAnimationEnd($event)"`. */
  onViewAnimationEnd(event: AnimationEvent): void {
    if (event.animationName === VIEW_OUT_ANIMATION) {
      this.finishViewSwitch();
    } else if (event.animationName === VIEW_IN_ANIMATION) {
      this.clearViewSwitchTimer();
      this.viewPhase.set('idle');
    }
  }

  private finishViewSwitch(): void {
    const view = this.pendingView;
    if (!view || this.viewPhase() !== 'out') return;
    this.clearViewSwitchTimer();
    this.pendingView = null;
    this.applyListView(view);
    this.viewPhase.set('in');
  }

  private applyListView(view: ListView): void {
    this.listView.set(view);
    this.currentPage.set(0);
    this.clearSelection();
    this.viewMode.set('list');
    this.writeUrlState();
    this.load();
  }

  private clearViewSwitchTimer(): void {
    if (this.viewSwitchTimer) {
      clearTimeout(this.viewSwitchTimer);
      this.viewSwitchTimer = null;
    }
  }

  private prefersReducedMotion(): boolean {
    return (
      typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
    );
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
    if (!this.canManageTrash || !this.trashRow(item)) return;

    let undo = () => {};
    const toastId = toast(this.t(this.undoMessage(), 'Moved to trash'), {
      duration: 6000,
      action: { label: this.t(this.undoLabel(), 'Undo'), onClick: () => undo() },
    });

    undo = () => {
      toast.dismiss(toastId);
      this.restoreByItem(item);
    };

    this.undoStack.set({ item, restore: undo });
  }

  /**
   * Optimistic removal + backend persist, shared by single and bulk paths.
   * Compared by id (not reference) so refetches/sorts can't orphan rows.
   * Returns false when there is nothing to do (no permission or already in flight).
   */
  private trashRow(item: TResponse): boolean {
    if (!this.canManageTrash) return false;
    const key = this.getId(item);
    if (this.trashPending.has(key)) return false;
    this.trashPending.add(key);

    const previous = this.items();
    this.items.set(previous.filter((row) => this.getId(row) !== key));
    this.adjustCount('active', -1);

    // Persist the move — the row above is optimistic. On failure the row
    // comes back with a loud error, never a silent refresh surprise.
    this.callDelete(key).subscribe({
      next: () => {
        this.trashPending.delete(key);
        this.adjustCount('trash', 1);
      },
      error: (err) => {
        this.trashPending.delete(key);
        this.items.set(previous);
        this.adjustCount('active', 1);
        // The backend's reason wins (e.g. 409 "this item is still used
        // elsewhere" when a category still has products) — never a generic
        // "please try again" over a precise refusal.
        this.notify.apiError(err, this.deleteFailedTitle(), 'Could not move to trash');
      },
    });
    return true;
  }

  /** Restore backing a trashed item object (toast undo paths). Reloads after. */
  private restoreByItem(item: TResponse): void {
    const id = this.restoreIdOf?.(item) ?? null;
    if (id === null || !this.callRestore) {
      this.load();
      return;
    }
    this.callRestore(id).subscribe({
      next: () => this.load(),
      error: (err) => {
        this.notify.apiError(err, 'notify.errorFallback', 'Restore failed. Please try again.');
        this.load();
      },
    });
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
        const key = this.getId(item);
        this.items.set(this.items().filter((row) => this.getId(row) !== key));
        this.adjustCount('trash', -1);
        this.adjustCount('active', 1);
        this.notify.success('notify.restored', 'Restored successfully');
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

  /** Bulk toolbar gate: remember which destructive action asked for confirmation. */
  requestBulkTrash(): void {
    if (this.selectionCount() > 0) this.bulkConfirm.set('trash');
  }

  requestBulkPermanentDelete(): void {
    if (this.selectionCount() > 0) this.bulkConfirm.set('permanent');
  }

  cancelBulkConfirm(): void {
    this.bulkConfirm.set(null);
  }

  /** Dialog confirm → run the bulk action that asked for it. */
  submitBulkConfirm(): void {
    const action = this.bulkConfirm();
    this.bulkConfirm.set(null);
    if (action === 'trash') this.bulkSoftDelete();
    else if (action === 'permanent') this.bulkPermanentDelete();
  }

  closePermanentDelete(): void {
    if (!this.permanentDeletePending()) this.permanentDeleteTarget.set(null);
  }

  /**
   * Dialog confirm → the request goes out: DELETE /{id}/permanent → 204.
   * Backend verified for the soft-deletable entities; 404 = not found or not
   * trashed; 409 = still referenced elsewhere.
   */
  confirmPermanentDelete(): void {
    const item = this.permanentDeleteTarget();
    if (!item || this.permanentDeletePending()) return;
    const id = this.restoreIdOf?.(item) ?? null;
    if (id === null || id === undefined) {
      this.notify.apiError(null, 'common.permanentDeleteFailed', 'Could not delete permanently');
      return;
    }
    this.permanentDeletePending.set(true);
    this.permanentDeleteSrv().deletePermanently(id).subscribe({
      next: () => {
        this.permanentDeletePending.set(false);
        this.permanentDeleteTarget.set(null);
        this.adjustCount('trash', -1);
        this.notify.success('common.deletedPermanently', 'Deleted permanently');
        this.load();
      },
      error: (err) => {
        this.permanentDeletePending.set(false);
        this.notify.apiError(err, 'common.permanentDeleteFailed', 'Could not delete permanently');
      },
    });
  }

  /** Convenience hook so subclasses can point at the right service. */
  protected permanentDeleteSrv(): { deletePermanently(id: number): Observable<void> } {
    throw new Error('permanentDeleteSrv() not implemented — set it in the subclass');
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

  /** Bulk soft delete — one toast for the whole batch (no Undo: the confirm dialog is the safety gate). */
  bulkSoftDelete(): void {
    if (!this.canManageTrash) return;
    const rows = this.selectedRows();
    this.clearSelection();
    if (rows.length === 0) return;

    const trashed = rows.filter((row) => this.trashRow(row));
    if (trashed.length === 0) return;
    this.notify.success(this.undoMessage(), 'Moved to trash');
  }

  bulkRestore(): void {
    for (const row of this.selectedRows()) this.restore(row);
    this.clearSelection();
  }

  /**
   * Bulk hard delete: one DELETE /{id}/permanent per selected row (no bulk
   * endpoint exists). Per-row failures surface individually; counts resync after.
   */
  bulkPermanentDelete(): void {
    const rows = this.selectedRows();
    this.clearSelection();
    if (rows.length === 0) return;
    const ids = rows
      .map((row) => this.restoreIdOf?.(row))
      .filter((id): id is number => id !== null && id !== undefined);
    let pending = ids.length;
    if (pending === 0) return;
    const done = () => {
      if (--pending === 0) this.load();
    };
    for (const id of ids) {
      this.permanentDeleteSrv().deletePermanently(id).subscribe({
        next: () => {
          this.adjustCount('trash', -1);
          done();
        },
        error: (err) => {
          this.notify.apiError(err, 'common.permanentDeleteFailed', 'Could not delete permanently');
          done();
        },
      });
    }
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

    const size = Number(params.get('size') || 0);
    if ((this.pageSizeOptions as readonly number[]).includes(size)) {
      this.pageSize.set(size);
    }

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
    if (this.pageSize() !== 20) params['size'] = String(this.pageSize());
    if (!this.isTrash() && this.statusFilterValue !== undefined) {
      params['status'] = this.statusFilterValue ? 'enabled' : 'disabled';
    }
    this.listRouter.navigate([], {
      queryParams: params,
      replaceUrl: true,
      relativeTo: this.listRoute,
    });
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
  protected deleteFailedTitle(): string {
    return 'common.deleteFailed';
  }
  protected deleteFailedBody(): string {
    return 'common.deleteFailedBody';
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