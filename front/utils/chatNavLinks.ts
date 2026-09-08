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
};

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
      photo: typeof item.photo === 'string' ? item.photo : null,
      logo: typeof item.logo === 'string' ? item.logo : null,
      teamName: typeof item.teamName === 'string' ? item.teamName : null,
      teamId: item.teamId == null ? null : (item.teamId as number | string),
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
  if (club) {
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
  return out.slice(0, 2);
}
