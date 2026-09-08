export type ChatNavLinkType = 'player' | 'club' | 'match' | 'matches';

export type ChatNavLink = {
  type: ChatNavLinkType;
  label: string;
  id?: number;
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

function asLabel(v: unknown, fallback: string): string {
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
    if (type === 'matches') {
      out.push({ type, label });
      continue;
    }
    const id = positiveId(item.id);
    if (!id) continue;
    out.push({
      type,
      id,
      label,
      photo: typeof item.photo === 'string' ? item.photo : null,
      logo: typeof item.logo === 'string' ? item.logo : null,
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
  const key = `${link.type}:${link.id ?? link.label}`;
  if (!map.has(key)) map.set(key, link);
}

function collectFixtures(node: unknown, into: unknown[]): void {
  if (!Array.isArray(node)) return;
  into.push(...node);
}

function fixtureIdFrom(node: unknown): number | null {
  if (!isRecord(node)) return null;
  return positiveId(node.fixtureId) || (isRecord(node.fixture) ? positiveId(node.fixture.id) : null);
}

export function extractChatNavLinks(
  payloads: string[],
  toolsUsed: string[],
  language: 'ar' | 'en',
): ChatNavLink[] {
  const used = new Set(toolsUsed);
  const wantMatches = used.has('get_today_matches') || used.has('get_live_matches');
  const wantMatch =
    wantMatches ||
    used.has('get_match_details') ||
    used.has('resolve_match') ||
    used.has('get_team_match') ||
    used.has('get_match_lineup') ||
    used.has('get_head_to_head');
  const wantPlayer =
    used.has('search_player') ||
    used.has('get_player_career') ||
    used.has('get_player_match_report') ||
    used.has('search_football');
  const wantClub =
    used.has('get_team_info') ||
    used.has('get_team_squad') ||
    used.has('get_team_scorers') ||
    used.has('get_team_match') ||
    used.has('search_football');

  const map = new Map<string, ChatNavLink>();
  const playerFallback = language === 'en' ? 'Player profile' : 'بروفايل اللاعب';
  const clubFallback = language === 'en' ? 'Club profile' : 'بروفايل النادي';
  const matchFallback = language === 'en' ? 'Match details' : 'تفاصيل المباراة';

  for (const raw of payloads) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!isRecord(parsed) || parsed.error || parsed.status === 'need_clarification') continue;

    const athleteId = positiveId(parsed.athleteId);
    if (athleteId && wantPlayer) {
      const profile = isRecord(parsed.profile) ? parsed.profile : null;
      addLink(map, {
        type: 'player',
        id: athleteId,
        label: asLabel(parsed.name ?? parsed.resolvedAs, playerFallback),
        photo: typeof profile?.imageUrl === 'string' ? profile.imageUrl : null,
        teamName: asLabel(parsed.club, '') || null,
        teamId: parsed.teamId == null ? null : (parsed.teamId as number | string),
      });
    }

    const competitorId = positiveId(parsed.competitorId);
    if (competitorId && wantClub && parsed.source !== '365scores_profile') {
      addLink(map, {
        type: 'club',
        id: competitorId,
        label: asLabel(parsed.teamName ?? parsed.name, clubFallback),
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

  if (wantMatches) {
    addLink(map, {
      type: 'matches',
      label: language === 'en' ? "Today's matches" : 'مباريات اليوم',
    });
  }

  const ranked = [...map.values()].sort((a, b) => {
    const order: Record<ChatNavLinkType, number> = { matches: 0, match: 1, player: 2, club: 3 };
    return order[a.type] - order[b.type];
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
    out.push(link);
    if (out.length >= 4) break;
  }
  return out;
}
