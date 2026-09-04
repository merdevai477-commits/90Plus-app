/**
 * Project full API-Football fixture objects down to the Matches list shape.
 * Additive ?view=list only — does not change the shared DTO for other consumers.
 */

type AnyRecord = Record<string, unknown>;

function asRecord(value: unknown): AnyRecord | null {
  return value && typeof value === 'object' ? (value as AnyRecord) : null;
}

/**
 * Keep only fields consumed by mapFixtureToMatch / MatchRow list rendering.
 * Drops score/venue/referee/winner/duplicate crowdPrediction and other dead weight.
 */
export function projectFixtureForListView(fixture: unknown): unknown {
  const f = asRecord(fixture);
  if (!f) return fixture;

  const fx = asRecord(f.fixture) ?? {};
  const status = asRecord(fx.status) ?? {};
  const periods = asRecord(fx.periods) ?? {};
  const league = asRecord(f.league) ?? {};
  const teams = asRecord(f.teams) ?? {};
  const home = asRecord(teams.home) ?? {};
  const away = asRecord(teams.away) ?? {};
  const goals = asRecord(f.goals) ?? {};

  const crowd =
    f._crowdPrediction ?? f.crowdPrediction ?? undefined;

  const out: AnyRecord = {
    fixture: {
      id: fx.id,
      date: fx.date,
      periods: {
        first: periods.first ?? null,
        second: periods.second ?? null,
      },
      status: {
        short: status.short,
        elapsed: status.elapsed ?? null,
        extra: status.extra ?? null,
      },
    },
    league: {
      id: league.id,
      name: league.name,
      logo: league.logo,
      country: league.country,
      flag: league.flag,
      round: league.round,
    },
    teams: {
      home: { name: home.name, logo: home.logo },
      away: { name: away.name, logo: away.logo },
    },
    goals: {
      home: goals.home ?? null,
      away: goals.away ?? null,
    },
  };

  if (crowd != null) {
    out._crowdPrediction = crowd;
  }

  return out;
}

export function projectMatchesForListView(matches: unknown[]): unknown[] {
  if (!Array.isArray(matches)) return [];
  return matches.map(projectFixtureForListView);
}
