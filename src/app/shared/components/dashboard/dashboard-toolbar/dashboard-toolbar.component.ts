import { Component, computed, inject, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideCalendar,
  lucideDownload,
  lucideFileSpreadsheet,
  lucidePrinter,
  lucideRepeat,
  lucideRefreshCw,
  lucideChevronDown,
} from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmDropdownMenuImports } from '@spartan-ng/helm/dropdown-menu';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { LanguageService } from '../../../../core/i18n/language.service';
import { LocalizedDateService } from '../../../../core/i18n/localized-date.service';
import { LocalizedDateComponent } from '../../../ui/localized-date/localized-date.component';
import { TabsComponent } from '../../ui/tabs/tabs.component';
import { formatRelativeTime } from '../../../../core/i18n/relative-time';
import { TranslocoService } from '@jsverse/transloco';

/**
 * The dashboard toolbar — ONE row.
 *
 * Everything that controls the page lives here: the range, the range it
 * compares against, and the export. The title and the subtitle sit above
 * it. The toolbar is STICKY, so the range is still reachable when the
 * reader has scrolled past the KPIs.
 *
 * The range is a segmented control with the right ARIA role, and the
 * selection is announced through an `aria-live` region, so a screen-reader
 * user hears which range is now in effect.
 */
@Component({
  selector: 'app-dashboard-toolbar',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    TranslocoPipe,
    NgIcon,
    HlmButtonImports,
    HlmDropdownMenuImports,
    LocalizedDateComponent,
    TabsComponent,
  ],
  providers: [
    provideIcons({
      lucideCalendar,
      lucideDownload,
      lucideFileSpreadsheet,
      lucidePrinter,
      lucideRepeat,
      lucideRefreshCw,
      lucideChevronDown,
    }),
  ],
  templateUrl: './dashboard-toolbar.component.html',
  styleUrl: './dashboard-toolbar.component.css',
})
export class DashboardToolbarComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly language = inject(LanguageService);
  private readonly localizedDate = inject(LocalizedDateService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);

  /**
   * The page owns the print (it also answers Ctrl+P); the toolbar only asks.
   * `window.print()` must leave the sidebar behind, and the page shell is the
   * one place that knows it is a page.
   */
  readonly printRequested = output<void>();

  /** The range options. */
  readonly options = [
    { days: 1, key: 'dashboard.today' },
    { days: 7, key: 'dashboard.last7Days' },
    { days: 30, key: 'dashboard.last30Days' },
    { days: 90, key: 'dashboard.last90Days' },
    { days: 365, key: 'dashboard.last365Days' },
    { days: -1, key: 'dashboard.custom' },
  ];

  /** The selected range, in days. */
  readonly selectedDays = computed(() => this.stats.days());

  /** The range options, as tab items. */
  readonly tabItems = computed(() => {
    this.language.language();
    return this.options.map((option) => ({
      id: String(option.days),
      label: this.transloco.translate(option.key),
    }));
  });

  /** Last updated timestamp. */
  readonly lastUpdated = signal<Date>(new Date());

  /** Relative time since last update, in the reader's language. */
  readonly relativeTime = computed(() => {
    this.language.language();
    // Composed after the "Updated" label → sentence case ("Updated just now").
    return formatRelativeTime(this.lastUpdated(), this.language.language(), { lowercase: true });
  });

  /** Refresh all dashboard queries. */
  refresh(): void {
    this.stats.refresh();
    this.lastUpdated.set(new Date());
  }

  /** The active tab's id — the range in days, as a string. */
  readonly activeTabId = computed(() => String(this.stats.days()));

  /** The live announcement of the current selection. */
  readonly announcement = signal('');

  /**
   * The absolute time the numbers on screen were fetched.
   *
   * Printed instead of "Updated 3 minutes ago": a relative time says nothing
   * once the sheet is on a desk, and it would be wrong by the time it gets
   * there. Same shared helper as every other date, so EN/AR agree.
   */
  readonly updatedAt = computed(() => {
    this.language.language();
    return this.localizedDate.formatDateAndTime(this.lastUpdated());
  });

  /**
   * Select a range.
   *
   * The tab group hands over the id of the chosen tab, which is the number
   * of days as a string.
   */
  selectDays(id: string): void {
    const days = Number(id);
    if (!Number.isFinite(days)) return;
    const option = this.options.find((o) => o.days === days);
    if (!option) return;
    if (days === -1) {
      this.customRangeOpen.set(true);
      return;
    }
    this.select(days, option.key);
  }

  /** Custom date range popover state. */
  readonly customRangeOpen = signal(false);
  /** Custom start date. */
  readonly customStart = signal('');
  /** Custom end date. */
  readonly customEnd = signal('');

  /** Apply custom date range. */
  applyCustomRange(): void {
    // Custom date range requires backend support
    // For now, just close the popover
    this.customRangeOpen.set(false);
  }

  /** Close custom range popover. */
  closeCustomRange(): void {
    this.customRangeOpen.set(false);
  }

  select(days: number, key: string): void {
    this.stats.setDays(days);
    this.syncUrl(days);
    this.announcement.set(
      `${this.transloco.translate(key)} — ${this.transloco.translate('dashboard.selectedPeriod')}`,
    );
  }

  private syncUrl(days: number): void {
    // NOT replaceUrl: the range is a navigation, so the browser's BACK
    // button walks back through the ranges the reader visited.
    void this.router.navigate([], {
      queryParams: { days },
      queryParamsHandling: 'merge',
    });
  }

  /** The current window. */
  readonly current = computed(() => this.stats.window('current'));
  /** The comparison window. */
  readonly previous = computed(() => this.stats.window('previous'));

  /**
   * The last day of a window (its end is exclusive).
   *
   * CALENDAR arithmetic, not `getTime() - 24h`: a DST transition makes a
   * day 23 or 25 hours long, and the store's zone (Africa/Cairo) has DST.
   * `core/dashboard/period.ts` has the same rule.
   */
  lastDayOf(window: { start: Date; end: Date }): Date {
    const copy = new Date(window.end.getTime());
    copy.setDate(copy.getDate() - 1);
    return copy;
  }

  /** What the export contains, and for which range. */
  readonly exportTooltip = computed(() => {
    this.language.language();
    const from = this.transloco.translate('dashboard.exportTooltip');
    const range = this.transloco.translate(
      this.options.find((o) => o.days === this.selectedDays())?.key ?? 'dashboard.last30Days',
    );
    return `${from} (${range})`;
  });

  /**
   * Export the report as a PDF.
   *
   * There is no server-generated PDF and no client-side PDF library: the
   * dashboard already IS the report, so the browser's print dialog is the
   * PDF writer ("Save as PDF"). The page prints on the light stylesheet with
   * the shell chrome removed — see `DashboardComponent.printReport()` and
   * the `@media print` rules.
   */
  printReport(): void {
    this.printRequested.emit();
  }

  /** Export the overview for the selected range as a CSV. */
  exportCsv(): void {
    const overview = this.stats.overview();
    if (!overview) return;
    const days = this.selectedDays();
    const rows: string[] = [];
    rows.push('Metric,Value');
    rows.push(`Total revenue,${overview.totalRevenue}`);
    rows.push(`Total orders,${overview.totalOrders}`);
    rows.push(`Average order value,${overview.averageOrderValue}`);
    rows.push(`Coffee sold (kg),${overview.coffeeSoldKg}`);
    rows.push(`New customers,${overview.userGrowth.currentPeriodCount}`);
    rows.push(`Repeat purchase rate,${overview.repeatPurchaseRate.repeatRate}`);
    rows.push(`Refund rate,${overview.refundRate.refundRate}`);
    rows.push('');
    rows.push('Top products,Units sold,List price');
    for (const p of overview.topSellingProducts) {
      rows.push(`"${p.name}",${p.quantitySold},${p.price}`);
    }
    // A BOM, so Excel opens the Arabic file as UTF-8 rather than as Latin-1.
    const blob = new Blob(['\\uFEFF' + rows.join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `nocteon-analytics-${days}d.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
