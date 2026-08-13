/**
 * END-TO-END CONTRACT TEST
 *
 * Runs a real AI round through the shape the API serves it in, then through a
 * faithful copy of the app's mapper (front/services/questionsModes.ts →
 * mapSessionToRound) and the screen's rendering rules, and asserts the player
 * actually sees real football data — text AND pictures — on all six questions
 * of every mode.
 *
 * This is the test that catches disappearing images: the mapper reads specific
 * keys (rowImages, players[].imageUrl, …) and silently yields nothing when the
 * backend omits them, and the screen now draws the question's own image with no
 * fallback behind it.
 */

import type { QuizDatasetBuildResult, QuizEntityDataset } from '../../types/quiz-entity.types';
import type {
  GeneratedQuestionChallenge,
  QuestionChallengeQuestion,
} from '../../types/questions-challenges.types';
import { ROUND_QUESTION_COUNT } from '../../constants/quiz.constants';

const mockBuildQuizEntityDataset = jest.fn<Promise<QuizDatasetBuildResult>, []>();
jest.mock('../quiz-entity-dataset.service', () => {
  const actual = jest.requireActual('../quiz-entity-dataset.service');
  return { ...actual, buildQuizEntityDataset: () => mockBuildQuizEntityDataset() };
});

jest.mock('../football.service', () => ({
  footballService: {
    isConfigured: () => true,
    getTeamSquad: jest.fn(),
    getTransfers: jest.fn(async () => [
      {
        player: { id: 1 },
        transfers: [
          {
            date: '2019-07-01',
            teams: {
              in: { name: 'Sevilla', logo: 'https://media.api-sports.io/football/teams/536.png' },
              out: { name: 'Ajax', logo: 'https://media.api-sports.io/football/teams/194.png' },
            },
          },
          {
            date: '2022-07-01',
            teams: {
              in: { name: 'Napoli', logo: 'https://media.api-sports.io/football/teams/492.png' },
              out: { name: 'Sevilla', logo: 'https://media.api-sports.io/football/teams/536.png' },
            },
          },
        ],
      },
    ]),
  },
}));

jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: {
    getTopScorers: jest.fn(async () =>
      Array.from({ length: 6 }, (_, i) => ({
        player: {
          name: `Real Scorer ${i}`,
          photo: `https://media.api-sports.io/football/players/${100 + i}.png`,
        },
        statistics: [{ goals: { total: 25 - i * 2 } }],
      })),
    ),
  },
}));

jest.mock('../football-translation.service', () => ({
  translateFootballNames: jest.fn(async (texts: string[]) => {
    const out: Record<string, string> = {};
    for (const text of texts) out[text] = `ع-${text}`;
    return out;
  }),
}));

jest.mock('../quiz-365-player.service', () => ({
  resolve365QuizPlayerImage: jest.fn(async ({ entityName }: { entityName: string }) => ({
    athleteId: 42,
    name: entityName,
    clubName: null,
    imageUrl: `https://imagecache.365scores.com/${encodeURIComponent(entityName)}.png`,
    score: 0.95,
  })),
}));

/*
 * Football Grid is composed from stored career rows rather than from a model,
 * so this suite — which is about the AI → API → app cycle — leaves that store
 * empty and the mode simply publishes nothing here. Its own board, images and
 * mapping are covered in questions-challenges.data-modes.test.ts.
 */
jest.mock('../../lib/prisma', () => ({
  __esModule: true,
  default: { $queryRawUnsafe: async () => [] },
}));

const mockCallQuestionsAiJson = jest.fn();
jest.mock('../questions-challenges.agent.service', () => ({
  runQuestionsAgent: (...args: unknown[]) => mockCallQuestionsAiJson(...args),
  isQuestionsAgentAvailable: () => true,
}));

import { buildAiQuestionChallenges } from '../questions-challenges.ai-generator.service';
import { buildQuestionsFootballCandidates } from '../questions-challenges.football-data';

