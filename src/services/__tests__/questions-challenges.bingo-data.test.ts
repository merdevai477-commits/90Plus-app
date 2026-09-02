/**
 * FOOTBALL BINGO — the round generator, including the pools it cannot build from.
 * =============================================================================
 *
 * A bingo card is "three of these nine clubs are from <country>", so the whole
 * mode is a selection problem over the club pool. Some countries are covered
 * thinly — the Algerian league and the CAF Confederation Cup bring in only a
 * handful of clubs with resolved crests — and the reported symptom was the game
 * hanging on exactly those.
 *
 * The client half of that hang is fixed elsewhere (an unbounded fetch behind a
 * spinner with no back arrow — see front/components/Quiz/__tests__). This suite
 * pins the server half: for EVERY pool shape, including the degenerate ones,
 * the generator must
 *
 *   • terminate, promptly and unconditionally, and
 *   • either return a round that satisfies the contract, or return `null`.
 *
 * It must never return a partial or self-contradicting board, because a board
 * whose objective cannot be satisfied is unplayable and leaves the player stuck
 * on a card they cannot complete.
 */

import { ROUND_QUESTION_COUNT } from '../../constants/quiz.constants';
import { buildRoundFromFootballData } from '../questions-challenges.ai-generator.service';
import type {
  ClubCandidate,
  QuestionsFootballCandidates,
} from '../questions-challenges.football-data';
import type {
  GeneratedQuestionChallenge,
  QuestionChallengeQuestion,
} from '../../types/questions-challenges.types';

function club(id: number, country: string): ClubCandidate {
  return {
    id: `team:${id}`,
    name: `Club ${id}`,
    apiTeamId: id,
    country,
    logoUrl: `https://media.api-sports.io/football/teams/${id}.png`,
  };
}

/** `countries` maps a country to how many clubs it contributes. */
function candidatesFor(countries: Record<string, number>): QuestionsFootballCandidates {
  const clubs: ClubCandidate[] = [];
  let nextId = 1;
  for (const [country, count] of Object.entries(countries)) {
    for (let i = 0; i < count; i += 1) {
      clubs.push(club(nextId, country));
      nextId += 1;
    }
  }

  const clubsByCountry: Record<string, ClubCandidate[]> = {};
  for (const entry of clubs) {
    if (!entry.country) continue;
    (clubsByCountry[entry.country] ??= []).push(entry);
  }

  return {
    players: [],
    clubs,
    clubsByCountry,
    teammateGroups: [],
    transfers: [],
    rankings: [],
    nameMap: {},
  };
}

function build(candidates: QuestionsFootballCandidates): GeneratedQuestionChallenge | null {
  return buildRoundFromFootballData('football-bingo', 'en', '2026-09-02', candidates);
}

/**
 * The round's questions. Every playable mode stores them under
 * `content.questions`; the flat fields on `content` mirror the first one.
 */
function questionsOf(round: GeneratedQuestionChallenge | null): QuestionChallengeQuestion[] {
  return round?.content?.questions ?? [];
}

/** Wall-clock ceiling. Generously above the real cost; a loop blows straight past it. */
const TERMINATION_BUDGET_MS = 2_000;

function timed<T>(fn: () => T): { value: T; ms: number } {
  const started = Date.now();
  const value = fn();
  return { value, ms: Date.now() - started };
}

/* ── A pool that genuinely supports a round ─────────────────────────── */

