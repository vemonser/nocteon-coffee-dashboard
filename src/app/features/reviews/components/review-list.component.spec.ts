import { describe, expect, it, vi } from 'vitest';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideHttpClient } from '@angular/common/http';
import { TranslocoService } from '@jsverse/transloco';

import { ReviewListComponent } from './review-list.component';
import { ReviewService } from '../services/review.service';
import { ProductService } from '../../products/services/product.service';
import { NotifyService } from '../../../core/notify/notify.service';
import { LanguageService } from '../../../core/i18n/language.service';

describe('ReviewListComponent verified KPI', () => {
  it('computes the verified share over the whole dataset (17 reviews)', async () => {
    const reviewService = {
      getAll: vi.fn().mockReturnValue({ subscribe: (obs: any) => { obs.next({ data: { content: [], totalElements: 0 } }); return { unsubscribe() {} }; } }),
      getStats: vi.fn().mockReturnValue({ subscribe: (obs: any) => { obs.next({ data: { total: 17, pending: 3, approved: 13, rejected: 1, verified: 10, averageRating: 4.3, averageRatingAll: 4.0, distribution: {} } }); return { unsubscribe() {} }; } }),
      setApproval: vi.fn(),
      setSingleApproval: vi.fn(),
      setRejected: vi.fn(),
      remove: vi.fn(),
    };
    const productService = {
      getAll: vi.fn().mockReturnValue({ subscribe: (obs: any) => { obs.next({ data: { content: [] } }); return { unsubscribe() {} }; } }),
    };
    const notify = { success: vi.fn(), apiError: vi.fn(), warning: vi.fn(), apiSuccess: vi.fn(), t: (k: string, f: string) => f, backendMessage: () => null };
    const language = { language: () => 'en', current: () => 'en' };
    const transloco = { translate: (k: string, p?: any) => k, getActiveLang: () => 'en' };

    await TestBed.configureTestingModule({
      imports: [ReviewListComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        { provide: ReviewService, useValue: reviewService },
        { provide: ProductService, useValue: productService },
        { provide: NotifyService, useValue: notify },
        { provide: LanguageService, useValue: language },
        { provide: TranslocoService, useValue: transloco },
      ],
    }).compileComponents();

    const fixture: ComponentFixture<ReviewListComponent> = TestBed.createComponent(ReviewListComponent);

    const cmp = fixture.componentInstance as any;
    // force stats over the whole dataset
    cmp.stats.set({ total: 17, pending: 3, approved: 13, rejected: 1, verified: 10, averageRating: 4.3, averageRatingAll: 4.0, distribution: {} });

    expect(cmp.verifiedShare()).toBe(59);
  });
});