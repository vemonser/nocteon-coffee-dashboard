import { describe, expect, it } from 'vitest';
import { parseTags, pickPreviewTranslation } from './journal-form.utils';
import { parseVideoUrl } from '../../../shared/utils/video-url';

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

describe('parseVideoUrl', () => {
  it('converts the usual YouTube and Vimeo links to embeds', () => {
    expect(parseVideoUrl('https://www.youtube.com/watch?v=abc123XYZ')).toBe(
      'https://www.youtube.com/embed/abc123XYZ',
    );
    expect(parseVideoUrl('https://youtu.be/abc123XYZ')).toBe(
      'https://www.youtube.com/embed/abc123XYZ',
    );
    expect(parseVideoUrl('https://youtube.com/embed/abc123XYZ')).toBe(
      'https://www.youtube.com/embed/abc123XYZ',
    );
    expect(parseVideoUrl('https://vimeo.com/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
    expect(parseVideoUrl('https://player.vimeo.com/video/123456789')).toBe(
      'https://player.vimeo.com/video/123456789',
    );
  });

  it('refuses everything the sanitizer would strip', () => {
    expect(parseVideoUrl('https://evil.example/embed/abc123')).toBeNull();
    expect(parseVideoUrl('https://www.youtube.com/watch?v=short')).toBeNull();
    expect(parseVideoUrl('javascript:alert(1)')).toBeNull();
    expect(parseVideoUrl('https://player.vimeo.com/video/123456789/extra')).toBeNull();
    expect(parseVideoUrl('https://evil@www.youtube.com/watch?v=abc123XYZ')).toBeNull();
    expect(parseVideoUrl('')).toBeNull();
  });
});
