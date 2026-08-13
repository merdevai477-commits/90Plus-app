/**
 * THE TWO DATA-COMPOSED MODES — Football Grid and Top 10.
 *
 * Neither goes near a model: a grid cell is "played for this club AND won this
 * award" and a Top 10 is a recorded scorer ranking, so both are read out of
 * stored football data instead of being written. These tests pin down that
 * the boards are built ONLY from that data, that the answer never reaches the
 * client, and that a typed name is matched the way a person actually types it.
 */

import { FOOTBALL_GRID_CELL_COUNT, TOP10_SLOT_COUNT } from '../../constants/questions-modes.config';
import type { QuestionChallengeQuestion } from '../../types/questions-challenges.types';

/* ── stored career rows: the only football data these modes may use ── */

interface CareerFixture {
  athleteId: number;
  name: string;
  photo: string;
  teamIds: number[];
  awardIds: number[];
}

const careerRows: CareerFixture[] = [];

jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: {
    $queryRawUnsafe: async () =>
      careerRows.map((row) => ({
        athleteId: row.athleteId,
        name: row.name,
        photo: row.photo,
        data: {
          seasons: row.teamIds.map((teamId, index) => ({
            seasonKey: String(2015 + index),
            competitions: [{ teamId, teamName: `Club (${TEAM_NAMES[teamId] ?? teamId})` }],
          })),
          trophies: row.awardIds.map((competitionId) => ({
            competitionId,
            name: AWARD_NAMES[competitionId] ?? String(competitionId),
            displayName: AWARD_NAMES[competitionId] ?? String(competitionId),
            categoryName: 'Club',
          })),
        },
      })),
  },
}));

const TEAM_NAMES: Record<number, string> = { 1: 'Liverpool', 2: 'Arsenal', 3: 'Chelsea', 4: 'Everton' };
const AWARD_NAMES: Record<number, string> = {
  10: 'Champions League',
  20: 'Premier League',
  30: 'World Cup',
  40: 'Europa League',
};

import { buildFootballGridBoard } from '../questions-challenges.grid-data';
import {
  gradeTop10Entries,
  matchesTop10Name,
  normalizeTop10Name,
} from '../questions-challenges.top10';
import { validateQuestionContract, validateRoundContract } from '../questions-challenges.round-contract';
import { buildSessionView, sanitizeQuestionForClient } from '../questions-challenges.session.service';

/** Every club × award pair covered, so a full 3×3 board exists. */
function seedFullBoard(): void {
  careerRows.length = 0;
  let athleteId = 1;
  for (const teamId of [1, 2, 3]) {
    for (const awardId of [10, 20, 30]) {
      careerRows.push({
        athleteId,
        name: `Player ${athleteId}`,
        photo: `https://imagecache.365scores.com/Athletes/${athleteId}`,
        teamIds: [teamId],
        awardIds: [awardId],
      });
      athleteId += 1;
    }
  }
  // Near misses: real players who fill only one half of a cell.
  for (const teamId of [1, 2, 3, 4]) {
    careerRows.push({
      athleteId,
      name: `Near Miss ${athleteId}`,
      photo: `https://imagecache.365scores.com/Athletes/${athleteId}`,
      teamIds: [teamId],
      awardIds: [40],
    });
    athleteId += 1;
  }
}

