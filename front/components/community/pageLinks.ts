/**
 * Public page tags. `/rank` and `/الترتيب` open the same screen.
 * Profile, notifications, community and AI stay out: those screens are personal.
 * `/search-premier league` and `/بحث-الأهلي` open club and league search
 * with that name already filled in.
 */

export interface AppPage {
  id: string;
  /** Expo route, optionally with a query string. */
  href: string;
  /** Token written into a post, without the slash. */
  token: string;
  /** Overrides the inserted text when it is not `/${token}`. */
  insert?: string;
  labelAr: string;
  labelEn: string;
  aliases: readonly string[];
}

export const APP_PAGES: readonly AppPage[] = [
  {
    id: 'rank',
    href: '/(tabs)/rank',
    token: 'rank',
    labelAr: 'الترتيب',
    labelEn: 'Rank',
    aliases: ['rank', 'ranking', 'rankings', 'الترتيب', 'الرانك', 'رانك', 'ترتيب'],
  },
  {
    id: 'matches',
    href: '/(tabs)/matches',
    token: 'matches',
    labelAr: 'المباريات',
    labelEn: 'Matches',
    aliases: ['matches', 'match', 'المباريات', 'مباريات', 'ماتشات'],
  },
  {
    id: 'reels',
    href: '/(tabs)/reels',
    token: 'reels',
    labelAr: 'الريلز',
    labelEn: 'Reels',
    aliases: ['reels', 'reel', 'الريلز', 'ريلز'],
  },
  {
    id: 'coach-king',
    href: '/coach-king',
    token: 'coach-king',
    labelAr: 'ملك المدربين',
    labelEn: 'King of Coaches',
    aliases: ['coach-king', 'coaches', 'coach', 'ملك-المدربين', 'المدربين', 'ملك_المدربين'],
  },
  {
    id: 'king',
    href: '/king-of-predictions/week?mode=game',
    token: 'king',
    labelAr: 'ملك اللعبة',
    labelEn: 'King of the Game',
    aliases: ['king', 'game', 'ملك-اللعبة', 'ملك_اللعبة', 'اللعبة', 'ملك-اللعبه'],
  },
  {
    id: 'king-results',
    href: '/king-of-predictions/week?mode=results',
    token: 'results',
    labelAr: 'ملك النتائج',
    labelEn: 'King of Results',
    aliases: ['results', 'king-results', 'ملك-النتائج', 'ملك-النتايج', 'النتائج', 'نتايج', 'ملك_النتائج'],
  },
  {
    id: 'share-win',
    href: '/share-win',
    token: 'share-win',
    labelAr: 'شارك واربح',
    labelEn: 'Share & Win',
    aliases: ['share-win', 'share', 'شارك-واربح', 'شارك واربح', 'شارك_واربح'],
  },
  {
    id: 'top-scorers',
    href: '/top-scorers-five',
    token: 'scorers',
    labelAr: 'خماسي الهدافين',
    labelEn: 'Top Scorers',
    aliases: ['scorers', 'top-scorers', 'خماسي-الهدافين', 'خماسي الهدافين', 'الهدافين', 'هدافين'],
  },
  {
    id: 'predict',
    href: '/(tabs)/predict-and-win',
    token: 'predict',
    labelAr: 'توقع واربح',
    labelEn: 'Predict & Win',
    aliases: ['predict', 'predict-and-win', 'توقع', 'توقع-واربح', 'توقع واربح'],
  },
  {
    id: 'search',
    href: '/search',
    token: 'search',
    insert: '/search-',
    labelAr: 'بحث الأندية والدوريات',
    labelEn: 'Clubs & leagues',
    aliases: ['search', 'بحث', 'البحث'],
  },
];

function fold(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/_/g, '-');
}

const BY_ALIAS = new Map<string, AppPage>();
for (const page of APP_PAGES) {
  for (const alias of [page.token, ...page.aliases]) BY_ALIAS.set(fold(alias), page);
}

export function resolvePageSlug(raw: string): AppPage | null {
  return BY_ALIAS.get(fold(raw)) ?? null;
}

const SEARCH_HEAD = /^(search|بحث|البحث)(?=$|[-\s])/iu;
const SEARCH_WORDS =
  /^(?:[\p{L}\p{N}][\p{L}\p{N}.'’\-]{0,40})(?:[-\s]+[\p{L}\p{N}][\p{L}\p{N}.'’\-]{0,40}){0,5}/u;

/** `/search-premier league` and `/بحث-الأهلي`. `consumed` is measured on `raw`. */
export function parseSearchCommand(raw: string): { query: string; consumed: number } | null {
  const head = raw.match(SEARCH_HEAD);
  if (!head) return null;
  const sep = raw.slice(head[0].length).match(/^[-\s]+/);
  if (!sep) return { query: '', consumed: head[0].length };
  const body = raw.slice(head[0].length + sep[0].length);
  const words = body.match(SEARCH_WORDS);
  if (!words) return { query: '', consumed: head[0].length };
  // A following "و" / "and" belongs to the sentence, not the club name.
  const kept = words[0].replace(/\s+(?:و|and|or)$/iu, '');
  const query = kept.replace(/-/g, ' ').replace(/\s+/g, ' ').trim();
  return { query, consumed: head[0].length + sep[0].length + kept.length };
}

export function searchHref(query: string): string {
  const q = query.trim();
  return q ? `/search?q=${encodeURIComponent(q)}` : '/search';
}

function aliasRegExp(alias: string): RegExp {
  const parts = alias
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
  return new RegExp(`^${parts.join('[-\\s_]+')}(?![\\p{L}\\p{N}_])`, 'iu');
}

/** Longest public page or search command at the start of `raw`. */
export function resolvePageCommand(raw: string): { href: string; consumed: number } | null {
  const search = parseSearchCommand(raw);
  if (search) return { href: searchHref(search.query), consumed: search.consumed };

  let best: { href: string; consumed: number } | null = null;
  for (const page of APP_PAGES) {
    if (page.id === 'search') continue;
    for (const alias of [page.token, ...page.aliases]) {
      const match = raw.match(aliasRegExp(alias));
      if (match?.[0] && (!best || match[0].length > best.consumed)) {
        best = { href: page.href, consumed: match[0].length };
      }
    }
  }
  return best;
}

/** Pages whose name, in either language, contains the text after `/`. */
export function filterPages(query: string): AppPage[] {
  const q = fold(query);
  const search = parseSearchCommand(query);
  const pages = !q
    ? [...APP_PAGES]
    : APP_PAGES.filter(
        (page) =>
          fold(page.token).includes(q) ||
          fold(page.labelAr).includes(q) ||
          fold(page.labelEn).includes(q) ||
          page.aliases.some((alias) => fold(alias).includes(q)) ||
          (search != null && page.id === 'search'),
      );

  if (!search?.query) return pages;
  const typed = query.replace(/^\//, '');
  const suggestion: AppPage = {
    id: `search:${search.query}`,
    href: searchHref(search.query),
    token: typed,
    insert: `/${typed}`,
    labelAr: `بحث: ${search.query}`,
    labelEn: `Search: ${search.query}`,
    aliases: [],
  };
  return [suggestion, ...pages.filter((page) => page.id !== 'search')];
}
