/**
 * Text length of an HTML fragment, for character counters.
 *
 * <p>The story editor stores HTML. A counter that counted tags would show
 * "412" for a 90-character sentence, so the tags come off first and the
 * entities a rich-text editor produces (`&nbsp;`, `&amp;`) count as the single
 * character they render as.
 */
export function htmlToText(html: string | null | undefined): string {
  if (!html) return '';
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function htmlTextLength(html: string | null | undefined): number {
  return htmlToText(html).length;
}

/**
 * The story's hard limit, counted as TEXT (tags stripped).
 *
 * <p>The API's own limit is on the raw HTML string (20000 characters), so the
 * two are not the same measure. The UI keeps the tighter, reader-facing 2000
 * and INPUT_AUDIT.md records the mismatch under "Needs backend".
 */
export const STORY_MAX_CHARACTERS = 2000;

export function maxHtmlTextLength(max: number) {
  return (control: { value: unknown }) => {
    const length = htmlTextLength(
      typeof control.value === 'string' ? control.value : '',
    );
    return length > max ? { htmlMaxLength: { max, actual: length } } : null;
  };
}
