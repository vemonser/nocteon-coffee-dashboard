import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HlmCheckboxImports } from '@spartan-ng/helm/checkbox';
import { HlmInputImports } from '@spartan-ng/helm/input';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { NgIcon, provideIcons } from '@ng-icons/core';
import {
  lucideChevronRight, lucideLock, lucideCheck, lucideMinus, lucideShieldAlert,
} from '@ng-icons/lucide';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { humanize } from '../../utils/permission.utils';
import { LanguageService } from '../../../core/i18n/language.service';
import {
  parsePermission, groupPermissions, domainOf, actionLabel, isSensitive, isStandardAction,
  STANDARD_ACTIONS, PERMISSION_DOMAINS,
} from '../../utils/permission.utils';

@Component({
  selector: 'app-permission-matrix',
  standalone: true,
  imports: [CommonModule, FormsModule, HlmCheckboxImports, HlmInputImports, HlmButtonImports, HlmBadgeImports, NgIcon, TranslocoPipe],
  providers: [provideIcons({ lucideChevronRight, lucideLock, lucideCheck, lucideMinus, lucideShieldAlert })],
  templateUrl: './permission-matrix.component.html',
})
export class PermissionMatrixComponent {
  private transloco = inject(TranslocoService);
  private language = inject(LanguageService);
  permissions = input.required<string[]>();
  grantedInput = input<Set<string> | string[]>(new Set());
  mode = input<'view' | 'edit'>('view');
  locked = input<Set<string> | string[]>(new Set());
  inherited = input<Set<string> | string[]>(new Set());
  /**
   * A view-mode grid cannot be edited, so it states that once — with a single
   * lock in the toolbar — instead of repeating a lock on every cell.
   */
  readOnlyLock = input<boolean>(true);

  grantedChange = output<Set<string>>();

  search = signal('');
  grantedOnly = signal(false);

  granted = signal<Set<string>>(new Set());
  collapsed = signal<Set<string>>(new Set(Object.keys(PERMISSION_DOMAINS)));

  constructor() {
    effect(() => {
      const g = this.grantedInput();
      this.granted.set(new Set(Array.isArray(g) ? g : Array.from(g)));
    });
  }

  lockedSet = computed(() => new Set(Array.isArray(this.locked()) ? this.locked() : Array.from(this.locked())));
  inheritedSet = computed(() => new Set(Array.isArray(this.inherited()) ? this.inherited() : Array.from(this.inherited())));

  grouped = computed(() => groupPermissions(this.permissions()));

  domains = computed(() => Object.keys(this.grouped()));
  objectKeys = (o: any) => Object.keys(o);
  STANDARD_ACTIONS = STANDARD_ACTIONS;

  filteredGrouped = computed(() => {
    const q = this.search().toLowerCase().trim();
    const grantedOnly = this.grantedOnly();
    const g = this.granted();
    const result: Record<string, Record<string, string[]>> = {};
    for (const [domain, resources] of Object.entries(this.grouped())) {
      const resOut: Record<string, string[]> = {};
      for (const [resource, slugs] of Object.entries(resources)) {
        const label = resource;
        let actions = slugs;
        if (grantedOnly) actions = actions.filter(s => g.has(s));
        if (q) {
          const matches = label.toLowerCase().includes(q) || resource.toLowerCase().includes(q) || slugs.some(s => s.toLowerCase().includes(q));
          if (!matches) continue;
        }
        if (actions.length) resOut[resource] = actions;
      }
      if (Object.keys(resOut).length) result[domain] = resOut;
    }
    return result;
  });

  total = computed(() => this.permissions().length);
  grantedCount = computed(() => this.granted().size);

  isCollapsed(domain: string): boolean { return this.collapsed().has(domain); }

