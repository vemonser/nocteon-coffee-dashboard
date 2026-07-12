import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';

/**
 * Step 3 — Media gallery.
 * Two separate lists: existingMedia (already uploaded, has a URL — only
 * removable, can't re-upload) and stagedMediaFiles (new File objects,
 * sent together on final submit).
 */
@Component({
  selector: 'app-media-step',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './media-step.component.html',
})
export class MediaStepComponent {
  protected state = inject(ProductWizardStateService);
  setPrimary(source: 'existing' | 'staged', index: number): void {
    this.state.setPrimaryMedia(source, index);
  }
  onFilesSelected(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (!files) return;

    Array.from(files).forEach((file) => {
      this.state.addStagedMedia({
        file,
        previewUrl: URL.createObjectURL(file),
        type: file.type.startsWith('video/') ? 'VIDEO' : 'IMAGE',
        altText: '',
        isPrimary: false, 
        sortOrder: this.state.stagedMedia().length,
      });
    });
  }
  removeStaged(index: number): void {
    this.state.removeStagedMedia(index);
  }

  removeExisting(index: number): void {
    this.state.removeExistingMedia(index);
  }

  previewUrl(file: File): string {
    return URL.createObjectURL(file);
  }
}
