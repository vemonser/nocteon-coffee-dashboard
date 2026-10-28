import { describe, expect, it, beforeEach } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { FormControl, FormGroup } from '@angular/forms';
import { ProductWizardStateService } from './product-wizard-state.service';

/**
 * FE-07: the two new SEO controls and the social-image picker must take part in
 * the unsaved-changes guard. The wizard compares normalized snapshots rather
 * than `form.dirty`, so this proves an edit is seen by that comparison — and
 * that whitespace-only SEO text is not mistaken for a change.
 */
describe('ProductWizardStateService — dirty state for SEO fields', () => {
  let state: ProductWizardStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProductWizardStateService] });
    state = TestBed.inject(ProductWizardStateService);
    state.translationsArray.push(
      new FormGroup({
        language: new FormControl('en'),
        name: new FormControl('Yirgacheffe'),
        metaTitle: new FormControl(''),
        metaDescription: new FormControl(''),
      }),
    );
    state.captureInitialSnapshot();
  });

  it('is clean immediately after the snapshot', () => {
    expect(state.hasFormChanged()).toBe(false);
  });

  it('detects a social-image change', () => {
    state.form.patchValue({ ogImageUrl: 'https://res.cloudinary.com/x/image/upload/nocteon/og.jpg' });
    expect(state.hasFormChanged()).toBe(true);
  });

  it('detects a per-language SEO edit', () => {
    state.translationsArray.at(0).patchValue({ metaTitle: 'Yirgacheffe | Nocteon' });
    expect(state.hasFormChanged()).toBe(true);
  });

  it('does not treat whitespace-only SEO text as a change', () => {
    state.translationsArray.at(0).patchValue({ metaDescription: '   ' });
    expect(state.hasFormChanged()).toBe(false);
  });
});

/**
 * FE-10: the tag chips toggle one slug in and out of the request, and the change must reach the
 * unsaved-changes guard — a tag added and dropped again is not a change.
 */
describe('ProductWizardStateService — tags', () => {
  let state: ProductWizardStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProductWizardStateService] });
    state = TestBed.inject(ProductWizardStateService);
    state.captureInitialSnapshot();
  });

  it('adds and removes a tag slug', () => {
    state.toggleTag('new-arrivals');
    expect(state.hasTag('new-arrivals')).toBe(true);
    expect(state.tagSlugsArray.value).toEqual(['new-arrivals']);

    state.toggleTag('new-arrivals');
    expect(state.hasTag('new-arrivals')).toBe(false);
    expect(state.tagSlugsArray.value).toEqual([]);
  });

  it('counts an added tag as an unsaved change, and dropping it again as no change', () => {
    state.toggleTag('gift-boxes');
    expect(state.hasFormChanged()).toBe(true);

    state.toggleTag('gift-boxes');
    expect(state.hasFormChanged()).toBe(false);
  });

  it('does not repeat a slug that is already selected', () => {
    state.toggleTag('new-arrivals');
    state.toggleTag('new-arrivals');
    state.toggleTag('new-arrivals');
    expect(state.tagSlugsArray.value).toEqual(['new-arrivals']);
  });

  it('loads the saved tags back into the form in edit mode', () => {
    state.loadFromDetail(
      {
        id: 1,
        slug: 'brazil-mogiana',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        isActive: true,
        featured: false,
        translations: [],
        variants: [],
        media: [],
        tastingNotes: [],
        pairings: [],
        brewingMethods: [],
        tags: [
          { slug: 'new-arrivals', name: 'New arrivals' },
          { slug: 'gift-boxes', name: 'Gift boxes' },
        ],
      } as never,
      () => state.translationsArray,
    );

    expect(state.tagSlugsArray.value).toEqual(['new-arrivals', 'gift-boxes']);
    // The load is the baseline, not a change.
    expect(state.hasFormChanged()).toBe(false);
  });
});
