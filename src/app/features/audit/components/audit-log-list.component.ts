import { CommonModule } from '@angular/common';
import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';

import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideClipboard,
  lucideEye,
  lucideFileSearch,
  lucideRefreshCw,
  lucideScrollText,
  lucideSearch,
  lucideX,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';

import { NotifyService } from '../../../core/notify/notify.service';
import { PermissionService } from '../../../core/auth/permission.service';
import { PageResponse } from '../../../core/models/api-response.model';
import { PagerComponent } from '../../../shared/components/pager/pager.component';
import { PluralPipe } from '../../../shared/pipes/plural.pipe';
import { LocalizedDateComponent } from '../../../shared/ui/localized-date/localized-date.component';
import { DialogShellComponent } from '../../../shared/ui/dialog-shell/dialog-shell.component';
import {
  AUDIT_DETAIL_FIELDS,
  AUDIT_DETAIL_LABEL,
  AuditDetailField,
  AuditLogEntry,
} from '../models/audit-log.model';
import { AuditLogService } from '../services/audit-log.service';
import { endOfDayIso, startOfDayIso } from '../utils/audit-date-range';

/**
 * The audit log: what the dashboard recorded, newest first.
 *
 * <p>READ-ONLY, by design. The table is the record of what happened, so there
 * is no edit, no delete and no bulk bar — the only row action opens the detail.
 *
 * <p>The filters are the three questions an auditor actually asks: which
 * action, by whom, and when. Everything lives in the URL, so a filtered view
 * survives a refresh and can be sent to a colleague.
 */
@Component({
  selector: 'app-audit-log-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    HlmButtonImports,
    HlmInputImports,
    HlmBadgeImports,
    PagerComponent,
    PluralPipe,
    LocalizedDateComponent,
    DialogShellComponent,
    NgIcon,
    TranslocoPipe,
  ],
  providers: [
    provideIcons({
      lucideClipboard,
      lucideEye,
      lucideFileSearch,
      lucideRefreshCw,
      lucideScrollText,
      lucideSearch,
      lucideX,
    }),
  ],
  templateUrl: './audit-log-list.component.html',
})
export class AuditLogListComponent {
  private readonly service = inject(AuditLogService);
  private readonly notify = inject(NotifyService);
  private readonly permission = inject(PermissionService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly transloco = inject(TranslocoService);

  protected readonly detailFields = AUDIT_DETAIL_FIELDS;
  protected readonly detailLabel = AUDIT_DETAIL_LABEL;

  readonly items = signal<AuditLogEntry[]>([]);
  readonly pageData = signal<PageResponse<AuditLogEntry> | null>(null);
  readonly loading = signal(false);
  readonly failed = signal(false);

  readonly action = signal('');
  readonly actor = signal('');
  readonly from = signal('');
  readonly to = signal('');
  readonly page = signal(0);
  readonly size = signal(20);
  protected readonly pageSizeOptions = [10, 20, 50] as const;

  /** The row whose detail drawer is open. */
  readonly selected = signal<AuditLogEntry | null>(null);

  readonly totalElements = computed(() => this.pageData()?.totalElements ?? 0);
  readonly pageCount = computed(() => this.pageData()?.totalPages ?? 0);

  readonly hasActiveFilters = computed(
    () => this.action().trim() !== '' || this.actor().trim() !== '' || this.from() !== '' || this.to() !== '',
  );

  readonly detailTitle = computed(() => {
    const entry = this.selected();
    return entry
      ? this.transloco.translate('audit.detail.title', { id: entry.id })
      : '';
  });

  /**
   * The JSON blocks the drawer shows, prettified.
   *
   * A stored value that is not valid JSON is shown AS IT WAS RECORDED rather
   * than hidden: an audit record that will not parse is exactly the record an
   * auditor must see.
   */
  readonly detailJson = computed<Array<{ field: AuditDetailField; label: string; text: string }>>(() => {
    const entry = this.selected();
    if (!entry) return [];
    const blocks: Array<{ field: AuditDetailField; label: string; text: string }> = [];
    for (const field of AUDIT_DETAIL_FIELDS) {
      const raw = entry[field];
      if (raw === null || raw === undefined || raw === '') continue;
      blocks.push({ field, label: AUDIT_DETAIL_LABEL[field], text: prettifyJson(raw) });
    }
    return blocks;
  });

  private searchTimeout: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    const query = this.route.snapshot.queryParamMap;
    this.action.set(query.get('action') ?? '');
    this.actor.set(query.get('actor') ?? '');
    this.from.set(query.get('from') ?? '');
    this.to.set(query.get('to') ?? '');
    const page = Number(query.get('page'));
    this.page.set(Number.isFinite(page) && page > 0 ? page : 0);
    this.load();
  }

  // ── loading ───────────────────────────────────────────────────────────────

