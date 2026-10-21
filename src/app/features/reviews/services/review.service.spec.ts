import { describe, expect, it } from 'vitest';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';

import { ReviewService } from './review.service';

/**
 * The review list carries the filters as query parameters.
 *
 * The product slug and the free text are SEPARATE parameters: the endpoint
 * used to overload the slug with a LIKE search, so a product dropdown and
 * a search box could never coexist.
 */
describe('ReviewService', () => {
  it('sends the product filter, the search and the date range separately', () => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting(), ReviewService],
    });
    const service = TestBed.inject(ReviewService);
    const http = TestBed.inject(HttpTestingController);

    service
      .getAll({
        productSlug: 'brazil-mogiana',
        search: 'excellent',
        isApproved: false,
        createdFrom: '2026-10-01T00:00:00Z',
        createdTo: '2026-10-20T00:00:00Z',
      })
      .subscribe();

    const request = http.expectOne((r) => r.url.includes('/api/dashboard/reviews'));
    const params = request.request.params;
    expect(params.get('productSlug')).toBe('brazil-mogiana');
    expect(params.get('search')).toBe('excellent');
    expect(params.get('isApproved')).toBe('false');
    expect(params.get('createdFrom')).toBe('2026-10-01T00:00:00Z');
    expect(params.get('createdTo')).toBe('2026-10-20T00:00:00Z');
    request.flush({ success: true, data: { content: [] } });
  });
});
