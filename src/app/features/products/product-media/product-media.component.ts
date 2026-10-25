import { CommonModule } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { ConfirmDialogService } from '../../../core/services/confirm-dialog.service';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ProductService } from '../services/product.service';
import { ProductMediaRequest, StagedMedia } from '../models/product.models';
import { NotifyService } from '../../../core/notify/notify.service';
import { HlmCardImports } from '@spartan-ng/helm/card';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  lucideArrowLeft,
  lucidePlus,
  lucideTrash2,
  lucideImage,
  lucideVideo,
  lucideStar,
  lucideLoader2,
} from '@ng-icons/lucide';

@Component({
  selector: 'app-product-media',
  standalone: true,
  imports: [CommonModule, HlmCardImports, HlmButtonImports, HlmInputImports, HlmBadgeImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideArrowLeft, lucidePlus, lucideTrash2, lucideImage, lucideVideo, lucideStar, lucideLoader2 })],
  templateUrl: './product-media.component.html',
})
export class ProductMediaComponent {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private productService = inject(ProductService);

  productSlug = signal<string>('');
  productName = signal<string>('');
  existingMedia = signal<any[]>([]);
  stagedMedia = signal<StagedMedia[]>([]);
  loading = signal(true);
  uploading = signal(false);
  error = signal<string | null>(null);

  private notify = inject(NotifyService);
  private confirmDialog = inject(ConfirmDialogService);

  constructor() {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug) {
      this.productSlug.set(slug);
      this.loadProduct();
    }
  }

  private loadProduct(): void {
    this.loading.set(true);
    this.productService.getBySlug(this.productSlug()).subscribe({
      next: (res) => {
        const product = res.data;
        const enTranslation = product.translations.find((t: any) => t.language === 'en');
        this.productName.set(enTranslation?.name || product.slug);
        this.existingMedia.set(product.media || []);
        this.loading.set(false);
      },
      error: (err) => {
        this.loading.set(false);
        this.notify.apiError(err, 'notify.errorFallback', 'Could not load product');
      },
    });
  }

  onFilesSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      this.stagedMedia.update((media) => [
        ...media,
        {
          file,
          previewUrl: URL.createObjectURL(file),
          type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
          altText: '',
          isPrimary: false,
          sortOrder: media.length,
        },
      ]);
    });
  }

  removeStaged(index: number): void {
    this.stagedMedia.update((media) => media.filter((_, i) => i !== index));
  }

  async removeExisting(index: number): Promise<void> {
    const media = this.existingMedia()[index];
    if (!(await this.confirmDialog.confirm({ title: 'Delete media', message: 'Delete this media?', tone: 'destructive' }))) return;

    this.productService.deleteMedia(media.id).subscribe({
      next: () => {
        this.existingMedia.update((media) => media.filter((_, i) => i !== index));
      },
      error: () => this.error.set('Failed to delete media'),
    });
  }

  setPrimary(source: 'existing' | 'staged', index: number): void {
    if (source === 'existing') {
      this.existingMedia.update((media) => {
        return media.map((m, i) => ({ ...m, isPrimary: i === index }));
      });
    } else {
      this.stagedMedia.update((media) => {
        return media.map((m, i) => ({ ...m, isPrimary: i === index }));
      });
    }
  }

  previewUrl(file: File): string {
    return URL.createObjectURL(file);
  }

  uploadMedia(): void {
    if (this.stagedMedia().length === 0) return;

    this.uploading.set(true);
    this.error.set(null);

    const mediaRequests: ProductMediaRequest[] = this.stagedMedia().map((m, i) => ({
      type: m.type,
      altText: m.altText || undefined,
      isPrimary: m.isPrimary,
      sortOrder: m.sortOrder,
    }));

    const files = this.stagedMedia().map((m) => m.file);

    this.productService.addMedia(this.productSlug(), mediaRequests, files).subscribe({
      next: () => {
        this.loadProduct();
        this.stagedMedia.set([]);
        this.uploading.set(false);
      },
      error: (err) => {
        this.error.set(err?.error?.message ?? 'Upload failed');
        this.uploading.set(false);
      },
    });
  }

  goBack(): void {
    this.router.navigate(['/dashboard/products']);
  }
}