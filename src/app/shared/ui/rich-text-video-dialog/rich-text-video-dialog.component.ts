import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmLabel } from '@spartan-ng/helm/label';
import { TranslocoPipe } from '@jsverse/transloco';
import { parseVideoUrl } from '../../utils/video-url';
import { DialogShellComponent } from '../dialog-shell/dialog-shell.component';

/** Asks for a YouTube/Vimeo link and emits the canonical embed URL. */
@Component({
  selector: 'app-rich-text-video-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    DialogShellComponent,
    HlmInputImports,
    HlmLabel,
    HlmButtonImports,
    TranslocoPipe,
  ],
  template: `
    <app-dialog-shell
      [open]="open()"
      [title]="'journal.insertVideo' | transloco"
      testId="rich-text-video"
      (closed)="closed.emit()"
    >
      <div class="space-y-2">
        <label hlmLabel for="rich-text-video-url">{{ 'journal.videoUrl' | transloco }}</label>
        <input
          hlmInput
          id="rich-text-video-url"
          [formControl]="url"
          type="url"
          class="w-full"
          dir="ltr"
          placeholder="https://www.youtube.com/watch?v=..."
        />
        <p class="text-xs text-muted-foreground">{{ 'journal.videoUrlHint' | transloco }}</p>
        @if (invalid()) {
          <p class="text-xs text-destructive">{{ 'journal.videoUrlInvalid' | transloco }}</p>
        }
      </div>
      <button dialog-footer-start hlmBtn variant="ghost" type="button" (click)="closed.emit()">
        {{ 'common.cancel' | transloco }}
      </button>
      <button dialog-footer-end hlmBtn type="button" (click)="insert()">
        {{ 'journal.videoInsert' | transloco }}
      </button>
    </app-dialog-shell>
  `,
})
export class RichTextVideoDialogComponent {
  readonly open = input(false);
  readonly closed = output<void>();
  readonly inserted = output<string>();
  readonly url = new FormControl('', { nonNullable: true });
  readonly invalid = signal(false);

  insert(): void {
    const embed = parseVideoUrl(this.url.value);
    if (!embed) {
      this.invalid.set(true);
      return;
    }
    this.inserted.emit(embed);
    this.reset();
  }

  reset(): void {
    this.url.setValue('');
    this.invalid.set(false);
  }

  close(): void {
    this.reset();
    this.closed.emit();
  }
}
