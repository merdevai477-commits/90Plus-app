import type { Fixture } from '../../services/apiFootball';
import { isMatchFinished, isMatchLive, formatMatchMinute } from '../../utils/matchStatusUtils';
import { WIDGET_PRIORITY_LEAGUE_IDS } from './constants';
import type { MatchesWidgetPayload, WidgetMatchRow, WidgetMatchStatus } from './types';

function shortenTeamName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length <= 14) return trimmed;
  const first = trimmed.split(/\s+/)[0] ?? trimmed;
  return first.length > 14 ? `${first.slice(0, 13)}…` : first;
}

function formatKickoff(dateIso: string): string {
  try {
    const d = new Date(dateIso);
    if (Number.isNaN(d.getTime())) return '--:--';
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false });
  } catch {
    return '--:--';
  }
}

function mapFixtureToRow(fixture: Fixture): WidgetMatchRow {
  const statusShort = fixture.fixture.status.short;
  const elapsed = fixture.fixture.status.elapsed;
  const live = isMatchLive(statusShort);
  const finished = isMatchFinished(statusShort);

  let status: WidgetMatchStatus = 'upcoming';
  if (live) status = 'live';
  else if (finished) status = 'finished';

  const homeScore =
    live || finished ? fixture.goals.home ?? fixture.score.fulltime.home ?? 0 : null;
  const awayScore =
    live || finished ? fixture.goals.away ?? fixture.score.fulltime.away ?? 0 : null;

  let statusLabel = formatKickoff(fixture.fixture.date);
  if (live) {
    statusLabel = formatMatchMinute(statusShort, elapsed) ?? statusShort;
  } else if (finished) {
    statusLabel = 'FT';
  } else if (statusShort === 'NS' || statusShort === 'TBD') {
    statusLabel = formatKickoff(fixture.fixture.date);
  }

  const homeName = fixture.teams.home.name;
  const awayName = fixture.teams.away.name;

  return {
    id: String(fixture.fixture.id),
    fixtureId: fixture.fixture.id,
    homeName,
    awayName,
    homeShort: shortenTeamName(homeName),
    awayShort: shortenTeamName(awayName),
    homeScore,
    awayScore,
    status,
    statusLabel,
    league: fixture.league.name,
    kickoff: formatKickoff(fixture.fixture.date),
  };
}

function sortRows(rows: WidgetMatchRow[], fixtureMeta: Map<string, Fixture>): WidgetMatchRow[] {
  return [...rows].sort((a, b) => {
    if (a.status === 'live' && b.status !== 'live') return -1;
    if (a.status !== 'live' && b.status === 'live') return 1;

    const fa = fixtureMeta.get(a.id);
    const fb = fixtureMeta.get(b.id);
    const aTop = fa ? WIDGET_PRIORITY_LEAGUE_IDS.has(fa.league.id) : false;
    const bTop = fb ? WIDGET_PRIORITY_LEAGUE_IDS.has(fb.league.id) : false;
    if (aTop && !bTop) return -1;
    if (!aTop && bTop) return 1;

    const aTs = fa?.fixture.timestamp ?? 0;
    const bTs = fb?.fixture.timestamp ?? 0;
    return aTs - bTs;
  });
}

export function buildWidgetPayload(fixtures: Fixture[], max = 8): MatchesWidgetPayload {
  const fixtureMeta = new Map<string, Fixture>();
  for (const f of fixtures) {
    fixtureMeta.set(String(f.fixture.id), f);
  }

  const rows = sortRows(
    fixtures.map(mapFixtureToRow),
    fixtureMeta,
  ).slice(0, max);

  return {
    updatedAt: Date.now(),
    liveCount: rows.filter((m) => m.status === 'live').length,
    matches: rows,
  };
}
