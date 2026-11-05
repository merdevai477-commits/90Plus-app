import { filterPages, resolvePageCommand, resolvePageSlug } from '../pageLinks';
import { parseRichText } from '../richTextParse';

describe('page links', () => {
  it('resolves English and Arabic aliases to the same screen', () => {
    expect(resolvePageSlug('rank')?.href).toBe('/(tabs)/rank');
    expect(resolvePageSlug('الترتيب')?.href).toBe('/(tabs)/rank');
    expect(resolvePageSlug('رانك')?.id).toBe('rank');
    expect(resolvePageSlug('ملك-اللعبة')?.href).toBe('/king-of-predictions/week?mode=game');
    expect(resolvePageSlug('ملك-النتائج')?.id).toBe('king-results');
    expect(resolvePageSlug('شارك واربح')?.href).toBe('/share-win');
    expect(resolvePageSlug('not-a-page')).toBeNull();
  });

  it('keeps personal screens out of the tag list', () => {
    for (const slug of ['profile', 'notifications', 'community', 'ai', 'الاشعارات', 'البروفايل', 'المجتمع']) {
      expect(resolvePageSlug(slug)).toBeNull();
    }
  });

  it('filters suggestions as the user types', () => {
    expect(filterPages('').map((p) => p.id)).not.toContain('profile');
    expect(filterPages('ran').map((p) => p.id)).toContain('rank');
    expect(filterPages('ترتيب').map((p) => p.id)).toEqual(['rank']);
    expect(filterPages('search-الأهلي')[0]).toMatchObject({
      href: '/search?q=%D8%A7%D9%84%D8%A3%D9%87%D9%84%D9%8A',
    });
  });

  it('turns page names and a prefilled club search into links', () => {
    const segments = parseRichText('ادخل /rank أو /شارك واربح و /search-premier league و /بحث-الأهلي');
    const pages = segments.filter((s) => s.kind === 'page');
    expect(pages.map((s) => (s.kind === 'page' ? s.href : ''))).toEqual([
      '/(tabs)/rank',
      '/share-win',
      '/search?q=premier%20league',
      '/search?q=%D8%A7%D9%84%D8%A3%D9%87%D9%84%D9%8A',
    ]);
    expect(resolvePageCommand('results')?.href).toBe('/king-of-predictions/week?mode=results');
  });
});
