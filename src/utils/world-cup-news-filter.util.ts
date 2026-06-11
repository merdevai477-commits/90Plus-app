export type NewsLanguage = 'ar' | 'en';

const WC_EN =
  /world\s*cup|fifa(?:\s*world\s*cup|\s*2026)|mondial(?:\s*2026)?|wc\s*2026|2026\s*(?:fifa\s*)?world\s*cup/i;

const WC_AR =
  /كأس\s*العالم|كاس\s*العالم|المونديال|مونديال(?:\s*2026)?|فيفا(?:\s*2026|\s*2026)?|2026.*(?:كأس|مونديال)|(?:كأس|مونديال).*2026/u;

const NON_FOOTBALL_WC =
  /cricket\s*world\s*cup|rugby\s*world\s*cup|t20\s*world\s*cup|wimbledon|super\s*bowl/i;

export interface RawNewsArticle {
  title?: string | null;
  description?: string | null;
  url?: string | null;
  urlToImage?: string | null;
  publishedAt?: string | null;
  source?: { name?: string | null } | null;
}

export function isWorldCupNewsArticle(
  article: RawNewsArticle,
  language: NewsLanguage,
): boolean {
  const title = (article.title ?? '').trim();
  const description = (article.description ?? '').trim();
  const combined = `${title} ${description}`;

  if (!title || !article.url) return false;
  if (NON_FOOTBALL_WC.test(combined)) return false;

  return language === 'ar' ? WC_AR.test(combined) : WC_EN.test(combined);
}

export function filterWorldCupArticles<T extends RawNewsArticle>(
  articles: T[],
  language: NewsLanguage,
): T[] {
  return articles.filter((article) => isWorldCupNewsArticle(article, language));
}
