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
  | 'approved'
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
    return STATUS_BADGE_LABELS[this.status()];
  });

  protected readonly icon = computed(() => STATUS_BADGE_ICONS[this.status()]);

  protected readonly badgeClass = computed(() => `${BADGE_BASE} ${STATUS_BADGE_CLASSES[this.status()]}`);
}

/** The base classes every badge carries. */
export const BADGE_BASE = 'gap-1.5 flex items-center';

/**
 * The label of each kind, as a Transloco key.
 *
 * A page can override the label with `customLabel` — the review's "Pending"
 * is "قيد المراجعة", not the order's "قيد الانتظار", and the two are
 * different concepts that happen to share an English word.
 */
export const STATUS_BADGE_LABELS: Record<StatusKind, string> = {
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
  approved: 'common.statuses.approved',
  unknown: 'common.statuses.unknown',
};

/** The icon of each kind. */
export const STATUS_BADGE_ICONS: Record<StatusKind, string> = {
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
  approved: 'lucideCheckCircle',
  unknown: 'lucideCircleDot',
};

/**
 * The colour of each kind.
 *
 * Pending — warning. Confirmed — the pale end of the info family
 * (Processing is the full one). Paid / Delivered / Approved — success.
 * Processing — the full info tint. Shipped — the slate chart token, as a
 * tint of itself. Cancelled / Failed — destructive. Refunded / Disabled /
 * Unknown — muted.
 */
export const STATUS_BADGE_CLASSES: Record<StatusKind, string> = {
  pending: 'bg-warning-soft text-warning',
  confirmed: 'bg-info-soft/60 text-info',
  paid: 'bg-success-soft text-success',
  delivered: 'bg-success-soft text-success',
  processing: 'bg-info-soft text-info',
  shipped: 'bg-chart-5/10 text-chart-5',
  cancelled: 'bg-destructive-soft text-destructive-text',
  failed: 'bg-destructive-soft text-destructive-text',
  refunded: 'bg-muted text-muted-foreground',
  enabled: 'bg-success-soft text-success',
  disabled: 'bg-muted text-muted-foreground',
  approved: 'bg-success-soft text-success',
  unknown: 'bg-muted text-muted-foreground',
};
