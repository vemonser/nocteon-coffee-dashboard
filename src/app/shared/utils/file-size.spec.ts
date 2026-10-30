import { describe, expect, it } from 'vitest';
import { formatFileSize } from './file-size';

/**
 * W7: the media step printed "max 10 mB". The unit is upper case and the same
 * formatter feeds every limit the wizard shows.
 */
describe('formatFileSize', () => {
  it('prints the wizard limits the way the design system writes units', () => {
    expect(formatFileSize(10 * 1024 * 1024)).toBe('10 MB');
    expect(formatFileSize(5 * 1024 * 1024)).toBe('5 MB');
  });

  it('picks the unit from the magnitude, with B, KB, MB and GB', () => {
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
    expect(formatFileSize(1024 * 1024 * 1024)).toBe('1 GB');
  });

  it('never shows a trailing .0 or a negative size', () => {
    expect(formatFileSize(2 * 1024 * 1024)).toBe('2 MB');
    expect(formatFileSize(-5)).toBe('0 B');
    expect(formatFileSize(0)).toBe('0 B');
    expect(formatFileSize(null)).toBe('0 B');
  });
});