describe('a well-covered club pool', () => {
  // Enough countries that no country has to carry more cards than the builder
  // allows, and enough non-matching clubs to fill the other six cells.
  const healthy = candidatesFor({
    England: 6,
    Spain: 6,
    Italy: 6,
    Germany: 6,
    France: 6,
    Algeria: 6,
    Morocco: 6,
    Egypt: 6,
  });

  it('builds a full round', () => {
    const round = build(healthy);

    expect(round).not.toBeNull();
    expect(questionsOf(round)).toHaveLength(ROUND_QUESTION_COUNT);
  });

  it('gives every card a real 3x3 board', () => {
    const round = build(healthy)!;

    for (const question of questionsOf(round)) {
      expect(question.bingoBoard).toHaveLength(3);
      for (const row of question.bingoBoard!) {
        expect(row).toHaveLength(3);
        for (const cell of row) {
          expect(cell.label).toBeTruthy();
          expect(cell.imageUrl).toMatch(/^https:\/\//);
        }
      }
    }
  });

  it('makes exactly three cells the answer', () => {
    const round = build(healthy)!;

    for (const question of questionsOf(round)) {
      expect(question.answer?.correctIds).toHaveLength(3);
    }
  });

  it('names answer cells that are actually on the board', () => {
    const round = build(healthy)!;

    for (const question of questionsOf(round)) {
      const boardIds = question.bingoBoard!.flat().map((cell: { id: string }) => cell.id);
      for (const id of question.answer!.correctIds!) {
        expect(boardIds).toContain(id);
      }
    }
  });

  it('is reproducible for the same day and language', () => {
    // The round is seeded, so two players opening the same day see the same
    // card — and a re-request cannot quietly produce a different board.
    const first = build(healthy)!;
    const second = build(healthy)!;

    expect(questionsOf(second).map((q: QuestionChallengeQuestion) => q.answer?.correctIds)).toEqual(
      questionsOf(first).map((q: QuestionChallengeQuestion) => q.answer?.correctIds),
    );
  });
});

/* ── The pools the reported freeze is about ────────────────────────── */

describe('thinly-covered pools', () => {
  /**
   * Each of these is a real shape the club pool can take on a bad data day —
   * a competition that resolved crests for only a handful of clubs, or a slice
   * that happened to land inside one country.
   */
  const SPARSE: Array<[string, QuestionsFootballCandidates]> = [
    ['no clubs at all', candidatesFor({})],
    ['one club', candidatesFor({ Algeria: 1 })],
    ['two clubs in one country — no trio exists', candidatesFor({ Algeria: 2 })],
    ['exactly one country with a trio, nothing to contrast it with', candidatesFor({ Algeria: 3 })],
    ['one country only, plenty of clubs', candidatesFor({ Algeria: 40 })],
    ['two countries, three clubs each', candidatesFor({ Algeria: 3, Morocco: 3 })],
    [
      'many countries but none with three clubs',
      candidatesFor({ Algeria: 2, Morocco: 2, Egypt: 2, Tunisia: 2, Libya: 2, Sudan: 2 }),
    ],
    [
      'one deep country beside a crowd of thin ones',
      candidatesFor({ Algeria: 30, Morocco: 1, Egypt: 1, Tunisia: 1 }),
    ],
  ];

  it.each(SPARSE)('%s — terminates', (_name, candidates) => {
    const { ms } = timed(() => build(candidates));
    expect(ms).toBeLessThan(TERMINATION_BUDGET_MS);
  });

  it.each(SPARSE)('%s — never returns a partial round', (_name, candidates) => {
    const round = build(candidates);

    // Either a full round or none. A short round is what a client would have to
    // paper over, and the round contract rejects it downstream anyway.
    if (round !== null) {
      expect(questionsOf(round)).toHaveLength(ROUND_QUESTION_COUNT);
    }
  });

  it.each(SPARSE)('%s — never returns an unsatisfiable board', (_name, candidates) => {
    const round = build(candidates);
    if (round === null) return;

    for (const question of questionsOf(round)) {
      const board = question.bingoBoard!;
      expect(board.flat()).toHaveLength(9);
      expect(question.answer?.correctIds).toHaveLength(3);
      // Nine distinct clubs — a repeated crest makes the card ambiguous.
      expect(new Set(board.flat().map((cell: { label?: string }) => cell.label)).size).toBe(9);
    }
  });

  it('returns null rather than a round when only one country has three clubs', () => {
    // Every other cell must FAIL the objective, so a single-country pool cannot
    // produce a legal card at all.
    expect(build(candidatesFor({ Algeria: 3 }))).toBeNull();
    expect(build(candidatesFor({ Algeria: 40 }))).toBeNull();
  });

  it('returns null on an empty pool instead of throwing', () => {
    expect(() => build(candidatesFor({}))).not.toThrow();
    expect(build(candidatesFor({}))).toBeNull();
  });
});

/* ── Malformed rows, which upstream data really does produce ───────── */

describe('malformed club rows', () => {
  it('ignores clubs with no country instead of grouping them together', () => {
    const candidates = candidatesFor({ England: 6, Spain: 6, Italy: 6, Algeria: 6 });
    candidates.clubs.push({
      id: 'team:999',
      name: 'Unknown Club',
      apiTeamId: 999,
      logoUrl: 'https://media.api-sports.io/football/teams/999.png',
    });

    const round = build(candidates);
    if (round === null) return;

    // A country-less club may appear as a NON-matching cell (it satisfies no
    // objective), but it must never be an answer cell.
    for (const question of questionsOf(round)) {
      const answerLabels = question
        .bingoBoard!.flat()
        .filter((cell: { id: string }) => question.answer!.correctIds!.includes(cell.id))
        .map((cell: { label?: string }) => cell.label);
      expect(answerLabels).not.toContain('Unknown Club');
    }
  });

  it('terminates when every club is missing its country', () => {
    const candidates = candidatesFor({});
    for (let i = 1; i <= 30; i += 1) {
      candidates.clubs.push({
        id: `team:${i}`,
        name: `Club ${i}`,
        apiTeamId: i,
        logoUrl: `https://media.api-sports.io/football/teams/${i}.png`,
      });
    }

    const { value, ms } = timed(() => build(candidates));

    expect(ms).toBeLessThan(TERMINATION_BUDGET_MS);
    expect(value).toBeNull();
  });

  it('terminates when a country key exists but its list is empty', () => {
    const candidates = candidatesFor({ England: 6, Spain: 6, Italy: 6, Algeria: 6 });
    candidates.clubsByCountry.Confederation = [];

    const { ms } = timed(() => build(candidates));
    expect(ms).toBeLessThan(TERMINATION_BUDGET_MS);
  });
});
