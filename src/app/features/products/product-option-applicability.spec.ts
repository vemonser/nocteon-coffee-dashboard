import { describe, expect, it } from 'vitest';

import { filterOptionsByProductType, optionAppliesTo } from './product-option-applicability';

describe('option applicability (OPTIONS-04)', () => {
  it('uses the API field: a COFFEE-only option is hidden for equipment', () => {
    const weight = { slug: 'weight', appliesTo: ['COFFEE'] };

    expect(optionAppliesTo(weight, 'COFFEE')).toBe(true);
    expect(optionAppliesTo(weight, 'EQUIPMENT')).toBe(false);
  });

  it('treats an option without appliesTo as valid for every type', () => {
    // The field is absent on an older row: never render it as if it applied to
    // nothing. This is also the backend rule (`appliesTo IS EMPTY`).
    expect(optionAppliesTo({ slug: 'weight' }, 'COFFEE')).toBe(true);
    expect(optionAppliesTo({ slug: 'weight' }, 'EQUIPMENT')).toBe(true);
    expect(optionAppliesTo({ slug: 'weight', appliesTo: null }, 'EQUIPMENT')).toBe(true);
    expect(optionAppliesTo({ slug: 'weight', appliesTo: [] }, 'EQUIPMENT')).toBe(true);
  });

  it('keeps every option when the product type is not chosen yet', () => {
    const options = [{ slug: 'weight', appliesTo: ['COFFEE'] }, { slug: 'size', appliesTo: ['EQUIPMENT'] }];

    expect(filterOptionsByProductType(options, null)).toBe(options);
    expect(filterOptionsByProductType(options, '')).toBe(options);
  });

  it('filters a mixed list by the chosen product type', () => {
    const options = [
      { slug: 'weight', appliesTo: ['COFFEE'] },
      { slug: 'size', appliesTo: ['EQUIPMENT'] },
      { slug: 'legacy' },
    ];

    expect(filterOptionsByProductType(options, 'COFFEE').map((o) => o.slug)).toEqual([
      'weight',
      'legacy',
    ]);
    expect(filterOptionsByProductType(options, 'EQUIPMENT').map((o) => o.slug)).toEqual([
      'size',
      'legacy',
    ]);
  });
});