describe('Football Grid — the board comes out of stored career data', () => {
  beforeEach(seedFullBoard);

  test('builds a 3×3 board of awards × clubs with every cell fillable', async () => {
    const board = await buildFootballGridBoard('en', '2026-06-10');

    expect(board).not.toBeNull();
    expect(board!.rows).toHaveLength(3);
    expect(board!.columns).toHaveLength(3);
    expect(board!.cells.size).toBe(FOOTBALL_GRID_CELL_COUNT);
    for (const [, players] of board!.cells) {
      expect(players.length).toBeGreaterThan(0);
    }
  });

  test('every cell candidate really played for the row AND won the column', async () => {
    const board = await buildFootballGridBoard('en', '2026-06-10');

    for (let row = 0; row < 3; row += 1) {
      for (let column = 0; column < 3; column += 1) {
        const rowRef = board!.rows[row]!.refId;
        const columnRef = board!.columns[column]!.refId;
        for (const player of board!.cells.get(`r${row}-c${column}`)!) {
          expect(player.teamIds.has(rowRef)).toBe(true);
          expect(player.awardIds.has(columnRef)).toBe(true);
        }
      }
    }
  });

  test('row crests are the provider’s own, keyed by the club’s id — never by name', async () => {
    const board = await buildFootballGridBoard('en', '2026-06-10');

    for (const row of board!.rows) {
      expect(row.imageUrl).toContain(`/Competitors/${row.refId}`);
      expect(row.imageUrl.startsWith('https://')).toBe(true);
    }
  });

  test('publishes nothing when the stored data cannot fill all nine cells', async () => {
    // One club, one award: a board would need eight invented cells.
    careerRows.length = 0;
    for (let athleteId = 1; athleteId <= 20; athleteId += 1) {
      careerRows.push({
        athleteId,
        name: `Player ${athleteId}`,
        photo: `https://imagecache.365scores.com/Athletes/${athleteId}`,
        teamIds: [1],
        awardIds: [10],
      });
    }

    expect(await buildFootballGridBoard('en', '2026-06-10')).toBeNull();
  });

  test('the board is stable for a given day and language', async () => {
    const first = await buildFootballGridBoard('en', '2026-06-10');
    const second = await buildFootballGridBoard('en', '2026-06-10');

    expect(second!.rows.map((row) => row.refId)).toEqual(first!.rows.map((row) => row.refId));
    expect(second!.columns.map((column) => column.refId)).toEqual(
      first!.columns.map((column) => column.refId),
    );
  });

  test('a grid question is refused unless it names a real cell of the board', () => {
    const question: QuestionChallengeQuestion = {
      id: 'q1',
      difficulty: 'EASY',
      xpReward: 10,
      prompt: 'Pick a player who played for Liverpool and won the Champions League',
      rows: ['Liverpool', 'Arsenal', 'Chelsea'],
      columns: ['Champions League', 'Premier League', 'World Cup'],
      rowImages: ['https://img/1', 'https://img/2', 'https://img/3'],
      gridCell: { row: 0, column: 0 },
      options: ['a', 'b', 'c', 'd'].map((id, slot) => ({
        id,
        label: `Player ${slot}`,
        imageUrl: `https://img/p${slot}`,
      })),
      answer: { correctIds: ['a'] },
    };

    expect(validateQuestionContract('football-grid', question)).toEqual([]);

    expect(
      validateQuestionContract('football-grid', { ...question, gridCell: { row: 3, column: 0 } }),
    ).toContain('q1:GRID_CELL_OUT_OF_RANGE');
    expect(validateQuestionContract('football-grid', { ...question, gridCell: undefined })).toContain(
      'q1:GRID_CELL_OUT_OF_RANGE',
    );
  });

  test('a grid question tells the client to submit one player, with no confirm step', () => {
    const sanitized = sanitizeQuestionForClient('football-grid', {
      id: 'q1',
      difficulty: 'EASY',
      xpReward: 10,
      prompt: 'p',
      gridCell: { row: 0, column: 0 },
      options: [{ id: 'a', label: 'Player', imageUrl: 'https://img/p' }],
      answer: { correctIds: ['a'] },
    });

    expect(sanitized.selection).toEqual({
      selectionMode: 'single',
      requiredSelections: 1,
      maxSelections: 1,
      autoSubmit: true,
    });
    expect((sanitized as Record<string, unknown>).answer).toBeUndefined();
  });

  /*
   * A board whose cells all resolve to the same one or two players is a memory
   * test, not a grid — and it is what a greedy "first player who fits" pass
   * produces even when the same data supports nine different answers.
   */
  test('the nine cells answer to nine different players when the data allows it', async () => {
    const board = await buildFootballGridBoard('en', '2026-08-13');
    expect(board).not.toBeNull();

    const answers = [...board!.answers.values()].map((player) => player.id);
    expect(answers).toHaveLength(FOOTBALL_GRID_CELL_COUNT);
    expect(new Set(answers).size).toBe(FOOTBALL_GRID_CELL_COUNT);

    // …and each one really does fill the cell it was assigned to.
    for (const [cellKey, player] of board!.answers) {
      expect(board!.cells.get(cellKey)!.map((entry) => entry.id)).toContain(player.id);
    }
  });
});

/**
 * REOPENING A BOARD.
 *
 * Which cells are already won is per player, and the app cannot hold it —
 * leaving the screen drops the component's state. Without this the board came
 * back blank part-way through a round the server had every placement for.
 */
