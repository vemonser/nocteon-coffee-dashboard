import { describe, expect, it } from 'vitest';
import { buildOrderEvents } from './order-activity.adapter';

const placedAt = '2026-10-20T05:49:48Z';

describe('buildOrderEvents', () => {
  it('emits the placement from the order timestamp when history is empty', () => {
    const events = buildOrderEvents({ order: { createdAt: placedAt }, history: [] });
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe('placed');
    expect(events[0].at).toBe(placedAt);
  });

  it('does not duplicate placement when history already has a from-nothing row', () => {
    const events = buildOrderEvents({
      order: { createdAt: placedAt },
      history: [
        {
          id: 1,
          fromStatus: null,
          toStatus: 'PENDING',
          note: null,
          changedBy: 'system',
          notifyCustomer: false,
          createdAt: placedAt,
        },
      ],
    });
    expect(events.filter((e) => e.kind === 'placed')).toHaveLength(0);
    expect(events).toHaveLength(1);
    expect(events[0].fromStatus).toBeNull();
    expect(events[0].toStatus).toBe('PENDING');
    expect(events[0].actor).toBe('system');
  });

  it('never puts an undated payment on the timeline', () => {
    const events = buildOrderEvents({
      order: { createdAt: placedAt },
      payment: { paidAt: null, amount: 500 },
    });
    expect(events.some((e) => e.kind === 'payment')).toBe(false);
  });

  it('places payment, shipment, refund and note events newest first', () => {
    const events = buildOrderEvents({
      order: { createdAt: placedAt },
      payment: { paidAt: '2026-10-20T06:00:00Z', amount: 500 },
      shipment: { shippedAt: '2026-10-20T10:00:00Z', deliveredAt: '2026-10-21T09:00:00Z' },
      refunds: [
        { id: 7, amount: 100, reason: 'damaged', createdBy: 'admin', createdAt: '2026-10-22T09:00:00Z' },
      ],
      notes: [{ id: 3, body: 'Called the customer', author: 'admin', createdAt: '2026-10-21T12:00:00Z' }],
    });

    expect(events.map((e) => e.kind)).toEqual([
      'refund',
      'note',
      'shipment',
      'shipment',
      'payment',
      'placed',
    ]);
    expect(events[0].amount).toBe(100);
    expect(events[3].shipmentStage).toBe('shipped');
    expect(events[4].amount).toBe(500);
  });

  it('orders by instant, not by the ISO string', () => {
    // Lexicographically "05:00+02:00" > "04:00Z", but the first is 03:00Z —
    // the second is the later event and must come first.
    const events = buildOrderEvents({
      order: { createdAt: '2026-10-20T03:00:00Z' },
      notes: [
        { id: 1, body: '+02 line', author: 'a', createdAt: '2026-10-20T05:00:00+02:00' },
        { id: 2, body: 'Z line', author: 'a', createdAt: '2026-10-20T04:00:00Z' },
      ],
    });
    // `placed` and `note-1` are the same instant; the stable sort keeps the
    // placement first. A lexicographic sort would have put `note-1` first.
    expect(events.map((e) => e.id)).toEqual(['note-2', 'placed', 'note-1']);
  });

  it('carries the refund reason and the note author through', () => {
    const events = buildOrderEvents({
      order: { createdAt: placedAt },
      refunds: [
        { id: 1, amount: 50, reason: 'late', createdBy: 'ops@store', createdAt: '2026-10-22T09:00:00Z' },
      ],
      notes: [{ id: 2, body: 'VIP', author: 'ops@store', createdAt: '2026-10-21T09:00:00Z' }],
    });
    const refund = events.find((e) => e.kind === 'refund');
    const note = events.find((e) => e.kind === 'note');
    expect(refund?.detail).toBe('late');
    expect(refund?.actor).toBe('ops@store');
    expect(note?.detail).toBe('VIP');
    expect(note?.actor).toBe('ops@store');
  });
});

describe('buildOrderEvents — returns (FE-20)', () => {
  const returnRows = [
    {
      id: 10,
      fromStatus: null,
      toStatus: 'DELIVERED',
      note: '2 × Ethiopia Yirgacheffe',
      changedBy: 'ops@store',
      notifyCustomer: false,
      eventType: 'RETURN_REQUESTED',
      createdAt: '2026-10-23T09:00:00Z',
    },
    {
      id: 11,
      fromStatus: null,
      toStatus: 'DELIVERED',
      note: '2 × Ethiopia Yirgacheffe',
      changedBy: 'ops@store',
      notifyCustomer: false,
      eventType: 'RETURN_APPROVED',
      createdAt: '2026-10-24T09:00:00Z',
    },
  ];

  it('draws a return row as a return event, never as a status change', () => {
    const events = buildOrderEvents({ order: { createdAt: placedAt }, history: returnRows });

    expect(events.filter((e) => e.kind === 'status')).toHaveLength(0);
    expect(events.filter((e) => e.kind === 'return').map((e) => e.returnEvent)).toEqual([
      'RETURN_APPROVED',
      'RETURN_REQUESTED',
    ]);
    const approved = events.find((e) => e.returnEvent === 'RETURN_APPROVED');
    expect(approved?.detail).toBe('2 × Ethiopia Yirgacheffe');
    expect(approved?.actor).toBe('ops@store');
  });

  /**
   * A return row has a null fromStatus, exactly like the "order placed" row —
   * and it must NOT be mistaken for it.
   */
  it('does not let a return row suppress the placement', () => {
    const events = buildOrderEvents({ order: { createdAt: placedAt }, history: returnRows });
    expect(events.filter((e) => e.kind === 'placed')).toHaveLength(1);
  });

  /**
   * A return row carries the order's status AT THE TIME. On a delivered order
   * it must not be read as the delivery milestone, which would swallow the
   * shipment event.
   */
  it('does not let a return row hide the shipment milestone', () => {
    const events = buildOrderEvents({
      order: { createdAt: placedAt },
      history: returnRows,
      shipment: { shippedAt: '2026-10-22T08:00:00Z', deliveredAt: '2026-10-23T08:00:00Z' },
    });
    expect(events.filter((e) => e.kind === 'shipment')).toHaveLength(2);
  });
});
