import { describe, expect, it } from 'vitest';
import { Injectable } from '@angular/core';
import { TestBed, type ComponentFixture } from '@angular/core/testing';
import { provideTransloco, TranslocoLoader, TranslocoService } from '@jsverse/transloco';
import { of } from 'rxjs';
import { OrderBulkStatusDialogComponent } from './order-bulk-status-dialog.component';
import { LanguageService } from '../../../../core/i18n/language.service';
import type { BulkStatusRow } from '../../utils/bulk-status';

/** An empty dictionary: the wording comes from `DICT` below, not the network. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

/**
 * FE-18 — the bulk status dialog as the admin sees it.
 *
 * The decision layer is covered by `utils/bulk-status.spec.ts`; this renders
 * the dialog so the pieces that only exist in the template (which statuses
 * are listed, which radios are disabled, what the primary button says) are
 * asserted too.
 */

const DICT: Record<string, string> = {
  'orders.bulk.selected': '{{count}} selected',
  'orders.bulk.changeStatus': 'Change status',
  'orders.bulk.dialog.description': 'One request updates the selection.',
  'orders.bulk.dialog.selectLabel': 'New status',
  'orders.bulk.dialog.hint': 'Skipped rows are listed afterwards.',
  'orders.bulk.dialog.cancelNote': 'Cancelling stays per order.',
  'orders.bulk.dialog.noOptions': 'None can change status.',
  'orders.bulk.eligible_one': '{{count}} selected order can move to this status',
  'orders.bulk.eligible_other': '{{count}} selected orders can move to this status',
  'orders.bulk.notEligible': 'No selected order can move to this status',
  'orders.bulk.updateCount_one': 'Update {{count}} order',
  'orders.bulk.updateCount_other': 'Update {{count}} orders',
  'orders.bulk.sending': 'Sending the change…',
  'orders.dialogs.status.confirm': 'Update status',
  'orders.statuses.PENDING': 'Pending',
  'orders.statuses.CONFIRMED': 'Confirmed',
  'orders.statuses.PROCESSING': 'Processing',
  'orders.statuses.SHIPPED': 'Shipped',
  'orders.statuses.DELIVERED': 'Delivered',
  'common.cancel': 'Cancel',
};

const translate = (key: string, params?: Record<string, unknown>): string => {
  const template = DICT[key];
  if (!template) return key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => String(params?.[name] ?? ''));
};

const rows: BulkStatusRow[] = [
  { id: 1, orderNumber: 'ORD-2026-000001', status: 'PENDING' },
  { id: 2, orderNumber: 'ORD-2026-000002', status: 'PENDING' },
  { id: 3, orderNumber: 'ORD-2026-000003', status: 'CONFIRMED' },
  { id: 4, orderNumber: 'ORD-2026-000004', status: 'SHIPPED' },
  { id: 5, orderNumber: 'ORD-2026-000005', status: 'DELIVERED' },
];

async function mount(inputs: {
  rows?: BulkStatusRow[];
  open?: boolean;
  pending?: boolean;
}): Promise<ComponentFixture<OrderBulkStatusDialogComponent>> {
  await TestBed.configureTestingModule({
    imports: [OrderBulkStatusDialogComponent],
    providers: [
      provideTransloco({
        config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
        loader: EmptyLoader,
      }),
      { provide: LanguageService, useValue: { current: () => 'en', language: () => 'en' } },
    ],
  }).compileComponents();

  // The dictionary the dialog reads: the real keys, fixed English wording.
  TestBed.inject(TranslocoService).setTranslation(DICT, 'en');

  const fixture = TestBed.createComponent(OrderBulkStatusDialogComponent);
  fixture.componentRef.setInput('open', inputs.open ?? true);
  fixture.componentRef.setInput('rows', inputs.rows ?? rows);
  if (inputs.pending !== undefined) fixture.componentRef.setInput('pending', inputs.pending);
  fixture.detectChanges();
  return fixture;
}

describe('OrderBulkStatusDialogComponent', () => {
  it('lists the whole fulfilment vocabulary with the count each status would change', async () => {
    const fixture = await mount({});
    const element = fixture.nativeElement as HTMLElement;

    const options = element.querySelectorAll('[data-testid^="bulk-status-eligible-"]');
    expect(options).toHaveLength(5);

    const text = (status: string): string =>
      element.querySelector(`[data-testid="bulk-status-eligible-${status}"]`)?.textContent?.trim() ??
      '';

    expect(text('CONFIRMED')).toBe('2 selected orders can move to this status');
    expect(text('PROCESSING')).toBe('1 selected order can move to this status');
    expect(text('DELIVERED')).toBe('1 selected order can move to this status');
    // Nothing in this selection moves INTO Pending, so it is explained, not hidden.
    expect(text('PENDING')).toBe('No selected order can move to this status');
  });

  it('disables the statuses the selection cannot reach', async () => {
    const fixture = await mount({});
    const element = fixture.nativeElement as HTMLElement;
    const radio = (status: string): HTMLInputElement =>
      element.querySelector(`input#bulk-status-${status}`) as HTMLInputElement;

    expect(radio('PENDING').disabled).toBe(true);
    expect(radio('CONFIRMED').disabled).toBe(false);
  });

  it('names the action and the count on the primary button', async () => {
    const fixture = await mount({});
    const component = fixture.componentInstance as unknown as {
      pick: (value: unknown) => void;
      confirmLabel: () => string;
      canConfirm: () => boolean;
    };

    expect(component.confirmLabel()).toBe('Update status');
    expect(component.canConfirm()).toBe(false);

    component.pick('CONFIRMED');
    fixture.detectChanges();

    expect(component.confirmLabel()).toBe('Update 2 orders');
    expect(component.canConfirm()).toBe(true);
  });

  it('ignores a status the selection cannot reach', async () => {
    const fixture = await mount({});
    const component = fixture.componentInstance as unknown as {
      pick: (value: unknown) => void;
      selected: () => string | null;
    };

    component.pick('PENDING');
    expect(component.selected()).toBeNull();

    component.pick('CONFIRMED');
    expect(component.selected()).toBe('CONFIRMED');
  });

  it('explains an exhausted selection instead of offering an empty picker', async () => {
    const fixture = await mount({
      rows: [
        { id: 1, orderNumber: 'ORD-2026-000001', status: 'DELIVERED' },
        { id: 2, orderNumber: 'ORD-2026-000002', status: 'CANCELLED' },
      ],
    });
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="bulk-status-options"]')).toBeNull();
    expect(element.querySelector('[data-testid="bulk-status-no-options"]')?.textContent).toContain(
      'None can change status.',
    );
  });

  it('says the batch is one request while it is in flight, and locks the picker', async () => {
    const fixture = await mount({ pending: true });
    const element = fixture.nativeElement as HTMLElement;

    // No per-row counter: the change is sent in one request.
    expect(element.querySelector('[data-testid="bulk-status-sending"]')?.textContent).toContain(
      'Sending the change…',
    );

    const confirm = element.querySelector(
      '[data-testid="bulk-status-dialog-confirm"]',
    ) as HTMLButtonElement;
    expect(confirm.disabled).toBe(true);
    expect((element.querySelector('input#bulk-status-CONFIRMED') as HTMLInputElement).disabled).toBe(
      true,
    );
  });
});
