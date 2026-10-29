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

  it('keeps at most six related products, in the order they were added', () => {
    ['a', 'b', 'c', 'd', 'e', 'f', 'g'].forEach((slug) =>
      state.addRelated({ slug, name: slug.toUpperCase(), primaryImageUrl: null }),
    );

    expect(state.relatedProductSlugsArray.value).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(state.relatedProducts()).toHaveLength(6);
  });

  it('removing a related product drops it from the request and from the chips', () => {
    state.addRelated({ slug: 'kenya-nyeri', name: 'Kenya Nyeri', primaryImageUrl: null });
    state.addRelated({ slug: 'ethiopia-yirgacheffe', name: 'Ethiopia', primaryImageUrl: null });

    state.removeRelated('kenya-nyeri');

    expect(state.relatedProductSlugsArray.value).toEqual(['ethiopia-yirgacheffe']);
    expect(state.relatedProducts().map((item) => item.slug)).toEqual(['ethiopia-yirgacheffe']);
  });

  it('removing one from the middle keeps the rest in order', () => {
    ['a', 'b', 'c'].forEach((slug) =>
      state.addRelated({ slug, name: slug.toUpperCase(), primaryImageUrl: null }),
    );

    state.removeRelated('b');

    expect(state.relatedProductSlugsArray.value).toEqual(['a', 'c']);
    expect(state.relatedProducts().map((item) => item.slug)).toEqual(['a', 'c']);
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

/**
 * FE-15: the barcode is optional, so the form must not require it — but the string it carries is
 * capped at what the API accepts (64), and it has to survive the edit-mode load, or an admin who
 * opens a product would silently drop the codes the server already has.
 */
describe('ProductWizardStateService — variant barcode', () => {
  let state: ProductWizardStateService;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProductWizardStateService] });
    state = TestBed.inject(ProductWizardStateService);
  });

  it('starts empty and valid, because the field is optional', () => {
    const group = state.buildVariantGroup();
    expect(group.get('barcode')?.value).toBe('');
    expect(group.get('barcode')?.valid).toBe(true);
  });

  it('rejects a code longer than the column the API stores it in', () => {
    const group = state.buildVariantGroup();
    group.get('barcode')?.setValue('9'.repeat(65));
    expect(group.get('barcode')?.hasError('maxlength')).toBe(true);
    group.get('barcode')?.setValue('9'.repeat(64));
    expect(group.get('barcode')?.valid).toBe(true);
  });

  it('loads the saved barcode back into the form in edit mode', () => {
    state.loadFromDetail(
      {
        id: 1,
        slug: 'brazil-mogiana',
        categorySlug: 'coffee',
        productType: 'COFFEE',
        isActive: true,
        featured: false,
        translations: [],
        variants: [
          {
            id: 10,
            sku: 'BRA-250',
            barcode: '4006381333931',
            price: 650,
            stockQuantity: 4,
            isActive: true,
            optionValues: [],
          },
        ],
        media: [],
        tastingNotes: [],
        pairings: [],
        brewingMethods: [],
      } as never,
      () => state.translationsArray,
    );

    expect(state.variantsArray.at(0).get('barcode')?.value).toBe('4006381333931');
  });
});
