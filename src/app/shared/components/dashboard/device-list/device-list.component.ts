import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { DashboardStatsService } from '../../../../features/dashboard/services/dashboard-stats.service';
import { LocalizedNameService } from '../../../../core/i18n/localized-name.service';
import { PluralPipe } from '../../../pipes/plural.pipe';

/**
 * The device breakdown, as a compact bar list.
 *
 * The bars are scaled to the LARGEST device, not to the total, and they use
 * the FULL track: a list where the biggest bar is 30 % of the track reads
 * as "everything is small". The number is next to every bar, so the colour
 * is never the only signal.
 *
 * THE UNIT (Round 2, tickets 1.7 and 2.1)
 * ---------------------------------------
 * The backend counts ROWS in the device table, which the API does not
 * label. The rows are CUMULATIVE and they grow while the store is open —
 * the dashboard's own browsing adds a row every time a page is loaded —
 * so the count is a count of observed DEVICE SESSIONS, not of people, and
 * not of devices either. The card says "sessions", in the reader's
 * language, in the right plural form ("1 session", "6 sessions"), and the
 * unit follows the number in both languages.
 *
 * The data is NOT filtered in the frontend: the dashboard's own traffic is
 * in the number, and hiding it here would be a lie about the store's
 * traffic. What is missing is the CONTRACT (see ORDERS_CONTRACT.md): the
 * endpoint should say what a row is and should exclude the staff's own
 * sessions.
 */
@Component({
  selector: 'app-device-list',
  standalone: true,
  imports: [CommonModule, TranslocoPipe, PluralPipe],
  templateUrl: './device-list.component.html',
  styleUrl: './device-list.component.css',
})
export class DeviceListComponent {
  private readonly stats = inject(DashboardStatsService);
  private readonly names = inject(LocalizedNameService);

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
}
