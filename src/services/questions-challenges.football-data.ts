/**
 * REAL FOOTBALL CANDIDATES FOR THE QUESTIONS AI
 * =============================================================================
 *
 * Everything factual a Questions round is built from: real players and their
 * real photos, real club crests, real transfer histories, real scorer rankings.
 * Nothing here authors a question — it assembles the *candidate pools* that get
 * handed to the AI (questions-challenges.ai-generator.service.ts), which then
 * picks entities and writes the question text.
 *
 * This split is the contract from OMAR_QUIZ_AI_FOOTBALL_API.md:
 *   "الداتا والصور من عندنا؛ صياغة السؤال والاختيارات من عندك"
 *   (the data and the images are ours; the question and options are yours)
 * and §8 of the same doc: there is no AI image generation — every picture comes
 * from 365Scores / API-Football, already resolved.
 *
 * Source map (in-process equivalents of the documented public endpoints):
 *   /api/football/cached/search, /cached/team/:id ...... buildQuizEntityDataset()
 *                                                        (CachedTeam.logo crests)
 *   /api/football/cached/365/player/lookup ............. resolve365QuizPlayerImage()
 *   /api/football/transfers ............................ footballService.getTransfers()
 *   /api/football/players/top/scorers .................. footballDataCacheService.getTopScorers()
 *   POST /api/i18n/football-names ...................... translateFootballNames()
 *
 * IMAGE RULE: a candidate is only emitted with an image when that image was
 * resolved for THAT entity. An entity whose picture cannot be resolved is left
 * out of the pool rather than emitted with a missing or borrowed one.
 */

import { footballService } from './football.service';
import { footballDataCacheService } from './football-data-cache.service';
import { translateFootballNames } from './football-translation.service';
import { resolve365QuizPlayerImage } from './quiz-365-player.service';
import { buildQuizEntityDataset } from './quiz-entity-dataset.service';
import {
  buildDerivedTransferCandidates,
  buildDerivedRankingCandidates,
} from './questions-challenges.derived-football';
import { logger } from '../utils/logger';
import { ROUND_QUESTION_COUNT } from '../constants/quiz.constants';
import type { QuizLanguage } from '../types/quiz.types';
import type { QuizEntityDataset, QuizDatasetPlayer, QuizEntitySlice } from '../types/quiz-entity.types';

/**
 * Minimum 365Scores name-match score before a photo is accepted as belonging to
 * the player it will be shown next to. Below this the lookup counts as "no
 * photo": showing a different player's face beside a name is worse than showing
 * none, and for guess-player it makes the question unanswerable.
 */
export const MIN_PLAYER_PHOTO_SCORE = 0.72;

/** Leagues the top-scorers feed covers well — IDs from the API doc §5. */
const RANKING_LEAGUES: Array<{ id: number; en: string; ar: string }> = [
  { id: 39, en: 'the Premier League', ar: 'الدوري الإنجليزي الممتاز' },
  { id: 140, en: 'La Liga', ar: 'الدوري الإسباني' },
  { id: 135, en: 'Serie A', ar: 'الدوري الإيطالي' },
  { id: 78, en: 'the Bundesliga', ar: 'الدوري الألماني' },
  { id: 61, en: 'Ligue 1', ar: 'الدوري الفرنسي' },
  { id: 2, en: 'the Champions League', ar: 'دوري أبطال أوروبا' },
];

/**
 * Entity-pool sizes for a Questions day.
 *
 * Wider than the daily quiz pack's slice on purpose: a round is
 * ROUND_QUESTION_COUNT questions per mode, each needing a distinct subject plus
 * three distinct distractors, across seven modes. A pack-sized slice leaves the
 * pools too thin for that and the day fails for lack of candidates rather than
 * for lack of data.
 */
/**
 * How many squad members to look portraits up for when building one teammate
 * group. Only four are used; the extras absorb players 365Scores has no
 * portrait for (reserves, academy call-ups) so one miss cannot cost the whole
 * team. Bounded because every entry is a lookup — the results are cached and
 * shared with the player pool, so the real cost is well under this.
 */
