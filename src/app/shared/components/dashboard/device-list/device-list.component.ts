import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { LocalizedNameService } from '../../../../core/i18n/localized-name.service';
import { WidgetHeaderComponent } from '../../widget-header/widget-header.component';

/**
 * The device breakdown, as a compact bar list.
 *
 * The bars are scaled to the LARGEST device, not to the total, and they use
 * the FULL track: a list where the biggest bar is 30 % of the track reads
 * as "everything is small". The number is next to every bar, so the colour
 * is never the only signal.
 *
 * The unit is stated: the backend counts ROWS in the device table, which
 * the API does not label. The card says "sessions" and the evidence notes
 * that the underlying row semantics are a backend question (see
 * `evidence/phase1/measurements.json` -> `missingBackendContracts`).
 */
@Component({
  selector: 'app-device-list',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, WidgetHeaderComponent],
  templateUrl: './device-list.component.html',
  styleUrl: './device-list.component.css',
})
export class DeviceListComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly names = inject(LocalizedNameService);
  private readonly transloco = inject(TranslocoService);

  /** The devices, largest first. */
  readonly devices = computed(() =>
    [...(this.stats.deviceBreakdown() ?? [])].sort(
      (a, b) => (b.count || 0) - (a.count || 0),
    ),
  );

  /** The largest count — the bars are scaled to it. */
  readonly max = computed(() =>
    this.devices().reduce((max, d) => Math.max(max, d.count || 0), 0),
  );

  /** The width of one bar, as a percentage of the full track. */
  width(count: number): number {
    const max = this.max();
    if (!max) return 0;
    return Math.max(2, Math.round((count / max) * 1000) / 10);
  }

  /** The localized device name. */
  label(deviceType: string): string {
    return this.names.deviceType(deviceType);
  }

  /** The unit of the count. */
  readonly unit = computed(() => this.transloco.translate('dashboard.deviceUnit'));
}
