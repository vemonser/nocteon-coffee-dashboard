import { beforeEach, describe, expect, it } from 'vitest';

import {
  clearProductDraft,
  draftKey,
  loadProductDraft,
  saveProductDraft,
} from './product-draft';

/** An in-memory localStorage so the storage rules are testable in any env. */
function memoryStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, String(v)),
  } as Storage;
}

describe('product wizard draft', () => {
  beforeEach(() => {
    (globalThis as { localStorage?: Storage }).localStorage = memoryStorage();
  });

  it('uses one key per product and a shared slot for the create flow', () => {
    expect(draftKey(null)).toBe('products.wizard.draft.v1:new');
    expect(draftKey('ethiopia-yirgacheffe')).toBe('products.wizard.draft.v1:ethiopia-yirgacheffe');
  });

  it('round-trips a saved draft with its timestamp', () => {
    const when = new Date('2026-10-28T12:00:00.000Z');
    expect(saveProductDraft(null, { name: 'Kenya' }, when)).toBe(true);

    const draft = loadProductDraft(null);
    expect(draft?.value).toEqual({ name: 'Kenya' });
    expect(draft?.savedAt).toBe(when.toISOString());
  });

  it('keeps drafts apart per product', () => {
    saveProductDraft(null, { name: 'create' });
    saveProductDraft('aeropress', { name: 'edit' });

    expect(loadProductDraft(null)?.value).toEqual({ name: 'create' });
    expect(loadProductDraft('aeropress')?.value).toEqual({ name: 'edit' });
  });

  it('treats a corrupt or empty draft as no draft', () => {
    localStorage.setItem(draftKey(null), '{not json');
    expect(loadProductDraft(null)).toBeNull();

    localStorage.setItem(draftKey(null), JSON.stringify({ value: null, savedAt: 'x' }));
    expect(loadProductDraft(null)).toBeNull();
  });

  it('clears only the draft it is given', () => {
    saveProductDraft(null, { name: 'a' });
    saveProductDraft('aeropress', { name: 'b' });

    clearProductDraft('aeropress');

    expect(loadProductDraft(null)).not.toBeNull();
    expect(loadProductDraft('aeropress')).toBeNull();
  });

  it('never throws when storage is unavailable', () => {
    (globalThis as { localStorage?: Storage }).localStorage = undefined as unknown as Storage;

    expect(() => saveProductDraft(null, { name: 'x' })).not.toThrow();
    expect(loadProductDraft(null)).toBeNull();
    expect(() => clearProductDraft(null)).not.toThrow();
    expect(saveProductDraft(null, { name: 'x' })).toBe(false);
  });
});