/* ─────────── faithful copy of the app's mapper ─────────── */

type MappedType = 'mcq' | 'bingo' | 'grid' | 'connections' | 'transfer' | 'top10';

interface MappedQuestion {
  id: string;
  type: MappedType;
  prompt: string;
  imageUrl?: string;
  hint?: string;
  evidence?: Array<{ id: string; text: string; label?: string; value?: string; icon?: string }>;
  entity?: { kind: string; id: string; name: string; imageUrl?: string };
  options?: Array<{ id: string; label: string; imageUrl?: string; example?: string }>;
  board?: Array<Array<{ id: string; label?: string; imageUrl?: string; kind?: string }>>;
  rowHeaders?: string[];
  colHeaders?: string[];
  rowHeaderImages?: (string | undefined)[];
  connectionPlayers?: Array<{ id: string; name: string; imageUrl: string }>;
  transferChain?: Array<{ id: string; label: string; imageUrl?: string; unknown?: boolean }>;
  rankingItems?: Array<{ id: string; label: string; imageUrl?: string }>;
  correctAnswers: string[];
}

const TYPE_BY_MODE: Record<string, MappedType> = {
  'guess-player': 'mcq',
  'guess-club': 'mcq',
  'football-quiz': 'mcq',
  'football-bingo': 'bingo',
  'football-grid': 'grid',
  'player-connections': 'connections',
  'transfer-puzzle': 'transfer',
  'top10-challenge': 'top10',
};

