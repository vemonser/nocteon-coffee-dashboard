import { describe, expect, it } from 'vitest';
import {
  STORY_MAX_CHARACTERS,
  htmlTextLength,
  htmlToText,
  maxHtmlTextLength,
} from './html-text';

/**
 * The story counter (W5) counts what a READER sees. Tags and the entities a
 * rich-text editor writes must not inflate the number, or "90 characters"
 * shows as 412 and the 2000 limit fires far too late.
 */
describe('html text length', () => {
  it('strips tags and counts the rendered text', () => {
    expect(htmlToText('<p>Hello <strong>coffee</strong></p>')).toBe('Hello coffee');
    expect(htmlTextLength('<p>Hello <strong>coffee</strong></p>')).toBe(12);
  });

  it('treats entities as the character they render as', () => {
    expect(htmlTextLength('a&nbsp;b')).toBe(3);
    expect(htmlToText('tea &amp; coffee')).toBe('tea & coffee');
    expect(htmlTextLength('tea &amp; coffee')).toBe(12);
  });

  it('returns zero for empty, null and tag-only content', () => {
    expect(htmlTextLength('')).toBe(0);
    expect(htmlTextLength(null)).toBe(0);
    expect(htmlTextLength(undefined)).toBe(0);
    expect(htmlTextLength('<p><br></p>')).toBe(0);
  });

  it('does not count script or style bodies', () => {
    expect(htmlTextLength('<style>p{color:red}</style><p>ok</p>')).toBe(2);
  });

  it('fails only when the TEXT passes the limit', () => {
    const validator = maxHtmlTextLength(STORY_MAX_CHARACTERS);
    expect(validator({ value: '<p>' + 'a'.repeat(STORY_MAX_CHARACTERS) + '</p>' })).toBeNull();
    expect(
      validator({ value: '<p>' + 'a'.repeat(STORY_MAX_CHARACTERS + 1) + '</p>' }),
    ).toEqual({ htmlMaxLength: { max: STORY_MAX_CHARACTERS, actual: STORY_MAX_CHARACTERS + 1 } });
  });
});
