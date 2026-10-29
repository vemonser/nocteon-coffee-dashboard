import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { LanguageService } from '../../../core/i18n/language.service';
import { TranslocoService } from '@jsverse/transloco';
import { formatCount, formatRating } from '../../../shared/utils/locale-format';
import { RatingStarsComponent } from './rating-stars.component';

describe('RatingStarsComponent', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        { provide: LanguageService, useValue: { language: () => 'en' } },
        {
          provide: TranslocoService,
          useValue: {
            translate: (key: string, params?: Record<string, unknown>) =>
              key === 'common.rating.outOf'
                ? `${String(params?.['value'])} out of ${String(params?.['max'])}`
                : key,
          },
        },
      ],
    });
  });

  it('renders N filled and 5-N empty stars for N = 0..5', () => {
    for (let n = 0; n <= 5; n++) {
      const fixture = TestBed.createComponent(RatingStarsComponent);
      fixture.componentRef.setInput('rating', n);
      fixture.detectChanges();
      const paths = Array.from(fixture.nativeElement.querySelectorAll('svg path')) as SVGPathElement[];
      const filled = paths.filter((p) => p.getAttribute('fill') === 'currentColor').length;
      const empty = paths.filter((p) => p.getAttribute('fill') === 'none').length;
      expect(filled).toBe(n);
      expect(empty).toBe(5 - n);
      const span = fixture.nativeElement.querySelector('span');
      expect(span.getAttribute('aria-label')).toBe(`${formatRating(n, 'en' as any)} out of ${formatCount(5, 'en' as any)}`);
    }
  });
});