describe('Football Grid — a reopened board redraws the cells already won', () => {
  const gridQuestion = (id: string, row: number, column: number): QuestionChallengeQuestion => ({
    id,
    difficulty: 'EASY',
    xpReward: 10,
    prompt: `cell ${row},${column}`,
    rows: ['Liverpool', 'Arsenal', 'Chelsea'],
    columns: ['Champions League', 'Premier League', 'World Cup'],
    rowImages: ['https://img/1', 'https://img/2', 'https://img/3'],
    gridCell: { row, column },
    options: ['a', 'b', 'c', 'd'].map((optionId, slot) => ({
      id: optionId,
      label: `Player ${id}${slot}`,
      imageUrl: `https://img/${id}${slot}`,
    })),
    answer: { correctIds: ['a'] },
  });

  const questions = [gridQuestion('q1', 0, 0), gridQuestion('q2', 0, 1), gridQuestion('q3', 0, 2)];

  const sessionView = (byQuestionId: Record<string, unknown>) =>
    buildSessionView({
      mode: 'football-grid',
      challenge: {
        id: 'c1',
        title: 't',
        description: 'd',
        image: 'https://img/x',
        icon: 'table',
        difficulty: 'EASY',
        xpReward: 10,
        refreshDate: '2026-08-13',
        refreshTime: '00:00',
        streakContribution: true,
        leaderboardEligibility: true,
        content: { questions },
      },
      questions,
      progress: {
        byQuestionId,
        sessionStatus: 'IN_PROGRESS',
        currentQuestionIndex: 1,
        questionStartedAt: null,
        questionExpiresAt: null,
      },
      progressMeta: {
        attempts: 1,
        completed: false,
        score: 1,
        elapsedTime: 3,
        completionPercentage: 33,
        unlocked: true,
      },
      now: new Date('2026-08-13T10:00:00.000Z'),
    } as Parameters<typeof buildSessionView>[0]);

  const answered = (isCorrect: boolean, selectedIds: string[]) => ({
    status: 'answered' as const,
    attempts: 1,
    isCorrect,
    answeredAt: '2026-08-13T09:59:00.000Z',
    selectedIds,
    timeExpired: false,
    pointsEarned: isCorrect ? 1 : 0,
    completionPercentage: isCorrect ? 100 : 0,
  });

  test('an accepted placement comes back with the player who was placed', () => {
    const view = sessionView({ q1: answered(true, ['a']) });

    expect(view.gridPlacements).toEqual({
      'r0-c0': { label: 'Player q10', imageUrl: 'https://img/q10' },
    });
  });

  test('a refused placement leaves its cell empty', () => {
    const view = sessionView({ q1: answered(false, ['b']) });

    expect(view.gridPlacements).toEqual({});
  });

  test('cells that have not been played are not described at all', () => {
    const view = sessionView({ q1: answered(true, ['a']), q2: answered(true, ['a']) });

    expect(Object.keys(view.gridPlacements ?? {})).toEqual(['r0-c0', 'r0-c1']);
    expect(view.gridPlacements).not.toHaveProperty('r0-c2');
  });
});