const PORTRAIT_SAMPLE_SIZE = 12;
/*
 * 60 players is one contiguous window over a squad-ordered list, so it covered
 * only ~3 clubs — and Player Connections needs one DISTINCT club per question,
 * i.e. ROUND_QUESTION_COUNT of them. The day could never hold more than three
 * connection questions no matter how well portraits resolved. Sized to span
 * enough squads for a full round; the pools that sample players independently
 * are still capped by PROBE_LIMIT, and portrait lookups are cached and shared
 * across pools, so this widens coverage rather than multiplying upstream calls.
 */
const QUESTIONS_SLICE_PLAYER_COUNT = 360;
/*
 * Football Bingo asks for three clubs from one country and is capped at
 * MAX_BINGO_CARDS_PER_COUNTRY cards per country, so a full round needs several
 * countries that each contribute at least three clubs. A 40-club window yielded
 * four such countries with exactly three clubs each — every card would have had
 * to repeat the same trio, so the mode could never fill a round. Clubs come
 * from the database with their crests already resolved, so widening this costs
 * no upstream calls.
 */
const QUESTIONS_SLICE_CLUB_COUNT = 260;

/**
 * Escape hatch for the derived (persisted-career) fallback below.
 *
 * ON by default — an API-Football outage should not cost two modes. Tests that
 * assert what the PRIMARY path does with bad upstream rows ("drops transfer
 * rows with no crest", "refuses a tied ranking") set this, because otherwise
 * the fallback legitimately refills the pool those assertions expect to be
 * empty and the property under test becomes unobservable.
 */
function isDerivedFallbackDisabled(): boolean {
  return process.env.QUESTIONS_DISABLE_DERIVED_FALLBACK?.trim().toLowerCase() === 'true';
}

/** How many entities each pool tries to fill. One per question, plus slack. */
const POOL_TARGET = ROUND_QUESTION_COUNT;
/** How many candidates a pool builder will probe before giving up. */
const PROBE_LIMIT = ROUND_QUESTION_COUNT * 4;
/** Parallelism for outbound lookups, so a pool can't burst the upstream APIs. */
const LOOKUP_CONCURRENCY = 4;

export interface PlayerCandidate {
  /** Dataset id — "player:154". */
  id: string;
  name: string;
  apiPlayerId: number;
  position: string;
  teamId: number;
  teamName: string;
  nationality?: string;
  jerseyNumber?: number;
  /** Real 365Scores portrait of THIS player. Always present on a candidate. */
  photoUrl: string;
}

export interface ClubCandidate {
  /** Dataset id — "team:541". */
  id: string;
  name: string;
  apiTeamId: number;
  country?: string;
  founded?: number;
  stadiumName?: string;
  /** Real crest (CachedTeam.logo). Always present on a candidate. */
  logoUrl: string;
}

export interface TeammateGroup {
  id: string;
  teamId: number;
  teamName: string;
  /** The club's dataset id, so the AI can name it from the club pool. */
  clubId: string;
  /** Exactly 4 team-mates, each with their own real photo. */
  players: PlayerCandidate[];
}

export interface TransferStep {
  clubName: string;
  logoUrl: string;
  year: string;
}

export interface TransferCandidate {
  id: string;
  playerId: string;
  playerName: string;
  /** Chronological, at least one step before the hidden final move. */
  priorSteps: TransferStep[];
  finalStep: TransferStep;
}

export interface RankingRow {
  name: string;
  photoUrl: string;
  goals: number;
}

export interface RankingCandidate {
  id: string;
  leagueId: number;
  leagueLabel: string;
  season: number;
  /** Strictly ordered by goals, top three unambiguous. */
  rows: RankingRow[];
}

export interface QuestionsFootballCandidates {
  players: PlayerCandidate[];
  clubs: ClubCandidate[];
  /** country → clubs from that country (all with crests). */
  clubsByCountry: Record<string, ClubCandidate[]>;
  teammateGroups: TeammateGroup[];
  transfers: TransferCandidate[];
  rankings: RankingCandidate[];
  /** Source (English) name → display name in the round's language. */
  nameMap: Record<string, string>;
}

/* ────────────────────────── small helpers ────────────────────────── */

/**
 * A usable remote image URL, or null. Never invents or substitutes one.
 *
 * Deliberately THE SAME predicate the round contract validates images with, so
 * a URL this layer accepted onto a candidate can never be rejected later by the
 * publish/session gate (questions-challenges.round-contract.ts).
 */
