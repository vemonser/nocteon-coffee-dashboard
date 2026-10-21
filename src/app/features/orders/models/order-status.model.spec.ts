import { describe, expect, it } from 'vitest';
import {
  ALLOWED_TRANSITIONS,
  FULFILMENT_CHAIN,
  ORDER_STATUSES,
  PAYMENT_METHODS,
  PAYMENT_STATUSES,
  canTransition,
  isTerminal,
  nextStatuses,
  orderStatusKind,
  paymentStatusKind,
} from './order-status.model';
import type { OrderStatus } from './order.model';

/**
 * Phase 1, ticket 1.3 / Phase 4, ticket 4.4 — the status model.
 *
 * These tests are the contract the status DIALOG is built on: only the
 * transitions the backend's strict state machine allows may be offered, a
 * delivered or cancelled order is terminal, and every status maps to exactly
 * one badge kind.
 */

describe('the order status model', () => {
  it('lists the backend enum, in fulfilment order', () => {
    expect(ORDER_STATUSES).toEqual([
      'PENDING',
      'CONFIRMED',
      'PROCESSING',
      'SHIPPED',
      'DELIVERED',
      'CANCELLED',
    ]);
  });

  it('lists the backend payment status enum', () => {
    expect(PAYMENT_STATUSES).toEqual(['PENDING', 'PAID', 'FAILED', 'REFUNDED']);
  });

  it('lists the backend payment method enum', () => {
    expect(PAYMENT_METHODS).toEqual(['ONLINE', 'CASH_ON_DELIVERY']);
  });

  it('has no REFUNDED order status — a refund is a PAYMENT flag', () => {
    expect(ORDER_STATUSES).not.toContain('REFUNDED' as OrderStatus);
    expect(PAYMENT_STATUSES).toContain('REFUNDED');
  });

  it('runs the fulfilment chain Placed > Confirmed > Processing > Shipped > Delivered', () => {
    expect(FULFILMENT_CHAIN).toEqual(['PENDING', 'CONFIRMED', 'PROCESSING', 'SHIPPED', 'DELIVERED']);
  });
});

describe('the transition matrix', () => {
  it('allows only the backend transitions', () => {
    expect(ALLOWED_TRANSITIONS.PENDING).toEqual(['CONFIRMED', 'CANCELLED']);
    expect(ALLOWED_TRANSITIONS.CONFIRMED).toEqual(['PROCESSING', 'CANCELLED']);
    expect(ALLOWED_TRANSITIONS.PROCESSING).toEqual(['SHIPPED', 'CANCELLED']);
    expect(ALLOWED_TRANSITIONS.SHIPPED).toEqual(['DELIVERED']);
    expect(ALLOWED_TRANSITIONS.DELIVERED).toEqual([]);
    expect(ALLOWED_TRANSITIONS.CANCELLED).toEqual([]);
  });

  it('never lets a delivered order go back to pending', () => {
    expect(canTransition('DELIVERED', 'PENDING')).toBe(false);
    expect(canTransition('DELIVERED', 'DELIVERED')).toBe(false);
  });

  it('treats cancelled as terminal', () => {
    expect(isTerminal('CANCELLED')).toBe(true);
    expect(nextStatuses('CANCELLED')).toEqual([]);
    expect(canTransition('CANCELLED', 'PENDING')).toBe(false);
  });

  it('treats delivered as terminal', () => {
    expect(isTerminal('DELIVERED')).toBe(true);
  });

  it('never skips a stage', () => {
    expect(canTransition('PENDING', 'DELIVERED')).toBe(false);
    expect(canTransition('CONFIRMED', 'SHIPPED')).toBe(false);
    expect(canTransition('PROCESSING', 'DELIVERED')).toBe(false);
  });

  it('never moves backwards', () => {
    expect(canTransition('PROCESSING', 'PENDING')).toBe(false);
    expect(canTransition('SHIPPED', 'CONFIRMED')).toBe(false);
  });

  it('always offers a way to cancel before the order ships', () => {
    for (const status of ['PENDING', 'CONFIRMED', 'PROCESSING'] as OrderStatus[]) {
      expect(nextStatuses(status)).toContain('CANCELLED');
    }
  });

  it('keeps every transition inside the enum', () => {
    for (const targets of Object.values(ALLOWED_TRANSITIONS)) {
      for (const target of targets) {
        expect(ORDER_STATUSES).toContain(target);
      }
    }
  });
});

describe('the badge mapping', () => {
  it('maps every order status to exactly one badge kind', () => {
    const kinds = ORDER_STATUSES.map((s) => orderStatusKind(s));
    expect(kinds).toEqual([
      'pending',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
    ]);
  });

  it('maps every payment status to exactly one badge kind', () => {
    const kinds = PAYMENT_STATUSES.map((s) => paymentStatusKind(s));
    expect(kinds).toEqual(['pending', 'paid', 'failed', 'refunded']);
  });
});
