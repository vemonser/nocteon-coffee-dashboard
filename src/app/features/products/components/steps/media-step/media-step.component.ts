import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ProductWizardStateService } from '../../product-wizard/product-wizard-state.service';
import { ProductWizardComponent } from '../../product-wizard/product-wizard.component';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUpload } from '@ng-icons/lucide';

/**
 * Step 3 — Media gallery.
 * Two separate lists: existingMedia (already uploaded, has a URL — only
 * removable, can't re-upload) and stagedMediaFiles (new File objects,
 * sent together on final submit).
 */
@Component({
  selector: 'app-media-step',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, NgIcon],
  providers: [provideIcons({ lucideUpload })],
  templateUrl: './media-step.component.html',
})
export class MediaStepComponent {
  protected state = inject(ProductWizardStateService);
  private wizard = inject(ProductWizardComponent);

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
    if (window.confirm('Remove this media?')) {
      this.state.removeStagedMedia(index);
    }
  }

  removeExisting(index: number): void {
    if (window.confirm('Remove this media?')) {
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

  previewUrl(file: File): string {
    return URL.createObjectURL(file);
  }
}
