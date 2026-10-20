import { ChangeDetectionStrategy, Component, DestroyRef, ElementRef, HostListener, computed, effect, inject, model, signal, viewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { NgIcon, provideIcons } from '@ng-icons/core';
import { lucideSearch, lucideX, lucidePackage, lucideShoppingCart, lucideUsers, lucideTag, lucideStar, lucideMail, lucidePlus, lucideArrowUp, lucideArrowDown, lucideCornerDownLeft, lucideCoffee } from '@ng-icons/lucide';
import { HlmButtonImports } from '@spartan-ng/helm/button';
import { HlmBadgeImports } from '@spartan-ng/helm/badge';
import { HlmSeparatorImports } from '@spartan-ng/helm/separator';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { toObservable } from '@angular/core/rxjs-interop';
import { debounceTime, distinctUntilChanged, switchMap, catchError, of } from 'rxjs';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { LanguageService } from '../../../../core/i18n/language.service';
import { StatusBadgeComponent } from '../../../../shared/ui/status-badge/status-badge.component';
import { RatingStarsComponent } from '../../../../shared/ui/rating-stars/rating-stars.component';
import { GlobalSearchService } from './service/global-search.service';
import { SearchResultGroup, SearchResultItem, SearchResponse } from './model/search.model';

const RECENT_KEY = 'nocteon.globalSearch.recent';

@Component({
  selector: 'app-global-search-palette',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [CommonModule, RouterModule, FormsModule, NgIcon, HlmButtonImports, HlmBadgeImports, HlmSeparatorImports, TranslocoPipe, StatusBadgeComponent, RatingStarsComponent],
  providers: [provideIcons({ lucideSearch, lucideX, lucidePackage, lucideShoppingCart, lucideUsers, lucideTag, lucideStar, lucideMail, lucidePlus, lucideArrowUp, lucideArrowDown, lucideCornerDownLeft, lucideCoffee })],
  template: `
    @if (open()) {
      <div class="fixed inset-0 z-50 flex items-start justify-center bg-overlay p-4 pt-[10vh] backdrop-blur-sm" (click)="onBackdrop($event)">
        <div #panel role="dialog" aria-modal="true" class="flex w-full max-w-[720px] max-h-[70vh] flex-col overflow-hidden rounded-[var(--radius-card)] border bg-card shadow-2xl outline-none" (keydown)="onKeydown($event)">
          <div class="flex items-center gap-2 border-b px-3 py-2">
            <ng-icon name="lucideSearch" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <input #searchInput type="text" class="h-9 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" [placeholder]="'nav.search'|transloco" [attr.aria-label]="'nav.search'|transloco" [attr.aria-autocomplete]="'list'" [attr.aria-controls]="'gsp-listbox'" [attr.aria-activedescendant]="activeDescendant()" [(ngModel)]="query" (ngModelChange)="onQueryChange($event)" />
            @if (query().trim().length) { <button type="button" hlmBtn variant="ghost" size="icon" class="size-7" (click)="clearQuery()"><ng-icon name="lucideX" class="size-4" aria-hidden="true" /></button> }
            <span class="hidden text-xs text-muted-foreground sm:inline">esc</span>
            <button type="button" hlmBtn variant="ghost" size="icon" class="size-7" (click)="close()"><ng-icon name="lucideX" class="size-4" aria-hidden="true" /></button>
          </div>
          <div class="min-h-0 flex-1 overflow-y-auto" id="gsp-listbox" role="listbox" [attr.aria-label]="'nav.search'|transloco">
            @if (loading()) { <div class="space-y-2 p-3">@for (i of [1,2,3,4]; track i) { <div class="flex items-center gap-3 rounded-md px-2 py-2"><div class="h-8 w-8 animate-pulse rounded-full bg-muted"></div><div class="flex-1 space-y-1"><div class="h-3 w-1/2 animate-pulse rounded bg-muted"></div><div class="h-2.5 w-1/3 animate-pulse rounded bg-muted"></div></div></div> }</div> }
            @if (error() && !loading()) { <div class="flex flex-col items-center gap-2 p-6 text-center"><p class="text-sm text-destructive">{{error()}}</p><button type="button" hlmBtn variant="outline" size="sm" (click)="retry()">Retry</button></div> }
            @if (!loading() && !error() && query().trim().length >= 2 && flatItems().length === 0) { <div class="flex flex-col items-center gap-2 p-6 text-center"><p class="text-sm text-muted-foreground">{{'nav.noResultsFor'|transloco:{q:query()} }}</p><p class="text-xs text-muted-foreground">{{'nav.noResultsHint'|transloco}}</p></div> }
            @if (!loading() && query().trim().length < 2) {
              <div class="space-y-4 p-3">
                @if (recent().length) { <section><div class="flex items-center justify-between px-2 py-1"><h3 class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{'nav.recentSearches'|transloco}}</h3><button type="button" class="text-xs text-muted-foreground hover:text-foreground" (click)="clearRecent()">{{'common.clear'|transloco}}</button></div><ul class="space-y-0.5">@for (r of recent(); track r) { <li><button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm hover:bg-accent" (click)="applyRecent(r)"><ng-icon name="lucideSearch" class="size-4 text-muted-foreground" aria-hidden="true" /><span>{{r}}</span></button></li> }</ul></section> }
                <section><h3 class="px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{{'nav.quickLinks'|transloco}}</h3><ul class="grid grid-cols-2 gap-1">@for (ql of quickLinks(); track ql.route) { <li><button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm hover:bg-accent" (click)="openRoute(ql.route)"><ng-icon [name]="ql.icon" class="size-4 text-muted-foreground" aria-hidden="true" /><span>{{ql.label}}</span></button></li> }</ul></section>
                <section><h3 class="px-2 py-1 text-xs font-medium uppercase tracking-wider text-muted-foreground">{{'nav.quickActions'|transloco}}</h3><ul class="space-y-0.5">@for (qa of quickActions(); track qa.route) { <li><button type="button" class="flex w-full items-center gap-2 rounded-md px-2 py-2 text-start text-sm hover:bg-accent" (click)="openRoute(qa.route)"><ng-icon name="lucidePlus" class="size-4 text-muted-foreground" aria-hidden="true" /><span>{{qa.label}}</span></button></li> }</ul></section>
              </div>
            }
            @if (!loading() && !error() && query().trim().length >= 2 && flatItems().length > 0) {
              <div class="py-2" role="group">
                @for (g of groups(); track g.type) {
                  <div class="px-2 py-1">
                    <div class="flex items-center justify-between px-2 py-1">
                      <span class="text-xs font-medium uppercase tracking-wider text-muted-foreground">{{groupLabel(g.type)}} · {{g.total}}</span>
                      <a class="text-xs text-primary hover:underline" [routerLink]="listRoute(g.type)" [queryParams]="{q:query()}" (click)="close()">{{'nav.viewAll'|transloco:{n:g.total} }}</a>
                    </div>
                    <ul class="space-y-0.5">
                      @for (item of g.items; track item.id) {
                        @let flatIdx = flatIndex(g.type, item.id);
                        <li>
                          <button type="button" role="option" [id]="'gsp-opt-'+g.type+'-'+item.id" [attr.aria-selected]="flatIdx===activeIndex()" class="flex w-full min-h-[44px] items-center gap-3 rounded-md px-2 py-2 text-start transition-colors" [class.bg-accent]="flatIdx===activeIndex()" [class.border-s-2]="flatIdx===activeIndex()" [class.border-primary]="flatIdx===activeIndex()" (mouseenter)="activeIndex.set(flatIdx)" (click)="select(item,$event)">
                            <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground">
                              @if (item.thumbnail) { <img [src]="item.thumbnail" alt="" class="h-8 w-8 rounded-full object-cover" /> } @else { <ng-icon [name]="typeIcon(g.type)" class="size-4" aria-hidden="true" /> }
                            </div>
                            <div class="min-w-0 flex-1">
                              <div class="flex items-center gap-2"><span class="truncate text-sm font-medium" [innerHTML]="highlight(item.title)"></span>@if (item.unread) { <span class="h-2 w-2 rounded-full bg-primary" aria-hidden="true"></span> }</div>
                              @if (item.subtitle) { <p class="truncate text-xs text-muted-foreground" [innerHTML]="highlight(item.subtitle)"></p> }
                              @if (g.type==='orders') { <p class="truncate text-xs text-muted-foreground">{{item.customerName}} · {{item.amount}} · {{item.date}}</p> }
                              @if (g.type==='reviews') { <div class="flex items-center gap-2"><app-rating-stars [rating]="item.rating||0" /><span class="truncate text-xs text-muted-foreground">{{item.product}}</span></div> }
                            </div>
                            <div class="flex shrink-0 items-center gap-2">
                              @if (item.status) { <app-status-badge [status]="asStatus(item.status)" /> }
                              @if (item.meta) { <span class="text-xs text-muted-foreground">{{item.meta}}</span> }
                            </div>
                          </button>
                        </li>
                      }
                    </ul>
                  </div>
                }
              </div>
            }
          </div>
          <div class="flex flex-wrap items-center gap-3 border-t px-3 py-2 text-xs text-muted-foreground">
            <span class="inline-flex items-center gap-1"><ng-icon name="lucideArrowUp" class="size-3" /><ng-icon name="lucideArrowDown" class="size-3" /> {{'nav.hintNavigate'|transloco}}</span>
            <span class="inline-flex items-center gap-1"><ng-icon name="lucideCornerDownLeft" class="size-3" /> {{'nav.hintOpen'|transloco}}</span>
            <span class="inline-flex items-center gap-1">{{'nav.hintNewTab'|transloco}}</span>
            <span class="inline-flex items-center gap-1">esc {{'nav.hintClose'|transloco}}</span>
          </div>
        </div>
      </div>
    }
  `,
})
export class GlobalSearchPaletteComponent {
  readonly open = model<boolean>(false);
  protected readonly language = inject(LanguageService);
  private readonly transloco = inject(TranslocoService);
  private readonly router = inject(Router);
  private readonly searchService = inject(GlobalSearchService);
  private readonly destroyRef = inject(DestroyRef);
  protected readonly query = signal('');
  protected readonly groups = signal<SearchResultGroup[]>([]);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly activeIndex = signal(-1);
  protected readonly flatItems = computed(() => this.groups().flatMap((g) => g.items.map((item) => ({ group: g.type, item }))));
  protected readonly recent = signal<string[]>(this.loadRecent());
  protected readonly quickLinks = computed(() => { const t = (k: string) => this.transloco.translate(k); return [ { label: t('nav.orders'), route: '/dashboard/orders', icon: 'lucidePackage' }, { label: t('nav.reviews'), route: '/dashboard/reviews', icon: 'lucideStar' }, { label: t('nav.contactMessages'), route: '/dashboard/contact-messages', icon: 'lucideMail' }, { label: t('nav.carts'), route: '/dashboard/carts', icon: 'lucideShoppingCart' } ]; });
  protected readonly quickActions = computed(() => { const t = (k: string) => this.transloco.translate(k); return [ { label: t('nav.addProduct'), route: '/dashboard/products/new', icon: 'lucidePlus' }, { label: t('nav.addCategory'), route: '/dashboard/categories/new', icon: 'lucidePlus' } ]; });
  private lastFocused: HTMLElement | null = null;
  private searchInput = viewChild<ElementRef<HTMLInputElement>>('searchInput');
  constructor() {
    effect(() => {
      if (this.open()) { this.lastFocused = (document.activeElement as HTMLElement) ?? null; setTimeout(() => { this.searchInput()?.nativeElement?.focus(); }, 50); }
      else { this.query.set(''); this.groups.set([]); this.error.set(null); this.loading.set(false); this.activeIndex.set(-1); if (this.lastFocused) { this.lastFocused.focus(); this.lastFocused = null; } }
    });
    toObservable(this.query).pipe(takeUntilDestroyed(this.destroyRef), debounceTime(250), distinctUntilChanged(), switchMap((q) => {
      const trimmed = q.trim();
      if (trimmed.length < 2) { this.groups.set([]); this.loading.set(false); this.error.set(null); return of(null); }
      this.loading.set(true); this.error.set(null);
      return this.searchService.search(trimmed, 5).pipe(catchError(() => { this.error.set('Search failed. Please try again.'); this.loading.set(false); return of(null); }));
    })).subscribe((res: SearchResponse | null) => {
      if (res) { this.groups.set(res.groups ?? []); this.loading.set(false); this.saveRecent(this.query().trim()); this.activeIndex.set(this.flatItems().length ? 0 : -1); }
    });
  }
  @HostListener('document:keydown', ['$event'])
  onGlobalKeydown(event: KeyboardEvent): void {
    const isMod = event.ctrlKey || event.metaKey;
    if (isMod && (event.key === 'k' || event.key === 'K')) { event.preventDefault(); this.open.set(true); return; }
    if (event.key === '/' && !this.isTypingTarget(event.target)) { event.preventDefault(); this.open.set(true); return; }
  }
  private isTypingTarget(target: EventTarget | null): boolean { const el = target as HTMLElement | null; if (!el) return false; const tag = el.tagName?.toLowerCase(); return tag === 'input' || tag === 'textarea' || el.isContentEditable; }
  protected onQueryChange(q: string): void { this.query.set(q); }
  protected clearQuery(): void { this.query.set(''); this.groups.set([]); this.searchInput()?.nativeElement?.focus(); }
  protected close(): void { this.open.set(false); }
  protected onBackdrop(event: MouseEvent): void { if (event.target === event.currentTarget) this.close(); }
  protected onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') { event.preventDefault(); this.close(); return; }
    if (event.key === 'ArrowDown') { event.preventDefault(); const len = this.flatItems().length; if (len === 0) return; this.activeIndex.update((i) => (i + 1) % len); this.scrollActiveIntoView(); return; }
    if (event.key === 'ArrowUp') { event.preventDefault(); const len = this.flatItems().length; if (len === 0) return; this.activeIndex.update((i) => (i <= 0 ? len - 1 : i - 1)); this.scrollActiveIntoView(); return; }
    if (event.key === 'Enter') { event.preventDefault(); const items = this.flatItems(); const idx = this.activeIndex(); if (idx < 0 || idx >= items.length) return; const it = items[idx]; if (event.ctrlKey || event.metaKey) { window.open(this.fullRoute(it.item), '_blank'); } else { this.selectItem(it.item); } return; }
  }
  private scrollActiveIntoView(): void { setTimeout(() => { const fi = this.flatItems(); const idx = this.activeIndex(); if (idx < 0 || idx >= fi.length) return; const el = document.getElementById('gsp-opt-' + fi[idx].group + '-' + fi[idx].item.id); el?.scrollIntoView({ block: 'nearest' }); }, 0); }
  protected select(item: SearchResultItem, event?: MouseEvent): void { if (event?.ctrlKey || event?.metaKey) { window.open(this.fullRoute(item), '_blank'); return; } this.selectItem(item); }
  private selectItem(item: SearchResultItem): void { this.saveRecent(this.query().trim()); this.close(); this.router.navigateByUrl(this.fullRoute(item)); }
  private fullRoute(item: SearchResultItem): string { return item.route.startsWith('/') ? item.route : `/dashboard/${item.route}`; }
  protected openRoute(route: string): void { this.close(); this.router.navigateByUrl(route); }
  protected applyRecent(r: string): void { this.query.set(r); }
  protected clearRecent(): void { this.recent.set([]); try { localStorage.removeItem(RECENT_KEY); } catch {} }
  protected retry(): void { const q = this.query(); this.query.set(''); setTimeout(() => this.query.set(q), 0); }
  protected groupLabel(type: string): string { const map: Record<string,string> = { orders:'nav.orders', products:'nav.products', customers:'nav.customers', categories:'nav.categories', reviews:'nav.reviews', 'contact-messages':'nav.contactMessages', carts:'nav.carts', 'shipping-zones':'nav.shippingZones', pages:'nav.pages', actions:'nav.actions' }; return this.transloco.translate(map[type] ?? type); }
  protected typeIcon(type: string): string { const map: Record<string,string> = { orders:'lucidePackage', products:'lucideCoffee', customers:'lucideUsers', categories:'lucideTag', reviews:'lucideStar', 'contact-messages':'lucideMail', carts:'lucideShoppingCart' }; return map[type] ?? 'lucideSearch'; }
  protected listRoute(type: string): string { const map: Record<string,string> = { orders:'/dashboard/orders', products:'/dashboard/products', customers:'/dashboard/users', categories:'/dashboard/categories', reviews:'/dashboard/reviews', 'contact-messages':'/dashboard/contact-messages', carts:'/dashboard/carts', 'shipping-zones':'/dashboard/shipping-zones' }; return map[type] ?? '/dashboard'; }
  protected flatIndex(groupType: string, id: string | number): number { let idx = 0; for (const g of this.groups()) { if (g.type === groupType) { const i = g.items.findIndex((it: SearchResultItem) => it.id === id); if (i >= 0) return idx + i; } idx += g.items.length; } return -1; }
  protected highlight(text: string): string { const q = this.query().trim(); if (!q || !text) return this.escapeHtml(text); const escaped = this.escapeRegex(q); const re = new RegExp(`(${escaped})`, 'gi'); return this.escapeHtml(text).replace(re, '<mark class="rounded bg-search-highlight px-0.5 text-foreground">$1</mark>'); }
  private escapeHtml(s: string): string { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
  private escapeRegex(s: string): string { return s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
  protected asStatus(s: string): any { return s; }
  private loadRecent(): string[] { try { const raw = localStorage.getItem(RECENT_KEY); return raw ? JSON.parse(raw).slice(0, 5) : []; } catch { return []; } }
  private saveRecent(q: string): void { if (!q) return; const next = [q, ...this.recent().filter((r) => r !== q)].slice(0, 5); this.recent.set(next); try { localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch {} }
  protected activeDescendant(): string | null { const items = this.flatItems(); const idx = this.activeIndex(); if (idx < 0 || idx >= items.length) return null; const it = items[idx]; return `gsp-opt-${it.group}-${it.item.id}`; }
}