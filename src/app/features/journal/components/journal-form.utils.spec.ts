import { describe, expect, it } from 'vitest';
import { parseTags, pickPreviewTranslation } from './journal-form.utils';

describe('journal form helpers', () => {
  it('parses tags the way the editor types them', () => {
    expect(parseTags(' brewing, guide ,, ')).toEqual(['brewing', 'guide']);
    expect(parseTags(null)).toEqual([]);
  });

  it('previews the dashboard language when it has text', () => {
    const values = [
      { language: 'en', title: 'English', content: '<p>en</p>' },
      { language: 'ar', title: 'عربي', content: '<p>ar</p>' },
    ];
    expect(pickPreviewTranslation(values, 'ar').language).toBe('ar');
  });

  it('falls back to English when the current language group is empty', () => {
    const values = [
      { language: 'en', title: 'English', content: '<p>en</p>' },
      { language: 'ar', title: '', content: '' },
    ];
    expect(pickPreviewTranslation(values, 'ar').language).toBe('en');
  });

  it('falls back to any language with text, then to the current group', () => {
    const onlyAr = [
      { language: 'en', title: '', content: '' },
      { language: 'ar', title: 'عربي', content: '<p>ar</p>' },
    ];
    expect(pickPreviewTranslation(onlyAr, 'en').language).toBe('ar');

    const empty = [
      { language: 'en', title: '', content: '' },
      { language: 'ar', title: '', content: '' },
    ];
    expect(pickPreviewTranslation(empty, 'ar').language).toBe('ar');
  });
});
