import { Component, model } from '@angular/core';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideUpload } from '@ng-icons/lucide';
import { TranslocoPipe } from '@jsverse/transloco';

/**
 * Image picker used inside dialogs (categories Add/Edit).
 *
 * A native `<input type="file">` stays the real control (keyboard, screen
 * reader, OS picker) — an sr-only input inside a styled label, the same
 * pattern the category detail page uses. The styled chip is the label, so
 * the whole control behaves natively without a hidden-button-and-JS bridge.
 */
@Component({
  selector: 'app-image-upload',
  standalone: true,
  imports: [NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideUpload })],
  templateUrl: './image-upload.component.html',
})
export class ImageUploadComponent {
  image = model<File | null>(null);
  preview = model<string | null>(null);

  onSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    this.image.set(file);

    const reader = new FileReader();
    reader.onload = (e) => {
      this.preview.set(e.target?.result as string);
    };
    reader.readAsDataURL(file);
  }
}