describe('Top 10 — ten typed names against a real ranking', () => {
  const slots = Array.from({ length: TOP10_SLOT_COUNT }, (_, index) => ({
    rank: index + 1,
    canonical: [
      'Mohamed Salah',
      'Erling Haaland',
      'Luka Modrić',
      'Kylian Mbappé',
      'Harry Kane',
      'Vinícius Júnior',
      'Bukayo Saka',
      'Rodri Hernández',
      'Jude Bellingham',
      'Son Heung-min',
    ][index]!,
    aliases: [],
    imageUrl: `https://imagecache.365scores.com/Athletes/${index}`,
    value: 30 - index,
  }));

  test('the round is one question and it carries no names', () => {
    const question: QuestionChallengeQuestion = {
      id: 'q1',
      difficulty: 'HARD',
      xpReward: 20,
      prompt: 'Name the top 10 scorers',
      top10: { slots: TOP10_SLOT_COUNT, categoryLabel: 'the Premier League', seasonLabel: '2010' },
      answer: { orderedAnswers: slots },
    };

    expect(validateRoundContract({ mode: 'top10-challenge', questions: [question] }).ok).toBe(true);

    const sanitized = sanitizeQuestionForClient('top10-challenge', question);
    // The framing crosses the wire; the names do not.
    expect(sanitized.top10).toEqual({
      slots: TOP10_SLOT_COUNT,
      categoryLabel: 'the Premier League',
      seasonLabel: '2010',
    });
    expect(JSON.stringify(sanitized)).not.toContain('Salah');
    expect(sanitized.selection.selectionMode).toBe('text');
    expect(sanitized.selection.requiredSelections).toBe(TOP10_SLOT_COUNT);
  });

  test('normalizes case, spacing, punctuation, accents and Arabic forms', () => {
    expect(normalizeTop10Name('  Mohamed   SALAH ')).toBe('mohamed salah');
    expect(normalizeTop10Name('Mbappé')).toBe(normalizeTop10Name('Mbappe'));
    expect(normalizeTop10Name('Modrić')).toBe(normalizeTop10Name('Modric'));
    expect(normalizeTop10Name('O’Neill')).toBe('o neill');
    expect(normalizeTop10Name('الأهلي')).toBe(normalizeTop10Name('الاهلي'));
  });

  test('accepts an honest misspelling', () => {
    const slot = slots[0]!;
    expect(matchesTop10Name('Mohamed Salah', slot)).toBe(true);
    expect(matchesTop10Name('mohammed salah', slot)).toBe(true);
    expect(matchesTop10Name('Mohamed Salahh', slot)).toBe(true);
  });

  test('refuses a different player, however similar the name looks', () => {
    expect(matchesTop10Name('Harry Kean', slots[1]!)).toBe(false); // vs Haaland
    expect(matchesTop10Name('Ronaldo', slots[0]!)).toBe(false);
    // Short names never fuzzy-match: "Kane" must not become "Kean".
    expect(matchesTop10Name('Kean', { rank: 5, canonical: 'Kane', aliases: [] })).toBe(false);
  });

  test('accepts a recorded alias but not a made-up one', () => {
    const slot = { rank: 1, canonical: 'Rodri Hernández', aliases: ['Rodri'] };
    expect(matchesTop10Name('Rodri', slot)).toBe(true);
    expect(matchesTop10Name('Rodrigo', slot)).toBe(false);
  });

  test('ordered grading credits a name only in its real position', () => {
    const entries = Array.from({ length: TOP10_SLOT_COUNT }, () => '');
    entries[0] = 'Erling Haaland'; // belongs at rank 2
    entries[1] = 'Mohamed Salah'; // belongs at rank 1

    const grade = gradeTop10Entries(entries, slots, 'ordered');
    expect(grade.correctCount).toBe(0);
  });

  test('membership grading credits a name wherever it was typed', () => {
    const entries = Array.from({ length: TOP10_SLOT_COUNT }, () => '');
    entries[0] = 'Erling Haaland';
    entries[1] = 'Mohamed Salah';

    const grade = gradeTop10Entries(entries, slots, 'membership');
    expect(grade.correctCount).toBe(2);
  });

  test('membership grading credits one real player once, however often it is typed', () => {
    const entries = Array.from({ length: TOP10_SLOT_COUNT }, () => 'Mohamed Salah');

    const grade = gradeTop10Entries(entries, slots, 'membership');
    expect(grade.correctCount).toBe(1);
  });

  test('a near-miss that fits several real names credits none of them', () => {
    // "Scorer 0-X" is one character from nine different names in this list, so
    // it has identified nobody — crediting the first one scanned would be the
    // grader guessing on the player's behalf.
    const similar = Array.from({ length: TOP10_SLOT_COUNT }, (_, index) => ({
      rank: index + 1,
      canonical: `Scorer 0-${index}`,
      aliases: [],
    }));
    const entries = similar.map(() => '');
    entries[5] = 'Scorer 0-X';

    expect(gradeTop10Entries(entries, similar, 'ordered').correctCount).toBe(0);
    expect(gradeTop10Entries(entries, similar, 'membership').correctCount).toBe(0);
  });

  test('an exact spelling still counts even among near-identical names', () => {
    const similar = Array.from({ length: TOP10_SLOT_COUNT }, (_, index) => ({
      rank: index + 1,
      canonical: `Scorer 0-${index}`,
      aliases: [],
    }));
    const entries = similar.map((slot) => slot.canonical);

    expect(gradeTop10Entries(entries, similar, 'ordered').correctCount).toBe(TOP10_SLOT_COUNT);
  });

  test('all ten in the right places is a perfect list', () => {
    const entries = slots.map((slot) => slot.canonical);

    const grade = gradeTop10Entries(entries, slots, 'ordered');
    expect(grade.correctCount).toBe(TOP10_SLOT_COUNT);
    expect(grade.isPerfect).toBe(true);
  });

  test('an empty list scores nothing and crashes nothing', () => {
    const grade = gradeTop10Entries([], slots, 'ordered');
    expect(grade.correctCount).toBe(0);
    expect(grade.isPerfect).toBe(false);
  });
});
