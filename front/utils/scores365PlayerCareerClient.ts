/**
 * Client-side fallback for 365 player career when the backend returns empty seasons
 * (e.g. production not yet redeployed with per-seasonKey career fetch).
 */
import type {
  Player365Career,
  Player365CareerCompetition,
  Player365CareerHighlightCompetition,
  Player365CareerSeason,
  Player365CareerTrophy,
} from '../services/apiFootball';
import { buildScores365AthletePhotoUrl } from './scores365AthletePhoto';
import { logger } from '../utils/logger';

const BASE_URL = 'https://webws.365scores.com';
const HEADERS: Record<string, string> = {
  Accept: 'application/json',
  Referer: 'https://www.365scores.com/',
  Origin: 'https://www.365scores.com',
  'User-Agent':
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Mobile Safari/537.36',
};

function langIdFor(language?: string | null): number {
  return language?.startsWith('en') ? 1 : 27;
}

function commonParams(langId: number): string {
  return `appTypeId=5&langId=${langId}&timezoneName=${encodeURIComponent('Africa/Cairo')}&userCountryId=131`;
}

function num365(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  if (typeof v === 'string') {
    const n = parseFloat(v.replace(/[^0-9.\-]/g, ''));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function buildLeagueLogoUrl(competitionId: number, imageVersion: number | null): string | null {
  if (imageVersion == null) return null;
  return `https://imagecache.365scores.com/image/upload/f_png,w_68,h_68,c_limit,q_auto:eco,dpr_2/v${imageVersion}/Competitions/${competitionId}`;
}

function buildCompetitionLogoMap(competitions: any[]): Map<number, string | null> {
  const map = new Map<number, string | null>();
  for (const c of competitions ?? []) {
    const id = num365(c?.id);
    if (id != null) {
      map.set(id, buildLeagueLogoUrl(id, num365(c.imageVersion)));
    }
  }
  return map;
}

async function fetch365Json<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${BASE_URL}${path}`, { headers: HEADERS });
    if (!res.ok) return null;
    const text = await res.text();
    if (!text.trim()) return null;
    return JSON.parse(text) as T;
  } catch (err) {
    logger.warn('[365CareerClient] fetch failed:', err);
    return null;
  }
}

function hasEmbeddedRows(stats: any): boolean {
  return (
    Array.isArray(stats?.tables) &&
    stats.tables.some((t: any) => Array.isArray(t?.rows) && t.rows.length > 0)
  );
}

function parseHighlightStats(
  raw: any[] | undefined,
  compLogoMap: Map<number, string | null>,
): Player365CareerHighlightCompetition[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((h) => h?.competitionId != null)
    .map((h) => {
      const competitionId = num365(h.competitionId) ?? 0;
      return {
        competitionId,
        competitionName: String(h.competitionName ?? h.name ?? '—'),
        competitionLogo: compLogoMap.get(competitionId) ?? null,
        seasonNum: num365(h.seasonNum),
        stats: (h.stats ?? []).map((s: any) => ({
          name: String(s.name ?? s.shortName ?? '—'),
          shortName: s.shortName as string | undefined,
          value: String(s.value ?? '—'),
          type: num365(s.type) ?? undefined,
          isTop: Boolean(s.isTop),
        })),
      };
    });
}

function parseTrophies(raw: any): Player365CareerTrophy[] {
  const out: Player365CareerTrophy[] = [];
  for (const cat of raw?.categories ?? []) {
    const categoryName = cat?.name as string | undefined;
    for (const t of cat?.trophies ?? []) {
      const competitionId = num365(t?.competitionId);
      if (competitionId == null) continue;
      out.push({
        competitionId,
        name: String(t.name ?? '—'),
        displayName: t.displayName as string | undefined,
        count: num365(t.count) ?? 1,
        categoryName,
      });
    }
  }
  return out;
}

function enrichCurrentSeasonFromHighlights(
  season: Player365CareerSeason,
  highlights: Player365CareerHighlightCompetition[],
): void {
  if (!highlights.length) return;
  const byCompId = new Map(highlights.map((h) => [h.competitionId, h]));
  let seasonMinutes = 0;
  let hasMinutes = false;

  for (const comp of season.competitions) {
    const cid = comp.competitionId;
    if (cid == null) continue;
    const hl = byCompId.get(cid);
    if (!hl) continue;
    const minutesStat = hl.stats.find((s) => s.type === 222);
    const ratingStat = hl.stats.find((s) => s.type === 54);
    if (minutesStat) {
      const mins = num365(minutesStat.value);
      if (mins != null) {
        comp.minutes = mins;
        seasonMinutes += mins;
        hasMinutes = true;
      }
    }
    if (ratingStat) {
      comp.rating = num365(ratingStat.value);
    }
  }

  if (hasMinutes) season.minutes = seasonMinutes;
}

function parseSeasonPayload(
  seasonDef: { key: string; name: string },
  payload: any,
  compLogoMap: Map<number, string | null>,
): Player365CareerSeason | null {
  const categories: any[] = payload?.stats?.categories ?? [];
  const tables: any[] = payload?.stats?.tables ?? [];
  const competitions: Player365CareerCompetition[] = [];

  for (let ti = 0; ti < tables.length; ti++) {
    const table = tables[ti];
    const category = categories[ti];
    const teamId = num365(category?.competitorId);
    const teamName = (category?.name as string) ?? null;

    for (const row of table?.rows ?? []) {
      if (!row || typeof row !== 'object') continue;
      const valByCol = new Map<number, number>();
      for (const v of row.values ?? []) {
        if (v?.columnNum != null) {
          valByCol.set(Number(v.columnNum), num365(v.value) ?? 0);
        }
      }
      const competitionId = num365(row.entityId);
      competitions.push({
        competitionId,
        competitionName: (row.title as string) ?? '—',
        competitionLogo:
          competitionId != null ? (compLogoMap.get(competitionId) ?? null) : null,
        teamId,
        teamName,
        appearances: valByCol.get(5) ?? null,
        goals: valByCol.get(1) ?? null,
        assists: valByCol.get(2) ?? null,
        minutes: null,
        yellowCards: valByCol.get(3) ?? null,
        redCards: valByCol.get(4) ?? null,
        rating: null,
      });
    }
  }

  if (!competitions.length) return null;

  const sum = (sel: (c: Player365CareerCompetition) => number | null) =>
    competitions.reduce((acc, c) => acc + (sel(c) ?? 0), 0);

  return {
    seasonKey: seasonDef.key,
    label: seasonDef.name,
    goals: sum((c) => c.goals),
    assists: sum((c) => c.assists),
    appearances: sum((c) => c.appearances),
    minutes: null,
    competitions,
  };
}

export async function fetch365PlayerCareerClient(
  athleteId: number,
  language?: string | null,
): Promise<Player365Career | null> {
  if (!athleteId) return null;

  const langId = langIdFor(language);
  const cp = commonParams(langId);

  const details = await fetch365Json<{ athletes?: any[]; competitors?: any[]; competitions?: any[] }>(
    `/web/athletes/?${cp}&athletes=${athleteId}&fullDetails=true`,
  );
  const athlete = details?.athletes?.[0];
  if (!athlete) return null;

  const compLogoMap = buildCompetitionLogoMap(details?.competitions ?? []);
  const competitorNames = new Map<number, string>(
    (details?.competitors ?? [])
      .filter((c: any) => c?.id != null && c?.name)
      .map((c: any) => [c.id as number, c.name as string]),
  );

  const clubId = num365(athlete.clubId);
  const clubFromMap = clubId != null && clubId > 0 ? competitorNames.get(clubId) : undefined;

  const profile: Player365Career['profile'] = {
    name: (athlete.name as string) ?? '—',
    shortName: athlete.shortName as string | undefined,
    position: athlete.position?.name ?? athlete.positionName ?? null,
    clubName: clubFromMap ?? athlete.clubName ?? athlete.competitorName ?? null,
    nationality: athlete.nationalityName ?? athlete.countryName ?? null,
    jerseyNumber: num365(athlete.jerseyNumber ?? athlete.shirtNumber),
    age: num365(athlete.age),
    imageUrl: buildScores365AthletePhotoUrl(
      athleteId,
      80,
      num365(athlete.imageVersion),
    ),
  };

  const currentSeasonKey = String(athlete.careerStats?.seasons?.[0]?.key ?? '') || null;
  const currentSeasonHighlights = parseHighlightStats(athlete.highlightStats, compLogoMap);
  const trophies = parseTrophies(athlete.trophies);

  const seasonDefs: Array<{ key: string; name: string; embeddedStats?: any }> = (
    athlete.careerStats?.seasons ?? []
  )
    .filter((s: any) => s?.key && String(s.key) !== '-1')
    .map((s: any) => ({
      key: String(s.key),
      name: String(s.name ?? s.key),
      embeddedStats: s.stats,
    }));

  const seasons: Player365CareerSeason[] = [];
  const BATCH = 4;

  for (let i = 0; i < seasonDefs.length; i += BATCH) {
    const batch = seasonDefs.slice(i, i + BATCH);
    const parsed = await Promise.all(
      batch.map(async (def) => {
        let payload: any = null;
        if (hasEmbeddedRows(def.embeddedStats)) {
          payload = { stats: def.embeddedStats };
        } else {
          payload = await fetch365Json<any>(
            `/web/athletes/career?${cp}&athleteId=${athleteId}&seasonKey=${encodeURIComponent(def.key)}`,
          );
        }
        if (!payload?.stats) return null;
        return parseSeasonPayload(def, payload, compLogoMap);
      }),
    );
    for (const s of parsed) {
      if (s) seasons.push(s);
    }
  }

  if (!seasons.length) return null;

  seasons.sort((a, b) => {
    const na = parseInt(a.seasonKey.replace(/[^0-9]/g, ''), 10);
    const nb = parseInt(b.seasonKey.replace(/[^0-9]/g, ''), 10);
    if (Number.isFinite(na) && Number.isFinite(nb)) return nb - na;
    return b.label.localeCompare(a.label);
  });

  if (currentSeasonKey) {
    const current = seasons.find((s) => s.seasonKey === currentSeasonKey) ?? seasons[0];
    if (current) enrichCurrentSeasonFromHighlights(current, currentSeasonHighlights);
  }

  const trend = [...seasons]
    .reverse()
    .map((s) => ({ seasonKey: s.seasonKey, label: s.label, goals: s.goals, assists: s.assists }));

  logger.debug(`[365CareerClient] loaded ${seasons.length} seasons for athlete ${athleteId}`);
  return {
    athleteId,
    profile,
    seasons,
    trend,
    currentSeasonKey,
    currentSeasonHighlights,
    trophies,
  };
}
