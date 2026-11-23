/**
 * Strip Google Translate / XLIFF inline markers and leftover HTML-ish tags
 * that sometimes leak into football entity names from providers or MT APIs.
 *
 * Example: `<g id="1"><g id="2">العربي</g></g>` → `العربي`
 */
export function stripTranslationMarkup(text: string | null | undefined): string {
  const raw = (text ?? '').toString();
  if (!raw.includes('<')) return raw.trim();

  return raw
    .replace(/<\/?(?:g|x|b|i|em|strong|ph|mrk)\b[^>]*>/gi, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}
