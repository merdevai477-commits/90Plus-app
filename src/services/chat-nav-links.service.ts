import { buildScores365AthletePhotoUrl } from '../utils/scores365-athlete-photo';

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

function httpUrl(v: unknown): string | null {
  if (typeof v !== 'string') return null;
  const s = v.trim();
  return /^https?:\/\//i.test(s) ? s : null;
}

function firstHttpUrl(...candidates: unknown[]): string | null {
  for (const c of candidates) {
    const u = httpUrl(c);
    if (u) return u;
  }
  return null;
}

function competitorLogoUrl(competitorId: number): string {
  return `https://imagecache.365scores.com/image/upload/f_png,w_80,h_80,c_limit,q_auto:eco,dpr_2/v1/Competitors/${competitorId}`;
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
    });
  }
  return out;
}

export function encodeChatNavMarker(text: string, links: ChatNavLink[]): string {
  if (!links.length) return text;
  const trimmed = text.replace(NAV_MARKER_RE, '').trimEnd();
  return `${trimmed}\n<!--90plus-nav:${JSON.stringify(links)}-->`;
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

function addLink(map: Map<string, ChatNavLink>, link: ChatNavLink): void {
  const key = `${link.type}:${link.id ?? link.query ?? link.label}`;
  const prev = map.get(key);
  if (!prev) {
    map.set(key, link);
    return;
  }
  map.set(key, {
    ...prev,
    ...link,
    id: link.id ?? prev.id,
    photo: link.photo || prev.photo,
    logo: link.logo || prev.logo,
    query: link.query || prev.query,
    teamName: link.teamName || prev.teamName,
    teamId: link.teamId ?? prev.teamId,
    label: link.label && link.label !== link.type ? link.label : prev.label,
  });
}

function collectFixtures(node: unknown, into: unknown[]): void {
  if (!Array.isArray(node)) return;
  into.push(...node);
}

function fixtureIdFrom(node: unknown): number | null {
  if (!isRecord(node)) return null;
  return positiveId(node.fixtureId) || (isRecord(node.fixture) ? positiveId(node.fixture.id) : null);
}

function firstRecord(list: unknown): Record<string, unknown> | null {
  return Array.isArray(list) && isRecord(list[0]) ? list[0] : null;
}

export function inferChatNavIntent(message: string): ChatNavLinkType[] {
  const q = (message ?? '').replace(/\s+/g, ' ').trim();
  if (q.length < 2) return [];
  if (/نظام\s*أكل|نظام\s*اكل|دايت|رجيم|\bdiet\b|تدريب|تمرين|\btraining\b|استشفاء|\brecovery\b/i.test(q)) {
    return [];
  }

  const types: ChatNavLinkType[] = [];
  const wantsMatches =
    /مباريات|ماتشات|\bmatches\b|جدول\s*اليوم|مواعيد\s*اليوم/i.test(q) ||
    (/(النهاردة|اليوم|\btoday\b)/i.test(q) && /مبار|ماتش|\bmatch/i.test(q)) ||
    /لايف|مباشر|\blive\b/.test(q);
  const wantsMatch =
    /مباراة|مباراه|\bvs\b|ضد\s|\bfixture\b|\bmatch\b|ماتش/.test(q) && !wantsMatches;
  const wantsClub =
    /نادي|فريق|\bclub\b|\bteam\b|تشكيلة|تشكيله|هدافين|مدرب/.test(q) ||
    /الأهلي|اهلي|الزمالك|زمالك|بيراميدز|ريال|برشلون|ليفربول|مانشستر|بايرن|تشيلسي|آرسنال|يوفنتوس|ميلان|باريس|الهلال|النصر|الاتحاد|Al Ahly|Zamalek|Liverpool|Barcelona|Madrid/i.test(
      q,
    );
  const wantsPlayer =
    /لاعب|\bplayer\b|بيلعب|إحصائ|احصائ|سيزون|موسم|ألقاب|القاب|هداف(?!ين)|صناعة|صانع/.test(q);

  if (wantsMatches) types.push('matches');
  if (wantsMatch) types.push('match');
  if (wantsPlayer) types.push('player');
  if (wantsClub) types.push('club');

  return types;
}

export function extractChatNavLinks(
  payloads: string[],
  toolsUsed: string[],
  language: 'ar' | 'en',
  userMessage?: string,
): ChatNavLink[] {
  const used = new Set(toolsUsed);
  const inferred = inferChatNavIntent(userMessage ?? '');
  const wantMatches =
    used.has('get_today_matches') || used.has('get_live_matches') || inferred.includes('matches');
  const wantMatch =
    wantMatches ||
    used.has('get_match_details') ||
    used.has('resolve_match') ||
    used.has('get_team_match') ||
    used.has('get_match_lineup') ||
    used.has('get_head_to_head') ||
    inferred.includes('match');
  const wantPlayer =
    used.has('search_player') ||
    used.has('get_player_career') ||
    used.has('get_player_match_report') ||
    inferred.includes('player');
  const wantClub =
    used.has('get_team_info') ||
    used.has('get_team_squad') ||
    used.has('get_team_scorers') ||
    used.has('get_team_match') ||
    inferred.includes('club');

  const map = new Map<string, ChatNavLink>();
  const playerFallback = language === 'en' ? 'Player profile' : 'بروفايل اللاعب';
  const clubFallback = language === 'en' ? 'Club profile' : 'بروفايل الفريق';
  const matchFallback = language === 'en' ? 'Match details' : 'تفاصيل المباراة';
  const matchesFallback = language === 'en' ? "Today's matches" : 'مباريات اليوم';
  const query = asLabel(userMessage);

  for (const raw of payloads) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || parsed.error) continue;

    const hits = isRecord(parsed.hits) ? parsed.hits : null;
    const profile = isRecord(parsed.profile) ? parsed.profile : null;
    const best = isRecord(parsed.best) ? parsed.best : null;
    const playerNode = isRecord(parsed.player) ? parsed.player : null;
    const playerHit = firstRecord(hits?.players);
    const clubHit = firstRecord(hits?.clubs);

    const athleteId =
      positiveId(parsed.athleteId) ||
      positiveId(profile?.athleteId) ||
      positiveId(best?.athleteId) ||
      positiveId(best?.id) ||
      positiveId(firstRecord(parsed.suggestions)?.athleteId) ||
      positiveId(playerHit?.athleteId);
    const playerName = asLabel(
      parsed.name ?? parsed.resolvedAs ?? best?.name ?? playerHit?.name,
    );
    const imageVersion =
      positiveId(profile?.imageVersion) ||
      positiveId(playerNode?.imageVersion) ||
      positiveId(playerHit?.imageVersion);
    if (athleteId) {
      addLink(map, {
        type: 'player',
        id: athleteId,
        label: playerName || playerFallback,
        photo:
          firstHttpUrl(
            profile?.imageUrl,
            parsed.imageUrl,
            playerNode?.imageUrl,
            playerHit?.imageUrl,
            playerHit?.photo,
          ) ?? buildScores365AthletePhotoUrl(athleteId, 80, imageVersion),
        teamName: asLabel(parsed.club ?? playerHit?.club) || null,
        teamId: parsed.teamId == null ? null : (parsed.teamId as number | string),
      });
    } else if (parsed.source === '365scores_profile') {
      addLink(map, {
        type: 'player',
        label: playerName || playerFallback,
        query: playerName || query,
        photo: firstHttpUrl(profile?.imageUrl, parsed.imageUrl, playerNode?.imageUrl),
      });
    }

    const competitorId =
      parsed.source === '365scores_profile'
        ? null
        : positiveId(parsed.competitorId) ||
          (best?.type === 'player' ? null : positiveId(best?.id)) ||
          positiveId(clubHit?.competitorId) ||
          positiveId(firstRecord(hits?.nationalTeams)?.competitorId);
    const clubName = asLabel(
      parsed.teamName ??
        (parsed.source === '365scores_profile' ? '' : parsed.name) ??
        best?.name ??
        clubHit?.name,
    );
    if (competitorId) {
      addLink(map, {
        type: 'club',
        id: competitorId,
        label: clubName || clubFallback,
        logo:
          firstHttpUrl(parsed.logo, parsed.imageUrl, clubHit?.logo, clubHit?.imageUrl) ??
          competitorLogoUrl(competitorId),
      });
    } else if (parsed.source === '365scores_team') {
      addLink(map, {
        type: 'club',
        label: clubName || clubFallback,
        query: clubName || query,
        logo: firstHttpUrl(parsed.logo, parsed.imageUrl),
      });
    }

    const matchNode = isRecord(parsed.match) ? parsed.match : parsed;
    const fixtureId = fixtureIdFrom(parsed) || fixtureIdFrom(matchNode);
    if (fixtureId && wantMatch && !wantMatches) {
      const home = isRecord(matchNode) ? matchNode.home : parsed.home;
      const away = isRecord(matchNode) ? matchNode.away : parsed.away;
      const label =
        typeof home === 'string' && typeof away === 'string' && home && away
          ? `${home} vs ${away}`
          : matchFallback;
      addLink(map, { type: 'match', id: fixtureId, label });
    }

    if (wantMatches) {
      const fixtures: unknown[] = [];
      collectFixtures(parsed.live, fixtures);
      collectFixtures(parsed.upcoming, fixtures);
      collectFixtures(parsed.finished, fixtures);
      collectFixtures(parsed.matches, fixtures);
      collectFixtures(isRecord(parsed.recentMatches) ? parsed.recentMatches.live : null, fixtures);
      collectFixtures(isRecord(parsed.recentMatches) ? parsed.recentMatches.upcoming : null, fixtures);
      collectFixtures(isRecord(parsed.recentMatches) ? parsed.recentMatches.finished : null, fixtures);
      for (const row of fixtures.slice(0, 8)) {
        if (!isRecord(row)) continue;
        const id = fixtureIdFrom(row);
        if (!id) continue;
        const label =
          typeof row.home === 'string' && typeof row.away === 'string' && row.home && row.away
            ? `${row.home} vs ${row.away}`
            : matchFallback;
        addLink(map, { type: 'match', id, label });
      }
    }
  }

  if (used.has('search_football')) {
    const hasPlayer = [...map.values()].some((l) => l.type === 'player');
    const hasClub = [...map.values()].some((l) => l.type === 'club');
    if (!hasPlayer && !hasClub) {
      if (inferred.includes('club')) {
        addLink(map, { type: 'club', label: clubFallback, query });
      } else {
        addLink(map, { type: 'player', label: playerFallback, query });
      }
    }
  }

  if (wantPlayer && ![...map.values()].some((l) => l.type === 'player')) {
    addLink(map, { type: 'player', label: playerFallback, query });
  }
  if (wantClub && ![...map.values()].some((l) => l.type === 'club')) {
    addLink(map, { type: 'club', label: clubFallback, query });
  }
  if (wantMatches) {
    addLink(map, { type: 'matches', label: matchesFallback });
  } else if (wantMatch && ![...map.values()].some((l) => l.type === 'match')) {
    addLink(map, { type: 'match', label: matchFallback, query });
  }

  if (!map.size && inferred.length) {
    for (const type of inferred) {
      addLink(map, {
        type,
        label:
          type === 'player'
            ? playerFallback
            : type === 'club'
              ? clubFallback
              : type === 'match'
                ? matchFallback
                : matchesFallback,
        ...(type === 'matches' ? {} : { query }),
      });
    }
  }

  const ranked = [...map.values()].sort((a, b) => {
    const order: Record<ChatNavLinkType, number> = { player: 0, club: 1, matches: 2, match: 3 };
    const typeDelta = order[a.type] - order[b.type];
    if (typeDelta !== 0) return typeDelta;
    return (b.id ? 1 : 0) - (a.id ? 1 : 0);
  });

  const out: ChatNavLink[] = [];
  let matchCount = 0;
  for (const link of ranked) {
    if (link.type === 'match') {
      if (matchCount >= 3) continue;
      matchCount += 1;
    }
    if (link.type === 'player' && out.some((x) => x.type === 'player')) continue;
    if (link.type === 'club' && out.some((x) => x.type === 'club')) continue;
    if (link.type === 'matches' && out.some((x) => x.type === 'matches')) continue;
    out.push(link);
    if (out.length >= 4) break;
  }
  return out;
}
