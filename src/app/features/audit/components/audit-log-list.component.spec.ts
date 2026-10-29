import { describe, expect, it, vi } from 'vitest';
import { Injectable } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TranslocoLoader, TranslocoService, provideTransloco } from '@jsverse/transloco';
import { of, throwError } from 'rxjs';

import { AuditLogListComponent, prettifyJson } from './audit-log-list.component';
import { AuditLogService } from '../services/audit-log.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { LanguageService } from '../../../core/i18n/language.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { AuditLogEntry, AuditLogQuery } from '../models/audit-log.model';

/** An empty dictionary: the wording comes from `DICT` below, not the network. */
@Injectable()
class EmptyLoader implements TranslocoLoader {
  getTranslation() {
    return of({});
  }
}

/** The keys the page renders, so the assertions read real words. */
const DICT: Record<string, string> = {
  'audit.title': 'Audit log',
  'audit.subtitle': 'Nothing here can be edited.',
  'audit.countEntries_one': '{{count}} entry',
  'audit.countEntries_other': '{{count}} entries',
  'audit.filters.action': 'Filter by action',
  'audit.filters.actor': 'User id or email',
  'audit.filters.from': 'From date',
  'audit.filters.to': 'To date',
  'audit.filters.clear': 'Clear filters',
  'audit.columns.time': 'Time',
  'audit.columns.action': 'Action',
  'audit.columns.actor': 'Actor',
  'audit.columns.entity': 'Entity',
  'audit.systemActor': 'System',
  'audit.failed': 'Failed',
  'audit.view': 'View detail',
  'audit.emptyTitle': 'No audit entries yet',
  'audit.emptyBody': 'Actions taken in the dashboard appear here.',
  'audit.emptyFilteredTitle': 'No entries match these filters',
  'audit.emptyFilteredBody': 'Try another action, actor or date range.',
  'audit.loadError': 'The audit log could not be loaded',
  'audit.detail.title': 'Audit entry #{{id}}',
  'audit.detail.subtitle': 'What was recorded.',
  'audit.detail.time': 'Time',
  'audit.detail.actor': 'Actor',
  'audit.detail.action': 'Action',
  'audit.detail.entity': 'Entity',
  'audit.detail.result': 'Result',
  'audit.detail.succeeded': 'Succeeded',
  'audit.detail.failed': 'Failed',
  'audit.detail.oldValues': 'Old values',
  'audit.detail.newValues': 'New values',
  'audit.detail.metadata': 'Metadata',
  'audit.detail.noDetail': 'This entry stored no values.',
  'audit.detail.copy': 'Copy JSON',
  'audit.detail.copied': 'Copied to the clipboard',
  'audit.detail.close': 'Close',
  'common.loadFailedHint': 'Check your connection and try again.',
  'common.retry': 'Retry',
  'common.actions': 'Actions',
};

type Spy = ReturnType<typeof vi.fn>;

interface NotifyMock {
  success: Spy;
  error: Spy;
  warning: Spy;
  apiError: Spy;
  apiSuccess: Spy;
  t: (key: string, fallback: string) => string;
}

function entry(overrides: Partial<AuditLogEntry> = {}): AuditLogEntry {
  return {
    id: 1,
    userId: 7,
    userEmail: 'admin@example.test',
    action: 'PRODUCT_UPDATE',
    entityType: 'product',
    entityId: 102,
    entitySlug: null,
    ipAddress: '127.0.0.1',
    userAgent: 'vitest',
    oldValues: '{"price":1.00}',
    newValues: '{"price":1.50}',
    metadata: null,
    success: true,
    errorMessage: null,
    createdAt: '2026-03-02T09:00:00Z',
    ...overrides,
  };
}

function page(content: AuditLogEntry[], totalElements = content.length) {
  return {
    success: true,
    message: 'ok',
    data: {
      content,
      page: 0,
      size: 20,
      totalElements,
      totalPages: Math.max(1, Math.ceil(totalElements / 20)),
      first: true,
      last: true,
    },
  };
}

/** A service whose one method records the query it was handed. */
function auditService(respond: (query: AuditLogQuery) => unknown) {
  return { getPage: vi.fn((query: AuditLogQuery) => respond(query)) };
}

