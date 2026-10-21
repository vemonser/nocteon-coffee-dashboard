import { Component, input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucidePackage } from '@ng-icons/lucide';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';

interface MainCellData {
  name: string;
  slug: string;
  imageUrl: string | null;
  otherName: string;
  color?: string | null;
  /** When true, no thumbnail box is rendered (entities without images). */
  hideThumbnail?: boolean;
}

@Component({
  selector: 'app-main-cell',
  standalone: true,
  imports: [CommonModule, RouterModule, NgIcon, HlmBadgeImports],
  providers: [
    provideIcons({
      lucidePackage,
    }),
  ],
  templateUrl: './main-cell.component.html',
  styleUrl: './main-cell.component.css',
})
export class MainCellComponent {
  readonly data = input.required<MainCellData>();
  readonly langDir = input.required<'ltr' | 'rtl'>();

  /** True when the slug should act as the way into this row's detail page. */
  readonly navigable = input(false);

  /**
   * RouterLink command for the detail page. When set (and the cell is
   * navigable) the name renders as a real anchor — so middle-click and
   * open-in-new-tab work — instead of a click handler. The slug underneath
   * stays plain text: the name is the row's single control.
   */
  readonly navigableHref = input<any[] | null>(null);

  /**
   * Whether the slug line is rendered under the name.
   *
   * The reviews console shows the PRODUCT, and the slug is a technical
   * handle there — it is what the old column showed, and it is what the
   * report called out as unreadable.
   */
  readonly showSlug = input(true);
}