  protected load(): void {
    // The route guard is the gate; this is the second lock. A tab left open
    // while the permission was revoked must not keep asking the server for a
    // list it can only answer with 403.
    if (!this.permission.has('audit:read')) {
      this.loading.set(false);
      this.failed.set(true);
      this.items.set([]);
      this.pageData.set(null);
      return;
    }

    this.loading.set(true);
    this.failed.set(false);
    this.service
      .getPage({
        page: this.page(),
        size: this.size(),
        sort: 'createdAt',
        direction: 'desc',
        action: this.action() || undefined,
        actor: this.actor() || undefined,
        since: startOfDayIso(this.from()),
        until: endOfDayIso(this.to()),
      })
      .subscribe({
        next: (response) => {
          this.items.set(response.data?.content ?? []);
          this.pageData.set(response.data ?? null);
          this.loading.set(false);
        },
        error: (error) => {
          this.items.set([]);
          this.pageData.set(null);
          this.loading.set(false);
          this.failed.set(true);
          // A 403 is already announced once by the auth interceptor; a second
          // toast would be the same sentence twice.
          if (error?.status !== 403) {
            this.notify.apiError(error, 'audit.loadError', 'The audit log could not be loaded');
          }
        },
      });
  }

  protected retry(): void {
    this.load();
  }

  // ── filters ───────────────────────────────────────────────────────────────

  /** Text filters are debounced: one request per pause, not per keystroke. */
  protected onActionInput(value: string): void {
    this.action.set(value);
    this.debouncedReload();
  }

  protected onActorInput(value: string): void {
    this.actor.set(value);
    this.debouncedReload();
  }

  /** A date is a complete value, so it reloads at once. */
  protected onDateChange(): void {
    this.page.set(0);
    this.writeUrl();
    this.load();
  }

  protected clearFilters(): void {
    this.action.set('');
    this.actor.set('');
    this.from.set('');
    this.to.set('');
    this.page.set(0);
    this.writeUrl();
    this.load();
  }

  private debouncedReload(): void {
    clearTimeout(this.searchTimeout);
    this.searchTimeout = setTimeout(() => {
      this.page.set(0);
      this.writeUrl();
      this.load();
    }, 300);
  }

  private writeUrl(): void {
    const params: Record<string, string> = {};
    if (this.action().trim()) params['action'] = this.action().trim();
    if (this.actor().trim()) params['actor'] = this.actor().trim();
    if (this.from()) params['from'] = this.from();
    if (this.to()) params['to'] = this.to();
    if (this.page() > 0) params['page'] = String(this.page());
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: params,
      replaceUrl: true,
    });
  }

  // ── pagination ────────────────────────────────────────────────────────────

  protected goToPage(page: number): void {
    if (page < 0 || (this.pageCount() > 0 && page >= this.pageCount())) return;
    this.page.set(page);
    this.writeUrl();
    this.load();
  }

  protected onPageSizeChange(size: number): void {
    if (size === this.size()) return;
    this.size.set(size);
    this.page.set(0);
    this.writeUrl();
    this.load();
  }

  // ── the detail drawer ─────────────────────────────────────────────────────

  protected openDetail(entry: AuditLogEntry): void {
    this.selected.set(entry);
  }

  protected closeDetail(): void {
    this.selected.set(null);
  }

  /** Copy one block of JSON exactly as it was recorded. */
  protected async copyDetail(text: string): Promise<void> {
    try {
      await navigator.clipboard?.writeText(text);
      this.notify.success('audit.detail.copied', 'Copied');
    } catch {
      this.notify.error('audit.detail.copyFailed', 'Could not copy');
    }
  }

  // ── presentation helpers ──────────────────────────────────────────────────

  /** The actor the row recorded: the email, the id, or the system. */
  protected actorLabel(entry: AuditLogEntry): string {
    if (entry.userEmail) return entry.userEmail;
    if (entry.userId !== null && entry.userId !== undefined) return `#${entry.userId}`;
    return this.transloco.translate('audit.systemActor');
  }

  /** What the row acted on: `product #102`, a slug, or nothing. */
  protected entityLabel(entry: AuditLogEntry): string {
    const parts: string[] = [];
    if (entry.entityType) parts.push(entry.entityType);
    if (entry.entitySlug) parts.push(entry.entitySlug);
    else if (entry.entityId !== null && entry.entityId !== undefined) parts.push(`#${entry.entityId}`);
    return parts.join(' ');
  }
}

/**
 * Stored JSON, indented for reading.
 *
 * <p>The drawer must not print one endless line: a `metadata` blob of 600
 * characters is unreadable flat. When the text will not parse it is returned
 * untouched — showing nothing would hide the one record that matters.
 */
export function prettifyJson(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2);
  } catch {
    return raw;
  }
}
