import { Component, computed, inject, signal } from '@angular/core';
import { ConfirmDialogService } from '../../../../../core/services/confirm-dialog.service';
import { CommonModule } from '@angular/common';
import { CdkDragDrop, DragDropModule } from '@angular/cdk/drag-drop';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { HlmSelectImports } from '@spartan-ng/helm/select';
import { HlmLabel } from '@spartan-ng/helm/label';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideUpload,
  lucidePlay,
  lucidePencil,
  lucideStar,
  lucideTrash2,
  lucideGripVertical,
} from '@ng-icons/lucide';

interface MediaFileError {
  name: string;
  message: string;
}

/**
 * Step 3 — Media gallery.
 * Existing media (already uploaded) and staged files share the same tile UI.
 */
@Component({
  selector: 'app-media-step',
  standalone: true,
  imports: [CommonModule, DragDropModule, HlmSelectImports, HlmLabel, TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideUpload, lucidePlay, lucidePencil, lucideStar, lucideTrash2, lucideGripVertical })],
  templateUrl: './media-step.component.html',
})
export class MediaStepComponent {
  protected state = inject(ProductWizardStateService);
  private wizard = inject(ProductWizardComponent);
  private confirmDialog = inject(ConfirmDialogService);
  private transloco = inject(TranslocoService);

  /** Images that can be a social card; a video is never one. */
  readonly images = computed(() => this.state.existingMedia().filter((m) => m.type === 'IMAGE'));

  /** Label for the social-image select: alt text when present, otherwise its position. */
  readonly ogImageLabel = (value: unknown): string => {
    const url = String(value ?? '');
    if (!url) return this.transloco.translate('products.media.useCoverImage');
    const images = this.images();
    const index = images.findIndex((m) => m.url === url);
    if (index === -1) return this.transloco.translate('products.media.customSocialImage');
    return (
      images[index].altText?.trim() ||
      this.transloco.translate('products.media.imageNumber', { n: index + 1 })
    );
  };

  setSocialImage(value: unknown): void {
    const control = this.state.form.get('ogImageUrl');
    control?.setValue(value == null ? '' : String(value));
    // The wizard's guard compares normalized snapshots, not `form.dirty`, but marking the
    // control dirty keeps any other consumer honest without changing the snapshot model.
    control?.markAsDirty();
  }

  readonly fileErrors = signal<MediaFileError[]>([]);
  readonly videoDurations = signal<Record<string, string>>({});
  readonly editingAlt = signal<Set<string>>(new Set());

  private static readonly MAX_BYTES = 10 * 1024 * 1024;

  saveCurrentStep(): void {
    this.wizard.saveCurrentStep();
  }

  onBack(): void {
    this.wizard.onBack();
  }

  isCurrentStepDirty(): boolean {
    return this.wizard.isCurrentStepDirty();
  }

  isCurrentStepValid(): boolean {
    return this.state.isCurrentStepValid();
  }

  setPrimary(source: 'existing' | 'staged', index: number): void {
    this.state.setPrimaryMedia(source, index);
  }

  onFilesSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const files = input.files;
    if (!files) return;

    const errors: MediaFileError[] = [];
    Array.from(files).forEach((file) => {
      if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) {
        errors.push({ name: file.name, message: 'Unsupported file type. Use an image or a video.' });
        return;
      }
      if (file.size > MediaStepComponent.MAX_BYTES) {
        errors.push({ name: file.name, message: 'File is larger than 10 MB.' });
        return;
      }

      const isVideo = file.type.startsWith('video/');
      if (isVideo) this.readVideoDuration(file);

      this.state.addStagedMedia({
        file,
        previewUrl: URL.createObjectURL(file),
        type: isVideo ? 'VIDEO' : 'IMAGE',
        altText: '',
        isPrimary: false,
        sortOrder: this.state.stagedMedia().length,
      });
    });

    this.fileErrors.set(errors);
    input.value = '';
  }

  private readVideoDuration(file: File): void {
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.preload = 'metadata';
    video.onloadedmetadata = () => {
      const total = Number.isFinite(video.duration) ? video.duration : 0;
      const minutes = Math.floor(total / 60);
      const seconds = Math.floor(total % 60).toString().padStart(2, '0');
      this.videoDurations.update((d) => ({ ...d, [file.name]: `${minutes}:${seconds}` }));
      URL.revokeObjectURL(url);
    };
    video.onerror = () => URL.revokeObjectURL(url);
    video.src = url;
  }

  async removeStaged(index: number): Promise<void> {
    if (await this.confirmDialog.confirm({ title: 'Remove media', message: 'Remove this media?', tone: 'destructive' })) {
      this.state.removeStagedMedia(index);
    }
  }

  async removeExisting(index: number): Promise<void> {
    if (await this.confirmDialog.confirm({ title: 'Remove media', message: 'Remove this media?', tone: 'destructive' })) {
      this.state.removeExistingMedia(index);
    }
  }

  onStagedAltChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.state.updateAltText(index, value);
  }

  onExistingAltChange(index: number, event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.state.updateExistingAltText(index, value);
  }

  toggleAlt(key: string): void {
    const next = new Set(this.editingAlt());
    if (next.has(key)) next.delete(key);
    else next.add(key);
    this.editingAlt.set(next);
  }

  isEditingAlt(key: string): boolean {
    return this.editingAlt().has(key);
  }

  dropExisting(event: CdkDragDrop<unknown[]>): void {
    this.state.reorderExistingMedia(event.previousIndex, event.currentIndex);
  }

  dropStaged(event: CdkDragDrop<unknown[]>): void {
    this.state.reorderStagedMedia(event.previousIndex, event.currentIndex);
  }

  videoDuration(name: string): string | null {
    return this.videoDurations()[name] ?? null;
  }

  previewUrl(file: File): string {
    return URL.createObjectURL(file);
  }
}
