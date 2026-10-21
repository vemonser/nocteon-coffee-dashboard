import { describe, expect, it } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { RatingStarsComponent } from './rating-stars.component';

describe('RatingStarsComponent', () => {
  it('renders N filled and 5-N empty stars for N = 0..5', () => {
    for (let n = 0; n <= 5; n++) {
      const fixture = TestBed.createComponent(RatingStarsComponent);
      fixture.componentRef.setInput('rating', n);
      fixture.detectChanges();
      console.log('HTML', fixture.nativeElement.innerHTML);
      const paths = Array.from(fixture.nativeElement.querySelectorAll('svg path')) as SVGPathElement[];
      const filled = paths.filter((p) => p.getAttribute('fill') === 'currentColor').length;
      const empty = paths.filter((p) => p.getAttribute('fill') === 'none').length;
      expect(filled).toBe(n);
      expect(empty).toBe(5 - n);
      const span = fixture.nativeElement.querySelector('span');
      expect(span.getAttribute('aria-label')).toBe(`${n} out of 5`);
    }
  });
});