async function mount(
  service: { getPage: Spy },
  options: { canRead?: boolean } = {},
): Promise<{
  fixture: ComponentFixture<AuditLogListComponent>;
  // The members under test are `protected` in the component (they are for the
  // template, not the API), so the spec reaches them through the instance.
  component: any;
  notify: NotifyMock;
}> {
  const canRead = options.canRead ?? true;
  const notify: NotifyMock = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    apiError: vi.fn(),
    apiSuccess: vi.fn(),
    t: (_key: string, fallback: string) => fallback,
  };
  await TestBed.configureTestingModule({
    imports: [AuditLogListComponent],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideTransloco({
        config: { availableLangs: ['en', 'ar'], defaultLang: 'en', reRenderOnLangChange: true },
        loader: EmptyLoader,
      }),
      { provide: AuditLogService, useValue: service },
      { provide: NotifyService, useValue: notify },
      { provide: LanguageService, useValue: { language: () => 'en', current: () => 'en' } },
      { provide: PermissionService, useValue: { has: () => canRead } },
    ],
  }).compileComponents();

  // The dictionary the page reads: the real keys, fixed English wording.
  TestBed.inject(TranslocoService).setTranslation(DICT, 'en');

  const fixture = TestBed.createComponent(AuditLogListComponent);
  fixture.detectChanges();
  return {
    fixture,
    component: fixture.componentInstance,
    notify,
  };
}

describe('audit log list', () => {
  it('renders one row per entry and shows the count the server reported', async () => {
    const service = auditService(() => of(page([entry(), entry({ id: 2 })], 312)));
    const { component } = await mount(service);

    expect(service.getPage).toHaveBeenCalledTimes(1);
    expect(component.items().length).toBe(2);
    expect(component.totalElements()).toBe(312);
    expect(component.loading()).toBe(false);
  });

  it('asks for page 0 and newest first, with no filters on a first visit', async () => {
    const service = auditService(() => of(page([])));
    await mount(service);

    expect(service.getPage.mock.calls[0][0]).toEqual({
      page: 0,
      size: 20,
      sort: 'createdAt',
      direction: 'desc',
      action: undefined,
      actor: undefined,
      since: undefined,
      until: undefined,
    });
  });

  it('sends the action and actor filters and resets to the first page', async () => {
    const service = auditService(() => of(page([entry()])));
    const { component } = await mount(service);
    service.getPage.mockClear();

    vi.useFakeTimers();
    component.onActionInput('product');
    component.onActorInput('admin@example.test');
    vi.advanceTimersByTime(400);
    vi.useRealTimers();

    // The two keystrokes are debounced into ONE request.
    expect(service.getPage).toHaveBeenCalledTimes(1);
    const query = service.getPage.mock.calls[0][0];
    expect(query.action).toBe('product');
    expect(query.actor).toBe('admin@example.test');
    expect(query.page).toBe(0);
  });

  it('widens a picked date to the whole local day', async () => {
    const service = auditService(() => of(page([])));
    const { component } = await mount(service);
    service.getPage.mockClear();

    component.from.set('2026-03-02');
    component.to.set('2026-03-03');
    component.onDateChange();

    const query = service.getPage.mock.calls[0][0];
    // Local midnight, converted to an instant: the day starts where the reader is.
    expect(query.since).toBe(new Date(2026, 2, 2, 0, 0, 0, 0).toISOString());
    expect(query.until).toBe(new Date(2026, 2, 3, 23, 59, 59, 999).toISOString());
  });

  it('clears every filter at once', async () => {
    const service = auditService(() => of(page([])));
    const { component } = await mount(service);

    component.action.set('product');
    component.actor.set('7');
    component.from.set('2026-03-02');
    component.to.set('2026-03-03');
    expect(component.hasActiveFilters()).toBe(true);

    component.clearFilters();

    expect(component.hasActiveFilters()).toBe(false);
    expect(component.action()).toBe('');
    const query = service.getPage.mock.calls[service.getPage.mock.calls.length - 1][0];
    expect(query.action).toBeUndefined();
    expect(query.actor).toBeUndefined();
    expect(query.since).toBeUndefined();
  });

  it('shows the error state and retries from it', async () => {
    const service = { getPage: vi.fn() };
    service.getPage.mockReturnValueOnce(throwError(() => new Error('boom')));
    service.getPage.mockReturnValueOnce(of(page([entry()])));
    const { component, notify } = await mount(service);

    expect(component.failed()).toBe(true);
    expect(notify.apiError).toHaveBeenCalled();

    component.retry();

    expect(component.failed()).toBe(false);
    expect(component.items().length).toBe(1);
  });

  it('opens the drawer with the record and its prettified JSON', async () => {
    const service = auditService(() => of(page([entry()])));
    const { component } = await mount(service);

    component.openDetail(entry());
    expect(component.selected()?.id).toBe(1);
    expect(component.detailTitle()).toBe('Audit entry #1');

    const blocks = component.detailJson();
    expect(blocks.map((block: { field: string }) => block.field)).toEqual(['oldValues', 'newValues']);
    // Indented, not one endless line — and the values are the stored ones.
    expect(blocks[0].text).toBe('{\n  "price": 1\n}');

    component.closeDetail();
    expect(component.selected()).toBeNull();
  });

  it('leaves a detail that will not parse exactly as it was recorded', async () => {
    const service = auditService(() => of(page([])));
    const { component } = await mount(service);

    component.openDetail(entry({ oldValues: '{not json', newValues: null, metadata: null }));

    expect(component.detailJson()).toEqual([
      { field: 'oldValues', label: 'audit.detail.oldValues', text: '{not json' },
    ]);
  });

  it('names the actor from the email, falls back to the id, then to the system', async () => {
    const service = auditService(() => of(page([])));
    const { component } = await mount(service);

    expect(component.actorLabel(entry())).toBe('admin@example.test');
    expect(component.actorLabel(entry({ userEmail: null }))).toBe('#7');
    expect(component.actorLabel(entry({ userEmail: null, userId: null }))).toBe('System');
  });

  it('describes the entity it acted on', async () => {
    const service = auditService(() => of(page([])));
    const { component } = await mount(service);

    expect(component.entityLabel(entry())).toBe('product #102');
    expect(component.entityLabel(entry({ entitySlug: 'kenya-aa' }))).toBe('product kenya-aa');
    expect(component.entityLabel(entry({ entityType: null, entityId: null }))).toBe('');
  });

  it('does not ask the server when the reader lost audit:read', async () => {
    const service = auditService(() => of(page([entry()])));
    const { component } = await mount(service, { canRead: false });

    expect(service.getPage).not.toHaveBeenCalled();
    expect(component.failed()).toBe(true);
    expect(component.items()).toEqual([]);
  });

  it('does not toast the same 403 the interceptor already showed', async () => {
    const service = { getPage: vi.fn() };
    service.getPage.mockReturnValueOnce(throwError(() => ({ status: 403 })));
    const { component, notify } = await mount(service);

    expect(component.failed()).toBe(true);
    expect(notify.apiError).not.toHaveBeenCalled();
  });
});

