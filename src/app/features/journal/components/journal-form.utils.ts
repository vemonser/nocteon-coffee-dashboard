/** Tags as the editor types them: comma-separated, trimmed, empty entries dropped. */
export function parseTags(input: string | null | undefined): string[] {
  return (input ?? '')
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0);
}

export interface PreviewTranslation {
  language?: string;
  title?: string;
  excerpt?: string;
  content?: string;
}

/**
 * Which language the preview shows.
 *
 * <p>Both form groups always exist, so the dashboard language's group can be empty while the
 * other one holds the draft. Prefer the current language, then English, then any language that
 * actually has text — never an empty group just because the group exists.
 */
export function pickPreviewTranslation(
  values: PreviewTranslation[],
  language: string,
): PreviewTranslation {
  const hasText = (t: PreviewTranslation | undefined) =>
    !!(t?.title?.trim() || t?.content?.trim());
  return (
    values.find((t) => t.language === language && hasText(t)) ??
    values.find((t) => t.language === 'en' && hasText(t)) ??
    values.find(hasText) ??
    values.find((t) => t.language === language) ??
    values[0] ??
    {}
  );
}

