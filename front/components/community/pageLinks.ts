/**
 * In-app page tags. `/rank` and `/الترتيب` both open the rank screen.
 * Aliases are matched case-insensitively; Arabic alef/teh variants fold together.
 */

export interface AppPage {
  id: string;
  /** Expo route. */
  href: string;
  /** Token written into a post, without the slash. */
  token: string;
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
    id: 'community',
    href: '/(tabs)/community',
    token: 'community',
    labelAr: 'المجتمع',
    labelEn: 'Community',
    aliases: ['community', 'المجتمع', 'مجتمع'],
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
    id: 'ai',
    href: '/(tabs)/chat',
    token: 'ai',
    labelAr: 'المساعد',
    labelEn: 'AI',
    aliases: ['ai', 'chat', 'الشات', 'شات', 'الذكاء'],
  },
  {
    id: 'profile',
    href: '/(tabs)/profile',
    token: 'profile',
    labelAr: 'حسابي',
    labelEn: 'Profile',
    aliases: ['profile', 'me', 'حسابي', 'الملف', 'بروفايل'],
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
    href: '/king-of-predictions',
    token: 'king',
    labelAr: 'ملك اللعبة',
    labelEn: 'King of the Game',
    aliases: ['king', 'game', 'ملك-اللعبة', 'ملك_اللعبة', 'اللعبة', 'ملك-اللعبه'],
  },
  {
    id: 'predict',
    href: '/(tabs)/predict-and-win',
    token: 'predict',
    labelAr: 'توقع واربح',
    labelEn: 'Predict & Win',
    aliases: ['predict', 'predict-and-win', 'توقع', 'توقع-واربح'],
  },
  {
    id: 'notifications',
    href: '/notifications',
    token: 'notifications',
    labelAr: 'الإشعارات',
    labelEn: 'Notifications',
    aliases: ['notifications', 'notification', 'الاشعارات', 'الإشعارات', 'اشعارات'],
  },
  {
    id: 'search',
    href: '/search',
    token: 'search',
    labelAr: 'البحث',
    labelEn: 'Search',
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
  for (const alias of page.aliases) BY_ALIAS.set(fold(alias), page);
}

export function resolvePageSlug(raw: string): AppPage | null {
  return BY_ALIAS.get(fold(raw)) ?? null;
}

/** Pages whose name, in either language, contains the text after `/`. */
export function filterPages(query: string): AppPage[] {
  const q = fold(query);
  if (!q) return [...APP_PAGES];
  return APP_PAGES.filter(
    (page) =>
      fold(page.token).includes(q) ||
      fold(page.labelAr).includes(q) ||
      fold(page.labelEn).includes(q) ||
      page.aliases.some((alias) => fold(alias).includes(q)),
  );
}
