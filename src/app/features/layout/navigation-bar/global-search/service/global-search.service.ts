import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, delay } from 'rxjs/operators';
import { SearchResponse, SearchResultGroup } from '../model/search.model';
import { environment } from '../../../../../../environments/environment';
import { ApiResponse } from '../../../../../core/models/api-response.model';

export const GLOBAL_SEARCH_USE_MOCK = true;

@Injectable({ providedIn: 'root' })
export class GlobalSearchService {
  private http = inject(HttpClient);

  search(query: string, limitPerType = 5): Observable<SearchResponse> {
    if (GLOBAL_SEARCH_USE_MOCK) {
      return this.mockSearch(query, limitPerType);
    }
    const params = new HttpParams().set('q', query).set('limitPerType', String(limitPerType));
    return this.http
      .get<ApiResponse<SearchResponse>>(`${environment.apiUrl}/api/admin/search`, { params })
      .pipe(map((res) => res.data));
  }

  private mockSearch(query: string, limitPerType: number): Observable<SearchResponse> {
    const q = query.toLowerCase();
    const groups: SearchResultGroup[] = [];

    const orders = [
      { id: 'ORD-2026-000002', title: 'ORD-2026-000002', subtitle: 'ahmed@example.com', customerName: 'Ahmed Ali', amount: 1250, date: '2026-10-12', status: 'DELIVERED' },
      { id: 'ORD-2026-000007', title: 'ORD-2026-000007', subtitle: 'sara@example.com', customerName: 'Sara Hassan', amount: 890, date: '2026-10-15', status: 'PROCESSING' },
    ].filter((o) => o.title.toLowerCase().includes(q) || o.subtitle.includes(q) || o.customerName.toLowerCase().includes(q));
    if (orders.length) groups.push({ type: 'orders', total: orders.length, items: orders.map((o) => ({ id: o.id, type: 'orders', title: o.title, subtitle: o.subtitle, status: o.status, customerName: o.customerName, amount: o.amount, date: o.date, route: `/dashboard/orders/${o.id}` })) });

    const products = [
      { id: 1, title: 'Ethiopian Yirgacheffe', subtitle: 'SKU: ETH-YIR-250', sku: 'ETH-YIR-250', price: 180, stockStatus: 'IN_STOCK' },
      { id: 2, title: 'أحمد قهوة عربية', subtitle: 'SKU: ARAB-001', sku: 'ARAB-001', price: 95, stockStatus: 'IN_STOCK' },
    ].filter((p) => p.title.toLowerCase().includes(q) || p.subtitle.toLowerCase().includes(q) || normalizeAr(p.title).includes(normalizeAr(q)));
    if (products.length) groups.push({ type: 'products', total: products.length, items: products.map((p) => ({ id: p.id, type: 'products', title: p.title, subtitle: p.subtitle, sku: p.sku, price: p.price, stockStatus: p.stockStatus, route: `/dashboard/products/${p.id}` })) });

    const customers = [
      { id: 10, title: 'Ahmed Ali', subtitle: 'ahmed@example.com', ordersCount: 3 },
      { id: 11, title: 'أحمد محمد', subtitle: 'ahmad@example.com', ordersCount: 1 },
    ].filter((c) => c.title.toLowerCase().includes(q) || c.subtitle.includes(q) || normalizeAr(c.title).includes(normalizeAr(q)));
    if (customers.length) groups.push({ type: 'customers', total: customers.length, items: customers.map((c) => ({ id: c.id, type: 'customers', title: c.title, subtitle: c.subtitle, customerName: c.title, customerEmail: c.subtitle, ordersCount: c.ordersCount, route: `/dashboard/users/${c.id}` })) });

    const categories = [
      { id: 1, title: 'Single Origin', subtitle: '12 items' },
      { id: 2, title: 'مزيج عربي', subtitle: '5 items' },
    ].filter((c) => c.title.toLowerCase().includes(q) || normalizeAr(c.title).includes(normalizeAr(q)));
    if (categories.length) groups.push({ type: 'categories', total: categories.length, items: categories.map((c) => ({ id: c.id, type: 'categories', title: c.title, subtitle: c.subtitle, route: `/dashboard/categories/${c.id}` })) });

    const reviews = [
      { id: 5, title: 'Great coffee, fast delivery', subtitle: 'by Ahmed Ali', rating: 5, product: 'Ethiopian Yirgacheffe' },
    ].filter((r) => r.title.toLowerCase().includes(q) || r.subtitle.toLowerCase().includes(q));
    if (reviews.length) groups.push({ type: 'reviews', total: reviews.length, items: reviews.map((r) => ({ id: r.id, type: 'reviews', title: r.title, subtitle: r.subtitle, rating: r.rating, product: r.product, route: `/dashboard/reviews` })) });

    const carts = [
      { id: 3, title: 'Ahmed Ali', subtitle: '3 items', itemCount: 3, amount: 450 },
    ].filter((c) => c.title.toLowerCase().includes(q) || normalizeAr(c.title).includes(normalizeAr(q)));
    if (carts.length) groups.push({ type: 'carts', total: carts.length, items: carts.map((c) => ({ id: c.id, type: 'carts', title: c.title, subtitle: c.subtitle, itemCount: c.itemCount, amount: c.amount, route: `/dashboard/carts` })) });

    const contact = [
      { id: 9, title: 'Shipping question', subtitle: 'Ahmed Ali · ahmed@example.com', unread: true },
    ].filter((m) => m.title.toLowerCase().includes(q) || m.subtitle.toLowerCase().includes(q));
    if (contact.length) groups.push({ type: 'contact-messages', total: contact.length, items: contact.map((m) => ({ id: m.id, type: 'contact-messages', title: m.title, subtitle: m.subtitle, unread: m.unread, route: `/dashboard/contact-messages` })) });

    // Arabic normalization fallback
    if (normalizeAr(q).includes('احمد')) {
      const grp = groups.find((g) => g.type === 'customers');
      const exists = grp?.items.some((i) => normalizeAr(String(i.title)).includes('احمد'));
      if (!exists) {
        const item = { id: 11, type: 'customers' as const, title: 'أحمد محمد', subtitle: 'ahmad@example.com', customerName: 'أحمد محمد', customerEmail: 'ahmad@example.com', ordersCount: 1, route: '/dashboard/users/11' };
        if (grp) { grp.items.push(item); grp.total = grp.items.length; }
        else groups.push({ type: 'customers', total: 1, items: [item] });
      }
    }

    return of({ groups, totalCount: groups.reduce((a, g) => a + g.total, 0) }).pipe(delay(250));
  }
}

function normalizeAr(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه');
}