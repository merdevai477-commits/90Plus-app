import { filterPages, resolvePageSlug } from '../pageLinks';
import { parseRichText } from '../richTextParse';

describe('page links', () => {
  it('resolves English and Arabic aliases to the same screen', () => {
    expect(resolvePageSlug('rank')?.href).toBe('/(tabs)/rank');
    expect(resolvePageSlug('الترتيب')?.href).toBe('/(tabs)/rank');
    expect(resolvePageSlug('رانك')?.id).toBe('rank');
    expect(resolvePageSlug('ملك-اللعبة')?.href).toBe('/king-of-predictions');
    expect(resolvePageSlug('not-a-page')).toBeNull();
  });

  it('filters suggestions as the user types', () => {
    expect(filterPages('').length).toBeGreaterThan(5);
    expect(filterPages('ran').map((p) => p.id)).toContain('rank');
    expect(filterPages('ترتيب').map((p) => p.id)).toEqual(['rank']);
  });

  it('turns /rank and @all into tappable segments', () => {
    const segments = parseRichText('ادخل /rank أو /الترتيب و @all');
    expect(segments.filter((s) => s.kind === 'page').map((s) => (s.kind === 'page' ? s.href : ''))).toEqual([
      '/(tabs)/rank',
      '/(tabs)/rank',
    ]);
    expect(segments.some((s) => s.kind === 'everyone' && s.text === '@all')).toBe(true);
  });
});
