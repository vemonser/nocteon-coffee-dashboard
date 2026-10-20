import { Component, input, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { TranslocoPipe } from '@jsverse/transloco';
import {
  lucideAlertCircle,
  lucideCheckCircle,
  lucideInfo,
  lucidePackage,
  lucideTruck,
  lucideXCircle,
  lucideRotateCcw,
  lucideClock,
  lucideCircleDot,
} from '@ng-icons/lucide';

export type StatusKind =
  | 'pending'
  | 'confirmed'
  | 'paid'
  | 'processing'
  | 'shipped'
  | 'delivered'
  | 'cancelled'
  | 'failed'
  | 'refunded'
  | 'enabled'
  | 'disabled'
  | 'unknown';

/**
 * Centralized status badge mapping.
 *
 * Color mapping follows design.md §2b ("Colour by meaning") and §4:
 * - Pending   = warning (amber) + icon
 * - Confirmed = info, soft tint + icon
 * - Paid/Delivered = success (green) + icon
 * - Processing = info + icon
 * - Shipped   = chart-5 (slate) + icon
 * - Cancelled/Failed = destructive-soft (red) + icon
 * - Refunded = muted (gray) + icon
 * - Enabled = success + icon
 * - Disabled = muted + icon
 *
 * Primary copper is NEVER used for status colors.
 *
 * Two of the statuses share the info hue on purpose — Confirmed and
 * Processing are adjacent stages of the same funnel — so they are told apart
 * by the STRENGTH of the tint, not by a second hue: Confirmed is the paler
 * one, Processing the full one. Both carry their text, so colour is never
 * the only signal.
 */
@Component({
  selector: 'app-status-badge',
  standalone: true,
  imports: [CommonModule, HlmBadgeImports, NgIcon, TranslocoPipe],
  providers: [
    provideIcons({
      lucideAlertCircle,
      lucideCheckCircle,
      lucideInfo,
      lucidePackage,
      lucideTruck,
      lucideXCircle,
      lucideRotateCcw,
      lucideClock,
      lucideCircleDot,
    }),
  ],
  template: `
    <hlm-badge [class]="badgeClass()" class="gap-1.5 flex items-center">
      @if (icon()) {
        <ng-icon [name]="icon()" class="size-3" />
      }
      <span>{{ label() | transloco }}</span>
    </hlm-badge>
  `,
})
export class StatusBadgeComponent {
  readonly status = input.required<StatusKind>();
  readonly customLabel = input<string>();

  protected readonly label = computed(() => {
    if (this.customLabel()) return this.customLabel();
    const labels: Record<StatusKind, string> = {
      pending: 'common.statuses.pending',
      confirmed: 'common.statuses.confirmed',
      paid: 'common.statuses.paid',
      processing: 'common.statuses.processing',
      shipped: 'common.statuses.shipped',
      delivered: 'common.statuses.delivered',
      cancelled: 'common.statuses.cancelled',
      failed: 'common.statuses.failed',
      refunded: 'common.statuses.refunded',
      enabled: 'common.statuses.enabled',
      disabled: 'common.statuses.disabled',
      unknown: 'common.statuses.unknown',
    };
    return labels[this.status()];
  });

  protected readonly icon = computed(() => {
    const icons: Record<StatusKind, string> = {
      pending: 'lucideClock',
      confirmed: 'lucideCircleDot',
      paid: 'lucideCheckCircle',
      processing: 'lucidePackage',
      shipped: 'lucideTruck',
      delivered: 'lucideCheckCircle',
      cancelled: 'lucideXCircle',
      failed: 'lucideAlertCircle',
      refunded: 'lucideRotateCcw',
      enabled: 'lucideCheckCircle',
      disabled: 'lucideXCircle',
      unknown: 'lucideCircleDot',
    };
    return icons[this.status()];
  });

  protected readonly badgeClass = computed(() => {
    const base = 'gap-1.5 flex items-center';
    const variants: Record<StatusKind, string> = {
      // Pending — warning.
      pending: 'bg-warning-soft text-warning',
      // Confirmed — the pale end of the info family (Processing is the full one).
      confirmed: 'bg-info-soft/60 text-info',
      // Paid / Delivered — success.
      paid: 'bg-success-soft text-success',
      delivered: 'bg-success-soft text-success',
      // Processing — the full info tint.
      processing: 'bg-info-soft text-info',
      // Shipped — the slate chart token, as a tint of itself.
      shipped: 'bg-chart-5/10 text-chart-5',
      // Cancelled / Failed — destructive.
      cancelled: 'bg-destructive-soft text-destructive-text',
      failed: 'bg-destructive-soft text-destructive-text',
      // Refunded — muted.
      refunded: 'bg-muted text-muted-foreground',
      enabled: 'bg-success-soft text-success',
      disabled: 'bg-muted text-muted-foreground',
      unknown: 'bg-muted text-muted-foreground',
    };
    return `${base} ${variants[this.status()]}`;
  });
}
