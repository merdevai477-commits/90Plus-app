/**
 * Decide whether a fixture event belongs on the home (right) or away (left) side
 * of the match-details timeline.
 *
 * Team ids from mixed API-Football / 365Scores feeds sometimes disagree, which
 * used to dump every unmatched event onto home and stack opposite teams.
 */

export type EventSideTeam = {
  id?: number | null;
  name?: string | null;
  logo?: string | null;
};

export type EventSideInput = {
  team?: EventSideTeam | null;
};

function foldName(value?: string | null): string {
  return (value || '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** Extract Competitors/{id} from a 365Scores crest URL when present. */
export function competitorIdFromLogo(logo?: string | null): number | null {
  if (!logo) return null;
  const match = /\/Competitors\/(\d+)/i.exec(logo);
  if (!match) return null;
  const id = Number(match[1]);
  return Number.isFinite(id) && id > 0 ? id : null;
}

function nameSide(
  eventName: string | null | undefined,
  homeName: string | null | undefined,
  awayName: string | null | undefined,
): boolean | null {
  const eventKey = foldName(eventName);
  if (!eventKey) return null;
  const homeKey = foldName(homeName);
  const awayKey = foldName(awayName);

  const homeHit = Boolean(homeKey) && (eventKey === homeKey || eventKey.includes(homeKey) || homeKey.includes(eventKey));
  const awayHit = Boolean(awayKey) && (eventKey === awayKey || eventKey.includes(awayKey) || awayKey.includes(eventKey));

  if (homeHit && !awayHit) return true;
  if (awayHit && !homeHit) return false;
  // Prefer the longer (more specific) key when both partially match.
  if (homeHit && awayHit) {
    if (homeKey.length !== awayKey.length) return homeKey.length > awayKey.length;
    return null;
  }
  return null;
}

function collectIds(team?: EventSideTeam | null): number[] {
  const ids: number[] = [];
  if (team?.id != null && team.id > 0) ids.push(team.id);
  const fromLogo = competitorIdFromLogo(team?.logo);
  if (fromLogo != null) ids.push(fromLogo);
  return [...new Set(ids)];
}

/**
 * @returns `true` = home/right, `false` = away/left
 */
export function isHomeSideEvent(
  event: EventSideInput,
  home: EventSideTeam,
  away: EventSideTeam,
): boolean {
  const eventIds = collectIds(event.team);
  const homeIds = new Set(collectIds(home));
  const awayIds = new Set(collectIds(away));

  let homeIdHit = false;
  let awayIdHit = false;
  for (const id of eventIds) {
    if (homeIds.has(id)) homeIdHit = true;
    if (awayIds.has(id)) awayIdHit = true;
  }
  if (homeIdHit && !awayIdHit) return true;
  if (awayIdHit && !homeIdHit) return false;

  const byName = nameSide(event.team?.name, home.name, away.name);
  if (byName != null) return byName;

  // Unknown attribution — keep previous home default only when nothing else works.
  return true;
}
