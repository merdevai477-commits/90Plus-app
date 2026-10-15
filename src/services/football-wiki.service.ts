/**
 * Encyclopedia fallback for football people the live feeds don't carry —
 * retired legends and historical players/coaches (أبو تريكة، وائل جمعة، الجوهري…).
 * 365Scores only indexes active athletes, so without this the agent answered
 * "مفيش نتيجة" for the players fans ask about most.
 *
 * Uses the public Wikipedia API (Arabic first for Arabic queries, then English),
 * accepts only pages whose title closely matches the query AND that are clearly
 * about association football, and returns a trimmed extract (lead + career /
 * honours sections) for the agent to answer from.
 */

import { logger } from '../utils/logger';
import type { MessageLanguage } from '../utils/message-language.util';
import { containsArabicScript, foldArabic, scoreEntityNameMatch } from './quiz-name-match.util';

export interface FootballWikiEntry {
  title: string;
  lang: 'ar' | 'en';
  description: string | null;
  extract: string;
  url: string;
}

const USER_AGENT = '90PlusAgent/1.0 (https://90plus.pro; support@90plus.pro)';
const REQUEST_TIMEOUT_MS = 6000;
const CACHE_TTL_MS = 12 * 60 * 60 * 1000;
const NEGATIVE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 400;
const TITLE_MATCH_MIN = 0.74;

const LEAD_BUDGET = 1600;
const SECTIONS_BUDGET = 3200;

const FOOTBALL_RE = /كرة\s*(?:ال)?قدم|footballer|association football|\bfootball\b|\bsoccer\b/i;
const OTHER_SPORT_RE = /كرة\s*(?:ال)?(?:سلة|يد|طائرة)|basketball|handball|volleyball|american football/i;

const PRIORITY_SECTION_RE =
  /إنجاز|انجاز|ألقاب|القاب|بطولات|جوائز|تكريم|مسيرة|المسيرة|الدولية|المنتخب|إحصائيات|احصائيات|أرقام|ارقام|اعتزال|honours|honors|achievements|awards|career|international|statistics|records|retirement/i;
const DROP_SECTION_RE =
  /مراجع|المراجع|وصلات خارجية|انظر أيضا|انظر أيضًا|ملاحظات|مصادر|الحياة الشخصية|references|external links|see also|notes|sources|bibliography|further reading/i;

type CacheValue = { at: number; entry: FootballWikiEntry | null };
const cache = new Map<string, CacheValue>();

function cacheGet(key: string): FootballWikiEntry | null | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  const ttl = hit.entry ? CACHE_TTL_MS : NEGATIVE_TTL_MS;
  if (Date.now() - hit.at > ttl) {
    cache.delete(key);
    return undefined;
  }
  return hit.entry;
}

function cacheSet(key: string, entry: FootballWikiEntry | null): void {
  if (cache.size >= CACHE_MAX) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
  cache.set(key, { at: Date.now(), entry });
}

async function wikiGet(lang: 'ar' | 'en', params: Record<string, string>): Promise<any | null> {
  const qs = new URLSearchParams({ format: 'json', formatversion: '2', ...params });
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`https://${lang}.wikipedia.org/w/api.php?${qs.toString()}`, {
      headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' },
      signal: controller.signal,
    });
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    logger.warn(`[football-wiki] ${lang} request failed:`, (err as Error)?.message ?? err);
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function stripTitleQualifier(title: string): string {
  return title.replace(/\s*\([^)]*\)\s*$/, '').trim();
}

function titleScore(query: string, title: string): number {
  const base = stripTitleQualifier(title);
  return Math.max(
    scoreEntityNameMatch(query, base),
    scoreEntityNameMatch(foldArabic(query), foldArabic(base)),
  );
}

/** Lead paragraph + career/honours sections, within a fixed character budget. */
function condenseExtract(wikiText: string): string {
  const parts = wikiText.split(/\n(?===+\s*[^=]+?\s*==+)/);
  const lead = (parts.shift() ?? '').trim().slice(0, LEAD_BUDGET);

  const kept: string[] = [];
  let used = 0;
  const sections = parts
    .map((block) => {
      const header = block.match(/^==+\s*([^=]+?)\s*==+/)?.[1]?.trim() ?? '';
      const body = block.replace(/^==+[^=]+==+\s*/, '').replace(/\n{2,}/g, '\n').trim();
      return { header, body };
    })
    .filter((s) => s.body && !DROP_SECTION_RE.test(s.header));

  const ordered = [
    ...sections.filter((s) => PRIORITY_SECTION_RE.test(s.header)),
    ...sections.filter((s) => !PRIORITY_SECTION_RE.test(s.header)),
  ];
  for (const s of ordered) {
    if (used >= SECTIONS_BUDGET) break;
    const room = SECTIONS_BUDGET - used;
    const chunk = `[${s.header}]\n${s.body}`.slice(0, room);
    kept.push(chunk);
    used += chunk.length;
  }
  return [lead, ...kept].filter(Boolean).join('\n\n');
}

