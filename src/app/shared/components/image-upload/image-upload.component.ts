import { Component, model } from "@angular/core";

@Component({
  selector:
    'app-image-upload',
  standalone: true,
  templateUrl:
    './image-upload.component.html',
})
export class ImageUploadComponent {
  image =
    model<File | null>(null);

  preview =
    model<string | null>(null);

  onSelect(
    event: Event,
  ) {
    const file =
      (
        event.target as HTMLInputElement
      ).files?.[0];

    if (!file) {
      return;
    }

    this.image.set(file);

    const reader =
      new FileReader();

    reader.onload =
      (e) => {
        this.preview.set(
          e.target
            ?.result as string,
        );
      };

    reader.readAsDataURL(
      file,
    );
  }
}