export { remoteImageUrlOrNull as imageUrlOrNull } from './questions-challenges.round-contract';
import { remoteImageUrlOrNull as imageUrlOrNull } from './questions-challenges.round-contract';

export function seededRng(seedStr: string): () => number {
  let h = 1779033703 ^ seedStr.length;
  for (let i = 0; i < seedStr.length; i += 1) {
    h = Math.imul(h ^ seedStr.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return function next(): number {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}

export function shuffle<T>(items: T[], rng: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** A stable window of `count` items, chosen by seed — the daily rotation. */
function pickWindow<T>(items: T[], count: number, seed: string): T[] {
  if (items.length <= count) return [...items];
  const rng = seededRng(seed);
  const start = Math.floor(rng() * items.length);
  const out: T[] = [];
  for (let i = 0; i < count; i += 1) out.push(items[(start + i) % items.length]!);
  return out;
}

/**
 * The day's entity slice for the Questions hub.
 *
 * Rotates through the dataset by seed so different days ask about different
 * entities, then pulls in the club of every selected player whether or not the
 * club window happened to contain it. Without that last step a player can be in
 * the slice while his own club is not — and Football Grid and Player
 * Connections, which both have to name that club, silently lose him.
 */
function selectQuestionsSlice(
  dataset: QuizEntityDataset,
  refreshDateYmd: string,
  language: QuizLanguage,
): QuizEntitySlice {
  const base = `${refreshDateYmd}:${language}:questions`;
  const players = pickWindow(dataset.players, QUESTIONS_SLICE_PLAYER_COUNT, `${base}:players`);

  const clubsById = new Map(
    pickWindow(dataset.clubs, QUESTIONS_SLICE_CLUB_COUNT, `${base}:clubs`).map((club) => [
      club.apiTeamId,
      club,
    ]),
  );
  for (const player of players) {
    if (clubsById.has(player.teamId)) continue;
    const club = dataset.clubs.find((entry) => entry.apiTeamId === player.teamId);
    if (club) clubsById.set(club.apiTeamId, club);
  }

  const clubs = [...clubsById.values()];
  const clubIds = new Set(clubs.map((club) => club.apiTeamId));

  return {
    players,
    clubs,
    stadiums: dataset.stadiums.filter((stadium) => clubIds.has(stadium.apiTeamId)),
  };
}

/** Runs `task` over `items` with bounded parallelism, preserving order. */
async function mapLimit<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const out = new Array<R>(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    for (;;) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      out[index] = await task(items[index]!);
    }
  });
  await Promise.all(workers);
  return out;
}

/**
 * Localizes real entity names through the shared football-name translator —
 * the same service behind POST /api/i18n/football-names (doc §7-هـ). Falls back
 * to the source name; never to a hand-written Arabic dictionary.
 */
export async function localizeNames(
  language: QuizLanguage,
  names: string[],
): Promise<Record<string, string>> {
  const identity: Record<string, string> = {};
  for (const name of names) identity[name] = name;
  if (language !== 'ar' || names.length === 0) return identity;

  try {
    const translated = await translateFootballNames([...new Set(names)], 'ar');
    return { ...identity, ...translated };
  } catch (err) {
    logger.warn('[QuestionsChallenges:Data] name translation failed, using source names', {
      error: err instanceof Error ? err.message : String(err),
    });
    return identity;
  }
}

/* ────────────────────────── photo resolution ────────────────────────── */

/**
 * Real photo for this exact player, or null. Memoized per build so the same
 * player is never looked up twice across pools.
 */
function createPhotoResolver(): (player: Pick<QuizDatasetPlayer, 'name' | 'teamName'>) => Promise<string | null> {
  const cache = new Map<string, Promise<string | null>>();

  return function resolvePhoto(player) {
    const key = `${player.name}::${player.teamName ?? ''}`;
    const cached = cache.get(key);
    if (cached) return cached;

    const pending = (async () => {
      try {
        const match = await resolve365QuizPlayerImage({
          entityName: player.name,
          teamName: player.teamName,
          correctAnswerText: player.name,
        });
        if (!match || match.score < MIN_PLAYER_PHOTO_SCORE) return null;
        return imageUrlOrNull(match.imageUrl);
      } catch (err) {
        logger.warn('[QuestionsChallenges:Data] player photo lookup failed', {
          player: player.name,
          error: err instanceof Error ? err.message : String(err),
        });
        return null;
      }
    })();

    cache.set(key, pending);
    return pending;
  };
}

/* ────────────────────────── pool builders ────────────────────────── */

function toClubCandidates(slice: QuizEntitySlice): ClubCandidate[] {
  const out: ClubCandidate[] = [];
  for (const club of slice.clubs) {
    const logoUrl = imageUrlOrNull(club.logoUrl);
    // A crest question with no crest is not a question — leave the club out.
    if (!logoUrl) continue;
    const stadium = slice.stadiums.find((s) => s.apiTeamId === club.apiTeamId);
    out.push({
      id: club.id,
      name: club.name,
      apiTeamId: club.apiTeamId,
      country: club.country,
      founded: club.founded,
      stadiumName: stadium?.name,
      logoUrl,
    });
  }
  return out;
}

async function buildPlayerCandidates(
  slice: QuizEntitySlice,
  rng: () => number,
  resolvePhoto: ReturnType<typeof createPhotoResolver>,
): Promise<PlayerCandidate[]> {
  const probe = shuffle(slice.players, rng).slice(0, PROBE_LIMIT);
  const photos = await mapLimit(probe, LOOKUP_CONCURRENCY, (player) => resolvePhoto(player));

  const out: PlayerCandidate[] = [];
  for (let i = 0; i < probe.length; i += 1) {
    const photoUrl = photos[i];
    if (!photoUrl) continue;
    const player = probe[i]!;
    out.push({
      id: player.id,
      name: player.name,
      apiPlayerId: player.apiPlayerId,
      position: player.position,
      teamId: player.teamId,
      teamName: player.teamName,
      nationality: player.nationality ?? player.country,
      jerseyNumber: player.jerseyNumber,
      photoUrl,
    });
  }
  return out;
}

async function buildTeammateGroups(
  slice: QuizEntitySlice,
  clubs: ClubCandidate[],
  rng: () => number,
  resolvePhoto: ReturnType<typeof createPhotoResolver>,
): Promise<TeammateGroup[]> {
  const clubByTeamId = new Map(clubs.map((club) => [club.apiTeamId, club]));
  const byTeam = new Map<number, QuizDatasetPlayer[]>();
  for (const player of slice.players) {
    const arr = byTeam.get(player.teamId) ?? [];
    arr.push(player);
    byTeam.set(player.teamId, arr);
  }

  const withFour = [...byTeam.entries()].filter(([, players]) => players.length >= 4);
  const eligible = shuffle(
    withFour.filter(([teamId]) => clubByTeamId.has(teamId)),
    rng,
  ).slice(0, POOL_TARGET * 2);

  /*
   * Player Connections silently produced zero groups with no way to tell which
   * of its three gates closed. Each one fails for a completely different
   * reason — too few squad-mates in the day's slice, the club missing from the
   * candidate pool, or portraits that would not resolve — so an empty pool was
   * indistinguishable from an outage. Say which.
   */
  let portraitFailures = 0;
  const groups: TeammateGroup[] = [];
  for (const [teamId, teammates] of eligible) {
    if (groups.length >= POOL_TARGET) break;

    /*
     * Resolve portraits across a WIDER set than the four we need, then keep the
     * four that actually have one.
     *
     * This used to shuffle the squad, take exactly four, and drop the whole team
     * if any one of them had no portrait — so a 25-man squad with 20 usable
     * photos was thrown away because a reserve keeper landed in the sample. With
     * only ~3 teams in a day's slice that rejected every group, and Player
     * Connections published nothing at all. Squad members are interchangeable
     * here (the question is "what connects them", not "which four"), so widening
     * the sample changes yield, not truthfulness: every player still comes from
     * the real squad and still needs a real portrait.
     */
    const sample = shuffle(teammates, rng).slice(0, PORTRAIT_SAMPLE_SIZE);
    const sampled = await mapLimit(sample, LOOKUP_CONCURRENCY, async (player) => ({
      player,
      photoUrl: await resolvePhoto(player),
    }));
    const usable = sampled.filter(
      (entry): entry is { player: QuizDatasetPlayer; photoUrl: string } => Boolean(entry.photoUrl),
    );
    if (usable.length < 4) {
      portraitFailures += 1;
      continue;
    }
    const four = usable.slice(0, 4).map((entry) => entry.player);
    const photos = usable.slice(0, 4).map((entry) => entry.photoUrl);

    const club = clubByTeamId.get(teamId)!;
    groups.push({
      id: `group:${teamId}`,
      teamId,
      teamName: four[0]!.teamName,
      clubId: club.id,
      players: four.map((player, idx) => ({
        id: player.id,
        name: player.name,
        apiPlayerId: player.apiPlayerId,
        position: player.position,
        teamId: player.teamId,
        teamName: player.teamName,
        nationality: player.nationality ?? player.country,
        jerseyNumber: player.jerseyNumber,
        photoUrl: photos[idx]!,
      })),
    });
  }

  if (groups.length === 0) {
    logger.warn('[QuestionsChallenges:Data] no teammate groups — naming the gate that closed', {
      slicePlayers: slice.players.length,
      distinctTeamsInSlice: byTeam.size,
      teamsWithAtLeast4: withFour.length,
      teamsAlsoInClubPool: eligible.length,
      groupsRejectedForPortraits: portraitFailures,
    });
  }

  return groups;
}

async function buildTransferCandidates(
  slice: QuizEntitySlice,
  rng: () => number,
): Promise<TransferCandidate[]> {
  if (!footballService.isConfigured()) return [];

  const probe = shuffle(slice.players, rng).slice(0, PROBE_LIMIT);
  const out: TransferCandidate[] = [];

  for (const player of probe) {
    if (out.length >= POOL_TARGET) break;
    try {
      const rows = await footballService.getTransfers({ player: player.apiPlayerId });
      const record = Array.isArray(rows) ? rows[0] : null;
      const transfers = Array.isArray(record?.transfers) ? record.transfers : [];

      // Every visible step renders the destination club's crest, so a step
      // without one cannot be drawn honestly.
      const chronological = [...transfers]
        .filter(
          (t: any) =>
            typeof t?.teams?.in?.name === 'string' &&
            t.teams.in.name.trim().length > 0 &&
            typeof t?.date === 'string' &&
            imageUrlOrNull(t?.teams?.in?.logo),
        )
        .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (chronological.length < 2) continue;

      const steps = chronological.slice(-3).map((t: any) => ({
        clubName: String(t.teams.in.name).trim(),
        logoUrl: imageUrlOrNull(t.teams.in.logo)!,
        year: String(t.date).slice(0, 4),
      }));

      out.push({
        id: `transfer:${player.apiPlayerId}`,
        playerId: player.id,
        playerName: player.name,
        priorSteps: steps.slice(0, -1),
        finalStep: steps[steps.length - 1]!,
      });
    } catch (err) {
      logger.warn('[QuestionsChallenges:Data] transfer lookup failed', {
        playerId: player.apiPlayerId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return out;
}

async function buildRankingCandidates(language: QuizLanguage): Promise<RankingCandidate[]> {
  if (!footballService.isConfigured()) return [];

  const currentYear = new Date().getFullYear();
  const out: RankingCandidate[] = [];

  for (const league of RANKING_LEAGUES) {
    if (out.length >= POOL_TARGET) break;

    for (const season of [currentYear, currentYear - 1]) {
      try {
        const scorers = await footballDataCacheService.getTopScorers(league.id, season);

        // API-Football already returns each scorer's real portrait — no second
        // lookup, and the photo is guaranteed to be the ranked player's.
        const rows: RankingRow[] = (scorers ?? [])
          .map((row: any) => ({
            name: typeof row?.player?.name === 'string' ? row.player.name.trim() : '',
            photoUrl: imageUrlOrNull(row?.player?.photo),
            goals: Number(row?.statistics?.[0]?.goals?.total ?? 0),
          }))
          .filter((row: { name: string; photoUrl: string | null }) => Boolean(row.name) && Boolean(row.photoUrl))
          .slice(0, 6)
          .map((row: { name: string; photoUrl: string | null; goals: number }) => ({
            name: row.name,
            photoUrl: row.photoUrl!,
            goals: row.goals,
          }));

        if (rows.length < 3) continue;
        // A ranking question needs a strict order — tied goal totals have no
        // single right answer.
        if (rows[0]!.goals === rows[1]!.goals || rows[1]!.goals === rows[2]!.goals) continue;

        out.push({
          id: `ranking:${league.id}:${season}`,
          leagueId: league.id,
          leagueLabel: language === 'ar' ? league.ar : league.en,
          season,
          rows,
        });
        break;
      } catch (err) {
        logger.warn('[QuestionsChallenges:Data] top scorers lookup failed', {
          league: league.id,
          season,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }

  return out;
}

/* ────────────────────────── entry point ────────────────────────── */

/**
 * Gathers every real football candidate a day's Questions round can be built
 * from. Returns null when the entity dataset itself is too thin to work with —
 * callers must surface that rather than substituting invented content.
 */
export async function buildQuestionsFootballCandidates(
  language: QuizLanguage,
  refreshDateYmd: string,
): Promise<QuestionsFootballCandidates | null> {
  const datasetResult = await buildQuizEntityDataset();
  if (!datasetResult.ok) {
    logger.warn('[QuestionsChallenges:Data] entity dataset insufficient', {
      counts: datasetResult.counts,
    });
    return null;
  }

  const slice = selectQuestionsSlice(datasetResult.dataset, refreshDateYmd, language);
  const rng = seededRng(`${refreshDateYmd}:${language}:questions-candidates`);
  const resolvePhoto = createPhotoResolver();

  const clubs = toClubCandidates(slice);
  const [players, teammateGroups, primaryTransfers, primaryRankings] = await Promise.all([
    buildPlayerCandidates(slice, rng, resolvePhoto),
    buildTeammateGroups(slice, clubs, rng, resolvePhoto),
    buildTransferCandidates(slice, rng),
    buildRankingCandidates(language),
  ]);

  /*
   * Transfers and scorer rankings are the only two pools that come exclusively
   * from API-Football. When that account is unavailable both arrive empty and
   * Transfer Puzzle / Top 10 cannot be authored — so fall back to the same
   * facts already persisted in cached_365_player_career rather than losing the
   * modes. Derived candidates are used ONLY to fill an empty pool: a live
   * provider response always wins.
   */
  let transfers = primaryTransfers;
  let rankings = primaryRankings;
  if (!isDerivedFallbackDisabled() && (transfers.length === 0 || rankings.length === 0)) {
    const [derivedTransfers, derivedRankings] = await Promise.all([
      transfers.length === 0
        ? buildDerivedTransferCandidates(POOL_TARGET * 2).catch((err) => {
            logger.warn('[QuestionsChallenges:Data] derived transfer fallback failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return [] as TransferCandidate[];
          })
        : Promise.resolve(transfers),
      rankings.length === 0
        ? buildDerivedRankingCandidates(language, POOL_TARGET * 2).catch((err) => {
            logger.warn('[QuestionsChallenges:Data] derived ranking fallback failed', {
              error: err instanceof Error ? err.message : String(err),
            });
            return [] as RankingCandidate[];
          })
        : Promise.resolve(rankings),
    ]);
    transfers = derivedTransfers;
    rankings = derivedRankings;
  }

  const clubsByCountry: Record<string, ClubCandidate[]> = {};
  for (const club of clubs) {
    if (!club.country) continue;
    (clubsByCountry[club.country] ??= []).push(club);
  }

  const nameMap = await localizeNames(language, [
    ...clubs.map((club) => club.name),
    ...players.map((player) => player.name),
    ...teammateGroups.flatMap((group) => [group.teamName, ...group.players.map((p) => p.name)]),
    ...transfers.flatMap((t) => [t.playerName, t.finalStep.clubName, ...t.priorSteps.map((s) => s.clubName)]),
    ...rankings.flatMap((r) => r.rows.map((row) => row.name)),
  ]);

  logger.info('[QuestionsChallenges:Data] candidate pools built', {
    language,
    refreshDateYmd,
    players: players.length,
    clubs: clubs.length,
    teammateGroups: teammateGroups.length,
    transfers: transfers.length,
    rankings: rankings.length,
  });

  return { players, clubs, clubsByCountry, teammateGroups, transfers, rankings, nameMap };
}
