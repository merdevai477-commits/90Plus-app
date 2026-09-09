import { build365CompetitorLogo } from './scores365Adapters';
import { buildScores365AthletePhotoUrl } from './scores365AthletePhoto';

export type ChatNavLinkType = 'player' | 'club' | 'match' | 'matches';

export type ChatNavLink = {
  type: ChatNavLinkType;
  label: string;
  id?: number;
  query?: string;
  photo?: string | null;
  logo?: string | null;
  teamName?: string | null;
  teamId?: number | string | null;
  country?: string | null;
  choice?: boolean;
  subtitle?: string | null;
};

export type ChatNavAvatar =
  | { kind: 'player'; uri: string }
  | { kind: 'club'; uri: string }
  | { kind: 'icon' };

function httpUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

/** Headshot / crest for the chat CTA, with a 365Scores fallback from the entity id. */
export function resolveChatNavAvatar(link: ChatNavLink): ChatNavAvatar {
  if (link.type === 'player') {
    const uri = httpUrl(link.photo) || (link.id ? buildScores365AthletePhotoUrl(link.id, 80) : null);
    if (uri) return { kind: 'player', uri };
  }
  if (link.type === 'club') {
    const uri = httpUrl(link.logo) || (link.id ? build365CompetitorLogo(link.id) : null);
    if (uri) return { kind: 'club', uri };
  }
  return { kind: 'icon' };
}

/** Club crest for the player-card overlay (logo URL or 365Scores teamId). */
export function resolveChatNavClubBadge(link: ChatNavLink): string | null {
  const fromLogo = httpUrl(link.logo);
  if (fromLogo) return fromLogo;
  const teamId = Number(link.teamId);
  if (Number.isFinite(teamId) && teamId > 0) {
    const uri = build365CompetitorLogo(teamId);
    return uri || null;
  }
  return null;
}

const NAV_MARKER_RE = /\n?<!--90plus-nav:([\s\S]*?)-->\s*$/;

function isRecord(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function positiveId(v: unknown): number | null {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.trunc(n) : null;
}

function asLabel(v: unknown, fallback = ''): string {
  const s = typeof v === 'string' ? v.trim() : '';
  return s || fallback;
}

export function isBareSharedClubQuery(message: string): boolean {
  const q = (message ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return false;
  if (/بنك|bank/i.test(q)) return false;
  if (/مصر|مصري|سعود|جدة|egypt|saudi|jeddah/i.test(q)) return false;
  return /(?:ال)?أ?اهلي|al[-\s]?ahl[yi]/i.test(q);
}

export function sharedClubDisambiguationLinks(language: 'ar' | 'en'): ChatNavLink[] {
  const clubs = [
    { id: 8200, ar: 'الأهلي المصري', en: 'Al Ahly (Egypt)', subAr: 'مصر', subEn: 'Egypt' },
    { id: 8946, ar: 'الأهلي السعودي', en: 'Al Ahli (Saudi)', subAr: 'السعودية', subEn: 'Saudi Arabia' },
  ];
  return clubs.map((c) => ({
    type: 'club' as const,
    id: c.id,
    label: language === 'en' ? c.en : c.ar,
    query: language === 'en' ? c.en : c.ar,
    choice: true,
    subtitle: language === 'en' ? c.subEn : c.subAr,
    logo: build365CompetitorLogo(c.id) || null,
  }));
}

export function sanitizeChatNavLinks(raw: unknown): ChatNavLink[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatNavLink[] = [];
  for (const item of raw) {
    if (!isRecord(item)) continue;
    const type = item.type;
    if (type !== 'player' && type !== 'club' && type !== 'match' && type !== 'matches') continue;
    const label = asLabel(item.label, type);
    const id = positiveId(item.id) ?? undefined;
    const query = asLabel(item.query) || undefined;
    if (type !== 'matches' && !id && !query && !label) continue;
    out.push({
      type,
      ...(id ? { id } : {}),
      label,
      ...(query ? { query } : {}),
      photo: httpUrl(item.photo),
      logo: httpUrl(item.logo),
      teamName: typeof item.teamName === 'string' ? item.teamName : null,
      teamId: item.teamId == null ? null : (item.teamId as number | string),
      country: typeof item.country === 'string' ? item.country : null,
      ...(item.choice === true ? { choice: true } : {}),
      subtitle: typeof item.subtitle === 'string' ? item.subtitle : null,
    });
  }
  return out;
}

export function decodeChatNavMarker(text: string): { text: string; navLinks: ChatNavLink[] } {
  const source = text ?? '';
  const match = source.match(NAV_MARKER_RE);
  if (!match || match.index == null) return { text: source, navLinks: [] };
  try {
    const navLinks = sanitizeChatNavLinks(JSON.parse(match[1]));
    return { text: source.slice(0, match.index).trimEnd(), navLinks };
  } catch {
    return { text: source.replace(NAV_MARKER_RE, '').trimEnd(), navLinks: [] };
  }
}

export function stripChatNavMarker(text: string): string {
  return decodeChatNavMarker(text).text;
}

export function inferChatNavLinksFromQuestion(
  question: string,
  language: 'ar' | 'en',
): ChatNavLink[] {
  const q = (question ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return [];
  if (/نظام\s*أكل|نظام\s*اكل|دايت|رجيم|\bdiet\b|تدريب|تمرين|\btraining\b|استشفاء|\brecovery\b/i.test(q)) {
    return [];
  }

  const matches =
    /مباريات|ماتشات|\bmatches\b|جدول\s*اليوم|مواعيد\s*اليوم/i.test(q) ||
    (/(النهاردة|اليوم|\btoday\b)/i.test(q) && /مبار|ماتش|\bmatch/i.test(q)) ||
    /لايف|مباشر|\blive\b/.test(q);
  const matchOnly = /مباراة|مباراه|\bvs\b|ضد\s|\bfixture\b|\bmatch\b|ماتش/.test(q) && !matches;
  const club =
    /نادي|فريق|\bclub\b|\bteam\b|تشكيلة|تشكيله|هدافين|مدرب/.test(q) ||
    /الأهلي|اهلي|الزمالك|زمالك|بيراميدز|ريال|برشلون|ليفربول|مانشستر|بايرن|تشيلسي|آرسنال|يوفنتوس|ميلان|باريس|الهلال|النصر|الاتحاد|Al Ahly|Zamalek|Liverpool|Barcelona|Madrid/i.test(
      q,
    );
  const player = /لاعب|\bplayer\b|بيلعب|إحصائ|احصائ|سيزون|موسم|ألقاب|القاب|هداف(?!ين)|صناعة|صانع/.test(q);

  const out: ChatNavLink[] = [];
  if (player) {
    out.push({
      type: 'player',
      label: language === 'en' ? 'Player profile' : 'بروفايل اللاعب',
      query: q,
    });
  }
  if (isBareSharedClubQuery(q)) {
    out.push(...sharedClubDisambiguationLinks(language));
  } else if (club) {
    out.push({
      type: 'club',
      label: language === 'en' ? 'Club profile' : 'بروفايل الفريق',
      query: q,
    });
  }
  if (matches) {
    out.push({
      type: 'matches',
      label: language === 'en' ? "Today's matches" : 'مباريات اليوم',
    });
  } else if (matchOnly) {
    out.push({
      type: 'match',
      label: language === 'en' ? 'Match details' : 'تفاصيل المباراة',
      query: q,
    });
  }
  return out.some((l) => l.choice) ? out.slice(0, 4) : out.slice(0, 2);
}