  /**
   * One chevron, rotated rather than swapped: pointing right when collapsed,
   * down when open. In RTL "right" is the reading START, so the collapsed
   * arrow is mirrored to point the other way — down stays down in both.
   */
  chevronTransform(collapsed: boolean): string {
    if (!collapsed) return 'rotate(90deg)';
    return this.language.current() === 'ar' ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  actionColumnLabel(action: string): string {
    const key = `permissionMatrix.actions.${action}`;
    const val = this.transloco.translate(key);
    return typeof val === 'string' && val && val !== key ? val : humanize(action);
  }
  toggleDomain(domain: string): void {
    const s = new Set(this.collapsed());
    if (s.has(domain)) s.delete(domain); else s.add(domain);
    this.collapsed.set(s);
  }
  expandAll(): void { this.collapsed.set(new Set()); }
  collapseAll(): void { this.collapsed.set(new Set(this.domains())); }

  domainGranted(domain: string): number {
    const resources = this.grouped()[domain] ?? {};
    let n = 0;
    for (const slugs of Object.values(resources)) for (const s of slugs) if (this.granted().has(s)) n++;
    return n;
  }
  domainTotal(domain: string): number {
    const resources = this.grouped()[domain] ?? {};
    return Object.values(resources).reduce((a, b) => a + b.length, 0);
  }
  domainAllGranted(domain: string): boolean {
    return this.domainGranted(domain) === this.domainTotal(domain) && this.domainTotal(domain) > 0;
  }
  domainSomeGranted(domain: string): boolean {
    const g = this.domainGranted(domain); const t = this.domainTotal(domain);
    return g > 0 && g < t;
  }
  toggleDomainAll(domain: string, checked: boolean): void {
    if (this.mode() !== 'edit') return;
    const s = new Set(this.granted());
    const resources = this.grouped()[domain] ?? {};
    for (const slugs of Object.values(resources)) for (const slug of slugs) {
      if (this.lockedSet().has(slug)) continue;
      if (checked) s.add(slug); else s.delete(slug);
    }
    this.granted.set(s);
    this.grantedChange.emit(s);
  }

  standardAction(resource: string, action: string): string | undefined {
    const slugs = this.grouped()[domainOf(resource)]?.[resource] ?? [];
    return slugs.find(s => parsePermission(s).action === action);
  }

  specialActions(resource: string): string[] {
    const domain = domainOf(resource);
    const slugs = this.grouped()[domain]?.[resource] ?? [];
    return slugs.filter(s => !isStandardAction(parsePermission(s).action));
  }

  hasGranted(slug: string): boolean { return this.granted().has(slug); }

  isLocked(slug: string): boolean { return this.lockedSet().has(slug); }
  isInherited(slug: string): boolean { return this.inheritedSet().has(slug); }
  isExtra(slug: string): boolean { return this.hasGranted(slug) && !this.inheritedSet().has(slug) && this.inheritedSet().size > 0; }

  toggle(slug: string, checked: boolean): void {
    if (this.mode() !== 'edit' || this.isLocked(slug)) return;
    const s = new Set(this.granted());
    if (checked) s.add(slug); else s.delete(slug);
    this.granted.set(s);
    this.grantedChange.emit(s);
  }

  rowAllGranted(resource: string): boolean {
    const domain = domainOf(resource);
    const slugs = this.grouped()[domain]?.[resource] ?? [];
    return slugs.length > 0 && slugs.every(s => this.granted().has(s));
  }
  rowSomeGranted(resource: string): boolean {
    const domain = domainOf(resource);
    const slugs = this.grouped()[domain]?.[resource] ?? [];
    const g = slugs.filter(s => this.granted().has(s)).length;
    return g > 0 && g < slugs.length;
  }
  toggleRow(resource: string, checked: boolean): void {
    if (this.mode() !== 'edit') return;
    const domain = domainOf(resource);
    const slugs = this.grouped()[domain]?.[resource] ?? [];
    const s = new Set(this.granted());
    for (const slug of slugs) {
      if (this.lockedSet().has(slug)) continue;
      if (checked) s.add(slug); else s.delete(slug);
    }
    this.granted.set(s);
    this.grantedChange.emit(s);
  }

  columnAllGranted(action: string): boolean {
    const slugs = this.allSlugsForAction(action);
    return slugs.length > 0 && slugs.every(s => this.granted().has(s));
  }
  columnSomeGranted(action: string): boolean {
    const slugs = this.allSlugsForAction(action);
    const g = slugs.filter(s => this.granted().has(s)).length;
    return g > 0 && g < slugs.length;
  }
  toggleColumn(action: string, checked: boolean): void {
    if (this.mode() !== 'edit') return;
    const s = new Set(this.granted());
    for (const slug of this.allSlugsForAction(action)) {
      if (this.lockedSet().has(slug)) continue;
      if (checked) s.add(slug); else s.delete(slug);
    }
    this.granted.set(s);
    this.grantedChange.emit(s);
  }

  private allSlugsForAction(action: string): string[] {
    const out: string[] = [];
    for (const resources of Object.values(this.grouped())) for (const slugs of Object.values(resources)) for (const s of slugs) if (parsePermission(s).action === action) out.push(s);
    return out;
  }

  showFullAccessBanner = computed(() => this.mode() === 'view' && this.grantedCount() === this.total() && this.total() > 0);
  isSensitive = (slug: string) => isSensitive(slug);
  humanizeResource = (resource: string) => humanize(resource);
  resourceLabel = (resource: string) => {
    const key = 'permissions.resources.' + resource;
    const val = this.transloco.translate(key);
    return typeof val === 'string' && val && val !== key ? val : humanize(resource);
  };
  actionLabel = (slug: string) => actionLabel(slug);
}
