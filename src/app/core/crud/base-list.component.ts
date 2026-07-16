import { Directive, OnInit, inject } from '@angular/core';
import { FormArray, FormBuilder, FormGroup } from '@angular/forms';
import { Observable } from 'rxjs';
import { signal } from '@angular/core';
import { PageResponse } from '../models/api-response.model';
import { TableSortEvent } from '../../shared/components/data-table/data-table.component';

export type ViewMode = 'list' | 'grid';

@Directive()
export abstract class BaseListComponent<TResponse, TRequest, TId = string>
  implements OnInit
{
  protected fb = inject(FormBuilder);
  protected Math = Math;

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

  // ─── Lifecycle ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    this.form = this.buildForm();
    this.load();
  }

  // ─── Data ────────────────────────────────────────────────────────────────────

  load(): void {
    this.loading.set(true);
    this.loadPage().subscribe({
      next: (page) => {
        this.items.set(page.content);
        this.pageData.set(page);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.currentPage.set(0);
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
}