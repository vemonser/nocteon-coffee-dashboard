import { Component, computed, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { TranslocoPipe } from '@jsverse/transloco';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideGlobe,
  lucideMonitor,
  lucideSmartphone,
  lucideTablet,
} from '@ng-icons/lucide';
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
  imports: [CommonModule, TranslocoPipe, PluralPipe, NgIcon],
  providers: [
    provideIcons({ lucideGlobe, lucideMonitor, lucideSmartphone, lucideTablet }),
  ],
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

  /** Total sessions count for percentage calculation. */
  readonly total = computed(() =>
    this.devices().reduce((sum, d) => sum + (d.count || 0), 0),
  );

  /** The width of one bar, as a percentage of the total. */
  width(count: number): number {
    const total = this.total();
    if (!total) return 0;
    const percent = (count / total) * 100;
    return Math.max(2, Math.round(percent * 10) / 10);
  }

  /** Percent of total sessions for display. */
  percent(count: number): number {
    const total = this.total();
    if (!total) return 0;
    return Math.round((count / total) * 100);
  }

  /** The localized device name. */
  label(deviceType: string): string {
    return this.names.deviceType(deviceType);
  }

  /**
   * The icon for a device type.
   *
   * The API's device names are not a closed enum (`Desktop`, `DESKTOP`,
   * `Mobile`, `IOS` all occur), so the match is on the WORD, not on one
   * spelling. An unknown type still gets a neutral icon rather than a blank.
   */
  icon(deviceType: string): string {
    const type = (deviceType || '').toUpperCase();
    // Check for specific OS types first
    if (/WINDOWS/.test(type)) return 'lucideMonitor';
    if (/MAC|IOS|IPHONE|IPAD|APPLE/.test(type)) return 'lucideMonitor';
    if (/LINUX/.test(type)) return 'lucideMonitor';
    if (/ANDROID/.test(type)) return 'lucideSmartphone';
    // Then check for device types
    if (/MOBILE|PHONE/.test(type)) return 'lucideSmartphone';
    if (/TABLET/.test(type)) return 'lucideTablet';
    if (/DESKTOP|LAPTOP|COMPUTER/.test(type)) return 'lucideMonitor';
    return 'lucideGlobe';
  }
}