function optionalImage(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function mapOptions(raw: unknown) {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((option: any) => ({
      id: String(option?.id ?? ''),
      label: String(option?.label ?? ''),
      imageUrl: typeof option?.imageUrl === 'string' ? option.imageUrl : undefined,
      example: typeof option?.example === 'string' ? option.example : undefined,
    }))
    .filter((option) => option.id !== '');
}

/** Mirrors mapRoundQuestion in front/services/questionsModes.ts. */
function mapQuestionAsApp(mode: string, raw: any, index: number): MappedQuestion {
  const answer = raw?.answer ?? {};
  const ordered = Array.isArray(answer.orderedIds) ? answer.orderedIds.map(String) : [];
  const correctIds = Array.isArray(answer.correctIds) ? answer.correctIds.map(String) : [];

  const base: MappedQuestion = {
    id: String(raw?.id ?? `q${index + 1}`),
    type: TYPE_BY_MODE[mode] ?? 'mcq',
    prompt: String(raw?.prompt ?? ''),
    imageUrl: optionalImage(raw?.imageUrl),
    hint: typeof raw?.hint === 'string' ? raw.hint : undefined,
    evidence: Array.isArray(raw?.evidence) && raw.evidence.length > 0 ? raw.evidence : undefined,
    entity: raw?.entity,
    correctAnswers: ordered.length > 0 ? ordered : correctIds,
  };

  switch (base.type) {
    case 'bingo':
      return { ...base, board: Array.isArray(raw?.bingoBoard) ? raw.bingoBoard : [] };
    case 'grid':
      return {
        ...base,
        rowHeaders: Array.isArray(raw?.rows) ? raw.rows.map(String) : [],
        colHeaders: Array.isArray(raw?.columns) ? raw.columns.map(String) : [],
        rowHeaderImages: Array.isArray(raw?.rowImages) ? raw.rowImages : undefined,
      };
    case 'connections':
      return {
        ...base,
        options: mapOptions(raw?.options),
        connectionPlayers: Array.isArray(raw?.players)
          ? raw.players.map((player: any) => ({
              id: String(player?.id ?? ''),
              name: String(player?.name ?? ''),
              imageUrl: String(player?.imageUrl ?? ''),
            }))
          : [],
      };
    case 'transfer':
      return {
        ...base,
        options: mapOptions(raw?.options),
        transferChain: Array.isArray(raw?.transferTimeline)
          ? raw.transferTimeline.map((step: any) => ({
              id: String(step?.id ?? ''),
              label: String(step?.label ?? ''),
              imageUrl: optionalImage(step?.imageUrl),
              unknown: Boolean(step?.hidden),
            }))
          : [],
      };
    case 'top10':
      return { ...base, rankingItems: mapOptions(raw?.options) };
    default:
      return { ...base, options: mapOptions(raw?.options) };
  }
}

/**
 * Mirrors mapSessionToRound: the app reads the round off `content.questions`,
 * which is exactly what GET /questions/modes/:mode/session serves.
 */
function mapRoundAsApp(challenge: GeneratedQuestionChallenge): MappedQuestion[] {
  const questions = (challenge.content.questions ?? []) as QuestionChallengeQuestion[];
  return questions.map((question, index) => mapQuestionAsApp(challenge.mode, question, index));
}

/** Mirrors QuestionsModeScreen: the hero is the question's own image, or none. */
function heroImageAsScreen(question: MappedQuestion): string | undefined {
  return question.imageUrl?.trim() || undefined;
}

/* ─────────── fixtures ─────────── */

const COUNTRIES = ['England', 'Spain', 'Italy'];

function buildDataset(): QuizEntityDataset {
  const clubs = Array.from({ length: 36 }, (_, i) => ({
    id: `team:${500 + i}`,
    name: `Real Club ${i}`,
    apiTeamId: 500 + i,
    country: COUNTRIES[i % 3]!,
    founded: 1880 + i,
    logoUrl: `https://media.api-sports.io/football/teams/${500 + i}.png`,
  }));

  const players = [];
  // One four-player squad per team, and enough TEAMS to give Player
  // Connections a distinct group per question — the fixture used to stop at 8
  // while a round is ROUND_QUESTION_COUNT questions, so the last groups came
  // back undefined and every test in this file died on `group.clubId`.
  for (let team = 0; team < Math.max(ROUND_QUESTION_COUNT, 8); team += 1) {
    for (let slot = 0; slot < 4; slot += 1) {
      const index = team * 4 + slot;
      players.push({
        id: `player:${9000 + index}`,
        name: `Real Player ${index}`,
        apiPlayerId: 9000 + index,
        position: ['Attacker', 'Midfielder', 'Defender', 'Goalkeeper'][slot]!,
        teamId: 500 + team,
        teamName: `Real Club ${team}`,
        country: COUNTRIES[team % 3]!,
        nationality: COUNTRIES[slot % 3]!,
        jerseyNumber: index + 1,
      });
    }
  }

  const stadiums = Array.from({ length: 20 }, (_, i) => ({
    id: `venue:${500 + i}`,
    name: `Real Stadium ${i}`,
    teamName: `Real Club ${i}`,
    apiTeamId: 500 + i,
    imageUrl: `https://media.api-sports.io/football/venues/${500 + i}.png`,
  }));

  return { players, clubs, stadiums };
}

const EVIDENCE = [
  { label: 'Country', value: 'England', icon: 'globe' },
  { label: 'Founded', value: '1902', icon: 'calendar' },
];

/** A well-behaved model reply, built from the pools the backend assembled. */
function replyFor(mode: string, candidates: any): { questions: any[] } {
  const indexes = Array.from({ length: ROUND_QUESTION_COUNT }, (_, i) => i);
  const q = (index: number, extra: Record<string, unknown>) => ({
    id: `q${index + 1}`,
    difficulty: ['EASY', 'MEDIUM', 'HARD'][index % 3],
    confidence: 97,
    prompt: `${mode} prompt ${index + 1}`,
    hint: `${mode} hint ${index + 1}`,
    evidence: EVIDENCE,
    ...extra,
  });

  switch (mode) {
    case 'guess-player':
      return {
        questions: indexes.map((i) =>
          q(i, {
            targetPlayerId: candidates.players[i].id,
            distractorPlayerIds: [
              candidates.players[(i + 7) % candidates.players.length].id,
              candidates.players[(i + 13) % candidates.players.length].id,
              candidates.players[(i + 19) % candidates.players.length].id,
            ],
          }),
        ),
      };
    case 'guess-club':
      return {
        questions: indexes.map((i) =>
          q(i, {
            targetClubId: candidates.clubs[i].id,
            distractorClubIds: [
              candidates.clubs[i + 10].id,
              candidates.clubs[i + 17].id,
              candidates.clubs[i + 24].id,
            ],
          }),
        ),
      };
    case 'football-bingo':
      return {
        questions: indexes.map((i) => {
          const country = COUNTRIES[i % 3]!;
          const inCountry = candidates.clubsByCountry[country];
          const outside = candidates.clubs.filter((club: any) => club.country !== country);
          return q(i, {
            country,
            objective: `Pick the 3 clubs from ${country} (${i})`,
            correctClubIds: [inCountry[i].id, inCountry[i + 1].id, inCountry[i + 2].id],
            otherClubIds: outside.slice(i, i + 6).map((club: any) => club.id),
          });
        }),
      };
    case 'football-grid':
      return {
        questions: indexes.map((i) => {
          const player = candidates.players[i];
          const otherClubs = candidates.clubs
            .filter((club: any) => club.apiTeamId !== player.teamId)
            .slice(0, 2);
          return q(i, {
            targetPlayerId: player.id,
            otherClubIds: otherClubs.map((club: any) => club.id),
            otherNationalities: COUNTRIES.filter((n) => n !== player.nationality).slice(0, 2),
          });
        }),
      };
    case 'player-connections':
      return {
        questions: indexes.map((i) => {
          const group = candidates.teammateGroups[i];
          const others = candidates.clubs
            .filter((club: any) => club.id !== group.clubId)
            .slice(i, i + 3);
          return q(i, {
            groupId: group.id,
            options: [
              { clubId: group.clubId, text: `Correct link ${i}`, example: 'e.g. team-mates' },
              ...others.map((club: any, k: number) => ({
                clubId: club.id,
                text: `Wrong link ${i}-${k}`,
                example: '',
              })),
            ],
          });
        }),
      };
    case 'transfer-puzzle':
      return {
        questions: indexes.map((i) => {
          const transfer = candidates.transfers[i];
          const used = new Set([
            transfer.finalStep.clubName,
            ...transfer.priorSteps.map((step: any) => step.clubName),
          ]);
          const others = candidates.clubs.filter((club: any) => !used.has(club.name)).slice(i, i + 3);
          return q(i, { transferId: transfer.id, distractorClubIds: others.map((club: any) => club.id) });
        }),
      };
    case 'top10-challenge':
      return { questions: indexes.map((i) => q(i, { rankingId: candidates.rankings[i].id })) };
    default:
      return { questions: [] };
  }
}

const isRemote = (value: unknown) => typeof value === 'string' && /^https?:\/\/.+/.test(value);

async function buildRound(language: 'en' | 'ar'): Promise<GeneratedQuestionChallenge[]> {
  const candidates = await buildQuestionsFootballCandidates(language, '2026-06-10');
  mockCallQuestionsAiJson.mockImplementation(async ({ label }: { label: string }) => ({
    payload: replyFor(label.split(':')[0]!, candidates),
    model: 'contract-test-model',
  }));
  const rounds = await buildAiQuestionChallenges(language, '2026-06-10');
  expect(rounds).not.toBeNull();
  return rounds!;
}

describe('Questions cycle: AI → API payload → app mapper → rendered question', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockBuildQuizEntityDataset.mockResolvedValue({ ok: true, dataset: buildDataset() });
  });

  test('the app receives six real questions per mode', async () => {
    const rounds = await buildRound('en');

    for (const challenge of rounds) {
      const questions = mapRoundAsApp(challenge);
      expect(questions).toHaveLength(ROUND_QUESTION_COUNT);
      expect(new Set(questions.map((question) => question.id)).size).toBe(ROUND_QUESTION_COUNT);
    }
  });

  test('every question reaches the UI with a prompt, a real answer key, and no placeholder copy', async () => {
    const rounds = await buildRound('en');

    for (const challenge of rounds) {
      expect(challenge.metadata.source).toBe('AI');
      // Nothing in the payload may be the old canned preview content.
      expect(JSON.stringify(challenge)).not.toMatch(/Temporary preview content|محتوى مؤقت|unsplash/i);

      for (const question of mapRoundAsApp(challenge)) {
        expect(question.prompt.trim().length).toBeGreaterThan(0);
        expect(question.correctAnswers.length).toBeGreaterThan(0);
      }
    }
  });

  test('every picture the UI will draw survives the mapper as a real remote URL', async () => {
    const rounds = await buildRound('en');
    const byMode = new Map(rounds.map((challenge) => [challenge.mode, mapRoundAsApp(challenge)]));

    for (const question of byMode.get('guess-player')!) {
      expect(isRemote(heroImageAsScreen(question))).toBe(true);
    }
    for (const question of byMode.get('guess-club')!) {
      expect(isRemote(heroImageAsScreen(question))).toBe(true);
    }

    for (const question of byMode.get('football-bingo')!) {
      const cells = question.board!.flat();
      expect(cells).toHaveLength(9);
      expect(cells.every((cell) => isRemote(cell.imageUrl))).toBe(true);
    }


    for (const question of byMode.get('player-connections')!) {
      const players = question.connectionPlayers!;
      expect(players).toHaveLength(4);
      expect(players.every((player) => isRemote(player.imageUrl))).toBe(true);
      expect(new Set(players.map((player) => player.imageUrl)).size).toBe(4);
    }

    for (const question of byMode.get('transfer-puzzle')!) {
      const chain = question.transferChain!;
      expect(chain.filter((step) => step.unknown)).toHaveLength(1);
      expect(chain.filter((step) => !step.unknown).every((step) => isRemote(step.imageUrl))).toBe(true);
      expect(question.options!.every((option) => isRemote(option.imageUrl))).toBe(true);
    }

  });

  test('the image shown always belongs to the entity named beside it', async () => {
    const rounds = await buildRound('en');
    const byMode = new Map(rounds.map((challenge) => [challenge.mode, mapRoundAsApp(challenge)]));

    for (const question of byMode.get('guess-player')!) {
      const correct = question.options!.find((option) => option.id === question.correctAnswers[0])!;
      expect(decodeURIComponent(question.imageUrl!)).toContain(correct.label);
      expect(question.entity!.name).toBe(correct.label);
      expect(question.entity!.imageUrl).toBe(question.imageUrl);
    }

    for (const question of byMode.get('guess-club')!) {
      const correct = question.options!.find((option) => option.id === question.correctAnswers[0])!;
      const clubIndex = Number(String(correct.label).replace('Real Club ', ''));
      expect(question.imageUrl).toBe(`https://media.api-sports.io/football/teams/${500 + clubIndex}.png`);
    }

    for (const question of byMode.get('player-connections')!) {
      for (const player of question.connectionPlayers!) {
        expect(decodeURIComponent(player.imageUrl)).toContain(player.name);
      }
    }

    for (const question of byMode.get('transfer-puzzle')!) {
      const correct = question.options!.find((option) => option.id === question.correctAnswers[0])!;
      expect(correct.label).toBe('Napoli');
      expect(correct.imageUrl).toBe('https://media.api-sports.io/football/teams/492.png');
    }
  });

  test('a question the screen draws a hero for never renders an empty frame', async () => {
    const rounds = await buildRound('en');

    // The screen has no artwork fallback any more, so "has a hero" and "has a
    // real URL" have to be the same thing for the modes that show one.
    for (const mode of ['guess-player', 'guess-club']) {
      const challenge = rounds.find((entry) => entry.mode === mode)!;
      for (const question of mapRoundAsApp(challenge)) {
        expect(heroImageAsScreen(question)).toBeDefined();
      }
    }

    // Board modes deliberately have no hero, and must not borrow one.
    for (const mode of ['football-bingo', 'player-connections', 'transfer-puzzle']) {
      const challenge = rounds.find((entry) => entry.mode === mode)!;
      for (const question of mapRoundAsApp(challenge)) {
        expect(heroImageAsScreen(question)).toBeUndefined();
      }
    }
  });

  test('answer keys are answerable: the correct id is among what the UI renders', async () => {
    const rounds = await buildRound('en');

    for (const challenge of rounds) {
      for (const question of mapRoundAsApp(challenge)) {
        if (question.type === 'grid') {
          expect(question.correctAnswers[0]).toMatch(/^r[0-2]-c[0-2]$/);
          continue;
        }
        const selectableIds = [
          ...(question.options ?? []).map((option) => option.id),
          ...(question.board ?? []).flat().map((cell) => cell.id),
          ...(question.rankingItems ?? []).map((item) => item.id),
        ];
        for (const correctId of question.correctAnswers) {
          expect(selectableIds).toContain(correctId);
        }
      }
    }
  });

  test('option sets are exactly 4 and duplicate-free on every MCQ-style question', async () => {
    const rounds = await buildRound('en');
    const mcqModes = ['guess-player', 'guess-club', 'player-connections', 'transfer-puzzle'];

    for (const challenge of rounds.filter((entry) => mcqModes.includes(entry.mode))) {
      for (const question of mapRoundAsApp(challenge)) {
        expect(question.options).toHaveLength(4);
        expect(new Set(question.options!.map((option) => option.id)).size).toBe(4);
        expect(new Set(question.options!.map((option) => option.label)).size).toBe(4);
      }
    }
  });

  test('the Evidence block arrives as label/value rows the screen can draw', async () => {
    const rounds = await buildRound('en');

    for (const mode of ['guess-player', 'guess-club']) {
      const challenge = rounds.find((entry) => entry.mode === mode)!;
      for (const question of mapRoundAsApp(challenge)) {
        expect(question.evidence!.length).toBeGreaterThan(0);
        for (const clue of question.evidence!) {
          expect(clue.id).toBeTruthy();
          expect(clue.text.trim().length).toBeGreaterThan(0);
        }
      }
    }
  });

  test("the round's advertised XP is the sum of its questions' XP", async () => {
    const rounds = await buildRound('en');

    for (const challenge of rounds) {
      const questions = challenge.content.questions!;
      expect(challenge.xpReward).toBe(
        questions.reduce((total, question) => total + question.xpReward, 0),
      );
    }
  });

  test('Arabic keeps real localized text AND real artwork together', async () => {
    const rounds = await buildRound('ar');
    const byMode = new Map(rounds.map((challenge) => [challenge.mode, mapRoundAsApp(challenge)]));

    for (const question of byMode.get('player-connections')!) {
      // Localized through the documented football-names translator…
      expect(question.connectionPlayers!.every((player) => player.name.startsWith('ع-'))).toBe(true);
      // …and the artwork still arrives, which is exactly what broke when the
      // client resolved crests from an English-keyed lookup table.
      expect(question.connectionPlayers!.every((player) => isRemote(player.imageUrl))).toBe(true);
    }

    for (const question of byMode.get('football-bingo')!) {
      expect(question.board!.flat().every((cell) => isRemote(cell.imageUrl))).toBe(true);
    }
    for (const question of byMode.get('guess-club')!) {
      expect(isRemote(heroImageAsScreen(question))).toBe(true);
      expect(question.options!.every((option) => option.label.startsWith('ع-'))).toBe(true);
    }
  });

  test('the hub card carries no server artwork, so it keeps its own illustration', async () => {
    const rounds = await buildRound('en');
    for (const challenge of rounds) {
      expect(challenge.image).toBe('');
    }
  });
});