describe('prettifyJson', () => {
  it('indents valid JSON and keeps the key order', () => {
    expect(prettifyJson('{"b":1,"a":2}')).toBe('{\n  "b": 1,\n  "a": 2\n}');
  });

  it('returns unparseable text untouched', () => {
    expect(prettifyJson('nope')).toBe('nope');
  });
});

describe('the rendered page', () => {
  it('renders one 72px row per entry, with the shared 38px filter controls', async () => {
    const service = auditService(() => of(page([entry(), entry({ id: 2, action: 'USER_LOGIN' })], 312)));
    const { fixture } = await mount(service);
    const element = fixture.nativeElement as HTMLElement;

    const rows = element.querySelectorAll('[data-testid^="audit-row-"]');
    expect(rows).toHaveLength(2);
    expect(rows[0].className).toContain('h-[72px]');

    for (const testId of ['audit-filter-action', 'audit-filter-actor', 'audit-filter-from', 'audit-filter-to']) {
      const control = element.querySelector(`[data-testid="${testId}"]`);
      expect(control?.className).toContain('h-[var(--filter-control-height)]');
    }

    // The count names the whole result set, not this page's rows.
    expect(element.textContent).toContain('312 entries');
  });

  it('shows the designed empty state when the log has no rows', async () => {
    const service = auditService(() => of(page([])));
    const { fixture } = await mount(service);
    const element = fixture.nativeElement as HTMLElement;

    expect(element.querySelector('[data-testid="audit-empty"]')?.textContent).toContain(
      'No audit entries yet',
    );
  });

  it('shows the error state with a retry, and never the empty copy', async () => {
    const service = { getPage: vi.fn() };
    service.getPage.mockReturnValueOnce(throwError(() => new Error('boom')));
    const { fixture } = await mount(service);
    const element = fixture.nativeElement as HTMLElement;

    const error = element.querySelector('[data-testid="audit-error"]');
    expect(error?.getAttribute('role')).toBe('alert');
    expect(error?.textContent).toContain('The audit log could not be loaded');
    expect(error?.querySelector('button')?.textContent).toContain('Retry');
    expect(element.querySelector('[data-testid="audit-empty"]')).toBeNull();
  });

  it('renders the detail drawer with the record and the stored JSON', async () => {
    const service = auditService(() => of(page([entry()])));
    const { fixture, component } = await mount(service);

    component.openDetail(entry({ metadata: '{"reason":"stock  recount"}' }));
    fixture.detectChanges();

    const dialog = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-testid="audit-detail"]',
    );
    expect(dialog).not.toBeNull();
    expect(dialog?.getAttribute('role')).toBe('dialog');
    expect(dialog?.textContent).toContain('Audit entry #1');
    expect(dialog?.textContent).toContain('admin@example.test');

    const blocks = dialog?.querySelectorAll('pre') ?? [];
    expect(blocks).toHaveLength(3);
    // Readable, not one endless line — and the spacing is the stored spacing.
    expect(blocks[2].textContent).toContain('"reason": "stock  recount"');
    expect(blocks[2].textContent).toContain('\n  ');
  });
});
