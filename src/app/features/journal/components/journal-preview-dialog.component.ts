import { CommonModule } from '@angular/common';
import { Component, input, output } from '@angular/core';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { TranslocoPipe } from '@jsverse/transloco';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';

/**
 * FE-04: what the reader will see.
 *
 * <p>The body is inserted with `[innerHTML]` on sanitized content — the FE-01 contract — and
 * Angular's own sanitizer runs on top. No `bypassSecurityTrustHtml`: the preview must not be a
 * second, weaker rendering path.
 */
@Component({
  selector: 'app-journal-preview-dialog',
  standalone: true,
  imports: [CommonModule, DialogShellComponent, HlmBadgeImports, HlmButtonImports, TranslocoPipe],
  template: `
    <app-dialog-shell
      [open]="open()"
      [title]="'journal.preview' | transloco"
      testId="journal-preview"
      (closed)="closed.emit()"
    >
      <article class="mx-auto max-w-2xl space-y-5">
        @if (coverUrl()) {
          <img
            [src]="coverUrl()"
            alt=""
            class="aspect-[2/1] w-full rounded-md border object-cover"
          />
        }

        <header class="space-y-2">
          @if (tags().length) {
            <div class="flex flex-wrap gap-1.5">
              @for (tag of tags(); track tag) {
                <hlm-badge variant="outline">{{ tag }}</hlm-badge>
              }
            </div>
          }
          <h1 class="text-2xl font-medium leading-tight">
            {{ title() || ('journal.untitled' | transloco) }}
          </h1>
          @if (excerpt()) {
            <p class="text-sm text-muted-foreground">{{ excerpt() }}</p>
          }
        </header>

        <div class="journal-body text-sm leading-relaxed" [innerHTML]="bodyHtml()"></div>

        @if (relatedProducts().length) {
          <section class="space-y-2 border-t pt-4">
            <h2 class="text-sm font-medium">{{ 'journal.relatedProducts' | transloco }}</h2>
            <ul class="list-disc space-y-1 ps-5 text-sm text-muted-foreground">
              @for (product of relatedProducts(); track product) {
                <li>{{ product }}</li>
              }
            </ul>
          </section>
        }
      </article>

      <button dialog-footer-end hlmBtn type="button" (click)="closed.emit()">
        {{ 'common.close' | transloco }}
      </button>
    </app-dialog-shell>
  `,
  styles: [
    `
      :host ::ng-deep .journal-body img {
        max-width: 100%;
        height: auto;
        border-radius: 6px;
      }
      :host ::ng-deep .journal-body h1,
      :host ::ng-deep .journal-body h2,
      :host ::ng-deep .journal-body h3 {
        font-weight: 500;
        line-height: 1.25;
        margin-top: 1.25em;
      }
      :host ::ng-deep .journal-body blockquote {
        border-inline-start: 3px solid var(--border);
        padding-inline-start: 1em;
        color: var(--muted-foreground);
      }
      :host ::ng-deep .journal-body ul,
      :host ::ng-deep .journal-body ol {
        padding-inline-start: 1.5em;
        list-style: revert;
      }
      :host ::ng-deep .journal-body a {
        text-decoration: underline;
      }
      :host ::ng-deep .journal-body pre {
        overflow-x: auto;
        border-radius: 6px;
        background: var(--muted);
        padding: 0.75em 1em;
      }
    `,
  ],
})
export class JournalPreviewDialogComponent {
  readonly open = input(false);
  readonly title = input('');
  readonly excerpt = input('');
  readonly bodyHtml = input('');
  readonly coverUrl = input<string | null>(null);
  readonly tags = input<string[]>([]);
  readonly relatedProducts = input<string[]>([]);
  readonly closed = output<void>();
}
