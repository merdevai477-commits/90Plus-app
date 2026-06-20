#!/usr/bin/env node
/**
 * Smoke-test 365Scores World Cup endpoints (no API key required).
 *
 * 1) Fixtures list → gameIds:  GET /web/games/fixtures/?competitions=5930&…
 * 2) Live/finished game:     GET /web/game/?gameId={id}  (events + lineups grid)
 * 3) Named lineups/photos:   GET /web/athletes/games/lineups?gameId={id}
 *
 * There is NO separate chronological events URL — events live on /web/game/.
 */

const langId = parseInt(process.env.SCORES365_LANG_ID_EN || '1', 10);
const competitionId = parseInt(process.env.SCORES365_COMPETITION_ID || '5930', 10);
const tz = encodeURIComponent(process.env.SCORES365_TIMEZONE || 'Africa/Cairo');
const countryId = process.env.SCORES365_USER_COUNTRY_ID || '131';
const common = `appTypeId=5&langId=${langId}&timezoneName=${tz}&userCountryId=${countryId}`;
const origin = 'https://webws.365scores.com';
const headers = {
  Accept: 'application/json',
  Referer: 'https://www.365scores.com/',
  Origin: 'https://www.365scores.com',
  'User-Agent': 'Mozilla/5.0',
};

const probeGameIds = (process.env.PROBE_GAME_IDS || '4627937,4627857,4627883')
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => Number.isFinite(n) && n > 0);

async function getJson(path) {
  const res = await fetch(`${origin}${path}`, { headers, signal: AbortSignal.timeout(20_000) });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* ignore */
  }
  return { status: res.status, json, text: text.slice(0, 120) };
}

async function paginateFixtures() {
  const seen = new Set();
  const all = [];
  let path = `/web/games/fixtures/?${common}&competitions=${competitionId}&showOdds=true`;

  for (let step = 0; step < 50 && path; step++) {
    const { status, json } = await getJson(path);
    if (status !== 200 || !json) break;
    for (const g of json.games ?? []) {
      if (!seen.has(g.id)) {
        seen.add(g.id);
        all.push(g);
      }
    }
    path = json.paging?.nextPage ?? null;
    if (!path) break;
    if (!path.startsWith('http')) path = path;
  }
  return all;
}

function summarizeGame(gameId, game) {
  if (!game) return { gameId, ok: false };
  const homeXi = game.homeCompetitor?.lineups?.members?.filter((m) => m.status === 1).length ?? 0;
  const awayXi = game.awayCompetitor?.lineups?.members?.filter((m) => m.status === 1).length ?? 0;
  const events = game.events ?? [];
  const ordered = [...events].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  return {
    gameId,
    ok: true,
    match: `${game.homeCompetitor?.name} vs ${game.awayCompetitor?.name}`,
    status: game.statusText,
    score: `${game.homeCompetitor?.score ?? '?'}-${game.awayCompetitor?.score ?? '?'}`,
    homeXi,
    awayXi,
    events: events.length,
    firstEvent: ordered[0]
      ? `${ordered[0].gameTimeDisplay} ${ordered[0].eventType?.name} (${ordered[0].eventType?.subTypeName ?? ''})`
      : null,
    lastEvent: ordered.at(-1)
      ? `${ordered.at(-1).gameTimeDisplay} ${ordered.at(-1).eventType?.name}`
      : null,
  };
}

async function main() {
  console.log('=== 365Scores WC endpoint verify ===\n');

  const fixtures = await paginateFixtures();
  console.log(`Fixtures feed: ${fixtures.length} games (competition ${competitionId})`);
  console.log(
    'Sample:',
    fixtures.slice(0, 3).map((g) => ({
      gameId: g.id,
      match: `${g.homeCompetitor?.name} vs ${g.awayCompetitor?.name}`,
      status: g.statusText,
    })),
  );

  const ids = [...new Set([...probeGameIds, fixtures[0]?.id].filter(Boolean))];
  console.log(`\nProbing gameIds: ${ids.join(', ')}\n`);

  for (const gameId of ids) {
    const gameRes = await getJson(`/web/game/?${common}&gameId=${gameId}`);
    const summary = summarizeGame(gameId, gameRes.json?.game);
    console.log('GAME', JSON.stringify(summary, null, 2));

    const luRes = await getJson(`/web/athletes/games/lineups?${common}&gameId=${gameId}`);
    const members = luRes.json?.members ?? [];
    console.log(
      'LINEUPS',
      luRes.status,
      `members=${members.length}`,
      members[0]
        ? `sample=${members[0].name} athleteId=${members[0].athleteId} photo=v${members[0].imageVersion}`
        : '',
    );
    console.log('');
  }

  const fake = await getJson(`/web/games/events/?${common}&gameId=${probeGameIds[0]}`);
  console.log(
    'Dedicated events URL (expected 404):',
    fake.status,
    fake.text,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