async function lookupInLanguage(query: string, lang: 'ar' | 'en'): Promise<FootballWikiEntry | null> {
  const search = await wikiGet(lang, {
    action: 'query',
    list: 'search',
    srsearch: query,
    srlimit: '6',
    srprop: '',
  });
  const titles: string[] = (search?.query?.search ?? []).map((r: { title: string }) => r.title);
  const ranked = titles
    .map((title) => ({ title, score: titleScore(query, title) }))
    .filter((t) => t.score >= TITLE_MATCH_MIN)
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);

  for (const { title } of ranked) {
    const page = await wikiGet(lang, {
      action: 'query',
      prop: 'extracts|description',
      explaintext: '1',
      exsectionformat: 'wiki',
      redirects: '1',
      titles: title,
    });
    const p = page?.query?.pages?.[0];
    const text: string = p?.extract ?? '';
    if (!text || p?.missing) continue;
    const description: string | null = p?.description ?? null;
    const head = `${description ?? ''}\n${text.slice(0, 900)}`;
    if (!FOOTBALL_RE.test(head) || (OTHER_SPORT_RE.test(head) && !FOOTBALL_RE.test(description ?? ''))) {
      continue;
    }
    const resolvedTitle: string = p?.title ?? title;
    return {
      title: resolvedTitle,
      lang,
      description,
      extract: condenseExtract(text),
      url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(resolvedTitle.replace(/ /g, '_'))}`,
    };
  }
  return null;
}

export async function lookupFootballWiki(
  rawQuery: string,
  language: MessageLanguage,
): Promise<FootballWikiEntry | null> {
  const query = rawQuery.replace(/[؟?!.,،"«»]/g, ' ').replace(/\s+/g, ' ').trim();
  if (query.length < 3 || query.length > 60) return null;

  const key = `${language}:${foldArabic(query).toLowerCase()}`;
  const cached = cacheGet(key);
  if (cached !== undefined) return cached;

  const order: Array<'ar' | 'en'> = containsArabicScript(query) ? ['ar', 'en'] : ['en', 'ar'];
  let entry: FootballWikiEntry | null = null;
  for (const lang of order) {
    entry = await lookupInLanguage(query, lang);
    if (entry) break;
  }
  cacheSet(key, entry);
  logger.info(`[football-wiki] q="${query}" → ${entry ? `${entry.lang}:${entry.title}` : 'none'}`);
  return entry;
}

export function buildEncyclopediaPayload(
  query: string,
  entry: FootballWikiEntry,
  language: MessageLanguage,
) {
  return {
    status: 'ok',
    source: 'encyclopedia',
    query,
    title: entry.title,
    description: entry.description,
    encyclopedia: {
      lang: entry.lang,
      extract: entry.extract,
    },
    answerHint:
      language === 'en'
        ? 'This football figure is not in the live-data feed (usually retired or historical). Use this encyclopedia text as your reference and answer confidently: who they are, position, clubs and national team, main titles/achievements, and any numbers stated in the text. Structure it (one-line intro, then short bullets or a compact table for career/titles). Never say "no data". Do not add numbers or titles that are not in the text. Translate to the user\'s language.'
        : 'الشخصية دي مش موجودة في قاعدة بيانات المباريات اللحظية (غالبًا معتزل أو تاريخي). استخدم النص الموسوعي ده كمرجع وجاوب بثقة: مين هو، مركزه، النوادي والمنتخب، أهم الألقاب والإنجازات، والأرقام المذكورة في النص. نظّم الرد (سطر تعريف + نقط قصيرة أو جدول مضغوط للمسيرة/الألقاب). ممنوع تقول "مفيش بيانات"، وممنوع تضيف أرقام أو ألقاب مش موجودة في النص. لو النص إنجليزي ترجمه بالعامية المصرية.',
  };
}
