import { describe, it, expect } from 'vitest';
import { computeKpi, tabToApiParams } from './order-kpi';
import type { OrderStatsResponse } from '../models/order.model';
import type { OrderStatus, PaymentStatus } from '../models/order.model';

describe('order-kpi', () => {
  const mockStats = (overrides: Partial<OrderStatsResponse> = {}): OrderStatsResponse => ({
    total: 17,
    revenue: 1176.25,
    revenueOrderCount: 10,
    byStatus: [],
    byPaymentStatus: [],
    byPaymentMethod: [],
    ...overrides,
  });

  const emptyStats = (): OrderStatsResponse => ({
    total: 0,
    revenue: 0,
    revenueOrderCount: 0,
    byStatus: [],
    byPaymentStatus: [],
    byPaymentMethod: [],
  });

  const mockStatusCounts = (overrides: Record<string, number> = {}): Record<string, number> => ({
    PENDING: 1,
    CONFIRMED: 1,
    PROCESSING: 1,
    SHIPPED: 1,
    DELIVERED: 10,
    CANCELLED: 3,
    ...overrides,
  });

  describe('computeKpi', () => {
    it('uses revenueOrderCount for AOV, not filteredTotal', () => {
      const kpi = computeKpi(mockStats(), mockStatusCounts(), 17);
      // AOV = 1176.25 / 10 = 117.625, NOT 1176.25 / 17
      expect(kpi.avgOrderValue).toBeCloseTo(117.625);
    });

    it('uses filteredTotal as denominator for cancelRate', () => {
      const kpi = computeKpi(mockStats(), mockStatusCounts(), 17);
      // cancelRate = 3 / 17 * 100 = 17.647%
      expect(kpi.cancelRate).toBeCloseTo(17.647, 1);
    });

    it('openCount sums Pending + Confirmed + Processing + Shipped', () => {
      const kpi = computeKpi(mockStats(), mockStatusCounts(), 17);
      expect(kpi.openCount).toBe(4);
    });

    it('revenue comes from stats.revenue', () => {
      const kpi = computeKpi(mockStats({ revenue: 500 }), mockStatusCounts(), 17);
      expect(kpi.revenue).toBe(500);
    });

    it('handles zero revenueOrderCount gracefully', () => {
      const kpi = computeKpi(mockStats({ revenue: 100, revenueOrderCount: 0 }), mockStatusCounts(), 17);
      expect(kpi.avgOrderValue).toBe(0);
    });

    it('handles zero filteredTotal gracefully', () => {
      const kpi = computeKpi(mockStats(), mockStatusCounts(), 0);
      expect(kpi.cancelRate).toBe(0);
    });

    it('handles missing stats fields gracefully', () => {
      const kpi = computeKpi(emptyStats(), mockStatusCounts(), 17);
      expect(kpi.revenue).toBe(0);
      expect(kpi.avgOrderValue).toBe(0);
      expect(kpi.cancelRate).toBeCloseTo(17.647, 1);
    });
  });

  describe('tabToApiParams', () => {
    it('maps REFUNDED tab to paymentStatus filter', () => {
      expect(tabToApiParams('REFUNDED')).toEqual({ paymentStatus: 'REFUNDED' });
    });

    it('maps ALL tab to empty params', () => {
      expect(tabToApiParams('ALL')).toEqual({});
    });

    it('maps order status tabs to status filter', () => {
      expect(tabToApiParams('PENDING')).toEqual({ status: 'PENDING' });
      expect(tabToApiParams('CONFIRMED')).toEqual({ status: 'CONFIRMED' });
      expect(tabToApiParams('PROCESSING')).toEqual({ status: 'PROCESSING' });
      expect(tabToApiParams('SHIPPED')).toEqual({ status: 'SHIPPED' });
      expect(tabToApiParams('DELIVERED')).toEqual({ status: 'DELIVERED' });
      expect(tabToApiParams('CANCELLED')).toEqual({ status: 'CANCELLED' });
    });
  });
});