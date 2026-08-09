/**
 * THE AI QUESTIONS GENERATOR
 *
 * Covers the whole contract: what we send the model, what we accept back, and
 * what we refuse. The refusals matter most — the model is the only component
 * here that can invent a fact, and every one of these tests pins down a way it
 * is stopped from doing so.
 */

import type { QuizDatasetBuildResult, QuizEntityDataset } from '../../types/quiz-entity.types';
import { ROUND_QUESTION_COUNT } from '../../constants/quiz.constants';

/* ── real football data the AI is given (all mocked at the source) ── */

const mockBuildQuizEntityDataset = jest.fn<Promise<QuizDatasetBuildResult>, []>();
jest.mock('../quiz-entity-dataset.service', () => {
  const actual = jest.requireActual('../quiz-entity-dataset.service');
  return { ...actual, buildQuizEntityDataset: () => mockBuildQuizEntityDataset() };
});

const mockIsConfigured = jest.fn<boolean, []>();
const mockGetTransfers = jest.fn();
jest.mock('../football.service', () => ({
  footballService: {
    isConfigured: () => mockIsConfigured(),
    getTransfers: (...args: unknown[]) => mockGetTransfers(...args),
    getTeamSquad: jest.fn(),
  },
}));

const mockGetTopScorers = jest.fn();
jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: { getTopScorers: (...args: unknown[]) => mockGetTopScorers(...args) },
}));

const mockTranslateFootballNames = jest.fn();
jest.mock('../football-translation.service', () => ({
  translateFootballNames: (...args: unknown[]) => mockTranslateFootballNames(...args),
}));

const mockResolve365QuizPlayerImage = jest.fn();
jest.mock('../quiz-365-player.service', () => ({
  resolve365QuizPlayerImage: (...args: unknown[]) => mockResolve365QuizPlayerImage(...args),
}));

/* ── the AI itself ── */

const mockCallQuestionsAiJson = jest.fn();
const mockIsQuestionsAiConfigured = jest.fn<boolean, []>();
jest.mock('../questions-challenges.ai-client', () => ({
  callQuestionsAiJson: (...args: unknown[]) => mockCallQuestionsAiJson(...args),
  isQuestionsAiConfigured: () => mockIsQuestionsAiConfigured(),
}));

import {
  AI_QUESTION_MODES,
  buildAiQuestionChallenges,
  parseAiQuestionsPayload,
  validateQuestionIntegrity,
  validateRoundIntegrity,
} from '../questions-challenges.ai-generator.service';
import { buildQuestionsSystemPrompt, buildQuestionsUserPrompt } from '../questions-challenges.ai-prompt';
import { buildQuestionsFootballCandidates } from '../questions-challenges.football-data';
import type { GeneratedQuestionChallenge, QuestionChallengeQuestion } from '../../types/questions-challenges.types';

/* ────────────────────────── fixtures ────────────────────────── */

const COUNTRIES = ['England', 'Spain', 'Italy'];

function buildDataset(): QuizEntityDataset {
  // 12 clubs per country so bingo always has 3 from one and 6 from elsewhere.
  const clubs = Array.from({ length: 36 }, (_, i) => ({
    id: `team:${500 + i}`,
    name: `Club ${i}`,
    apiTeamId: 500 + i,
    country: COUNTRIES[i % 3]!,
    founded: 1880 + i,
    logoUrl: `https://crests.example.com/${i}.png`,
  }));

  // 8 clubs with 4 team-mates each — enough teammate groups for a full round.
  const players = [];
  for (let team = 0; team < 8; team += 1) {
    for (let slot = 0; slot < 4; slot += 1) {
      const index = team * 4 + slot;
      players.push({
        id: `player:${9000 + index}`,
        name: `Player ${index}`,
        apiPlayerId: 9000 + index,
        position: ['Attacker', 'Midfielder', 'Defender', 'Goalkeeper'][slot]!,
        teamId: 500 + team,
        teamName: `Club ${team}`,
        country: COUNTRIES[team % 3]!,
        nationality: COUNTRIES[slot % 3]!,
        jerseyNumber: index + 1,
      });
    }
  }

  const stadiums = Array.from({ length: 20 }, (_, i) => ({
    id: `venue:${500 + i}`,
    name: `Stadium ${i}`,
    teamName: `Club ${i}`,
    apiTeamId: 500 + i,
    imageUrl: `https://venues.example.com/${i}.png`,
  }));

  return { players, clubs, stadiums };
}

function transferRows(playerId: number) {
  return [
    {
      player: { id: playerId },
      transfers: [
        {
          date: '2015-07-01',
          teams: { in: { name: 'Club 3', logo: 'https://crests.example.com/3.png' }, out: { name: 'Club 0' } },
        },
        {
          date: '2019-07-01',
          teams: { in: { name: 'Club 5', logo: 'https://crests.example.com/5.png' }, out: { name: 'Club 3' } },
        },
        {
          date: '2022-07-01',
          teams: { in: { name: 'Club 7', logo: 'https://crests.example.com/7.png' }, out: { name: 'Club 5' } },
        },
      ],
    },
  ];
}

function topScorers() {
  return Array.from({ length: 6 }, (_, i) => ({
    player: { name: `Scorer ${i}`, photo: `https://players.example.com/${i}.png` },
    statistics: [{ goals: { total: 30 - i * 2 } }],
  }));
}

const EVIDENCE = [
  { label: 'Country', value: 'England', icon: 'globe' },
  { label: 'Founded', value: '1902', icon: 'calendar' },
];

/**
 * A model reply that plays by the rules, built from the candidate pools the
 * generator actually assembled. This is the "good AI" baseline; individual
 * tests then break one thing at a time.
 */
function goodReplyFor(mode: string, candidates: any): { questions: any[] } {
  // Pools this mode needs, in the quantity a full round needs. When the real
  // data isn't there the model has nothing to answer with — same as a live one.
  const enoughCountryClubs = COUNTRIES.every(
    (country) => (candidates.clubsByCountry[country]?.length ?? 0) >= ROUND_QUESTION_COUNT + 2,
  );
  const available: Record<string, boolean> = {
    'guess-player': candidates.players.length >= ROUND_QUESTION_COUNT * 2,
    'guess-club': candidates.clubs.length >= ROUND_QUESTION_COUNT * 5,
    'football-bingo': enoughCountryClubs && candidates.clubs.length >= ROUND_QUESTION_COUNT * 3,
    'football-grid': candidates.players.length >= ROUND_QUESTION_COUNT,
    'player-connections': candidates.teammateGroups.length >= ROUND_QUESTION_COUNT,
    'transfer-puzzle': candidates.transfers.length >= ROUND_QUESTION_COUNT,
    'top10-challenge': candidates.rankings.length >= ROUND_QUESTION_COUNT,
  };
  if (!available[mode]) return { questions: [] };

  const q = (index: number, extra: Record<string, unknown>) => ({
    id: `q${index + 1}`,
    difficulty: ['EASY', 'MEDIUM', 'HARD'][index % 3],
    confidence: 96,
    prompt: `${mode} prompt ${index + 1}`,
    hint: `${mode} hint ${index + 1}`,
    evidence: EVIDENCE,
    ...extra,
  });

  const indexes = Array.from({ length: ROUND_QUESTION_COUNT }, (_, i) => i);

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
          const outside = candidates.clubs.filter((c: any) => c.country !== country);
          return q(i, {
            country,
            objective: `Pick the 3 clubs from ${country} (${i})`,
            correctClubIds: [inCountry[i].id, inCountry[i + 1].id, inCountry[i + 2].id],
            otherClubIds: outside.slice(i, i + 6).map((c: any) => c.id),
          });
        }),
      };
    case 'football-grid':
      return {
        questions: indexes.map((i) => {
          const player = candidates.players[i];
          const otherClubs = candidates.clubs.filter((c: any) => c.apiTeamId !== player.teamId).slice(0, 2);
          const otherNats = COUNTRIES.filter((n) => n !== player.nationality).slice(0, 2);
          return q(i, {
            targetPlayerId: player.id,
            otherClubIds: otherClubs.map((c: any) => c.id),
            otherNationalities: otherNats,
          });
        }),
      };
    case 'player-connections':
      return {
        questions: indexes.map((i) => {
          const group = candidates.teammateGroups[i];
          const others = candidates.clubs.filter((c: any) => c.id !== group.clubId).slice(i, i + 3);
          return q(i, {
            groupId: group.id,
            options: [
              { clubId: group.clubId, text: `They all play together (correct ${i})`, example: 'e.g.' },
              ...others.map((c: any, k: number) => ({
                clubId: c.id,
                text: `They all play together (wrong ${i}-${k})`,
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
          const used = new Set([transfer.finalStep.clubName, ...transfer.priorSteps.map((s: any) => s.clubName)]);
          const others = candidates.clubs.filter((c: any) => !used.has(c.name)).slice(i, i + 3);
          return q(i, {
            transferId: transfer.id,
            distractorClubIds: others.map((c: any) => c.id),
          });
        }),
      };
    case 'top10-challenge':
      return { questions: indexes.map((i) => q(i, { rankingId: candidates.rankings[i].id })) };
    default:
      return { questions: [] };
  }
}

/** Runs the generator with a per-mode reply factory. */
function wireAi(replyFor: (mode: string, candidates: any) => unknown, candidatesRef: { current: any }) {
  mockCallQuestionsAiJson.mockImplementation(async ({ label }: { label: string }) => {
    const mode = label.split(':')[0]!;
    const payload = replyFor(mode, candidatesRef.current);
    return payload === null ? null : { payload, model: 'test-model' };
  });
}

describe('questions-challenges AI generator', () => {
  const candidatesRef: { current: any } = { current: null };

  beforeEach(async () => {
    jest.clearAllMocks();
    mockIsQuestionsAiConfigured.mockReturnValue(true);
    mockIsConfigured.mockReturnValue(true);
    mockBuildQuizEntityDataset.mockResolvedValue({ ok: true, dataset: buildDataset() });
    mockGetTransfers.mockImplementation(async ({ player }: { player: number }) => transferRows(player));
    mockGetTopScorers.mockResolvedValue(topScorers());
    mockResolve365QuizPlayerImage.mockImplementation(async ({ entityName }: { entityName: string }) => ({
      athleteId: 1,
      name: entityName,
      clubName: null,
      imageUrl: `https://365.example.com/${encodeURIComponent(entityName)}.png`,
      score: 0.95,
    }));
    mockTranslateFootballNames.mockImplementation(async (texts: string[]) => {
      const out: Record<string, string> = {};
      for (const text of texts) out[text] = `AR:${text}`;
      return out;
    });

    candidatesRef.current = await buildQuestionsFootballCandidates('en', '2026-06-10');
  });

  /* ────────────── the AI request ────────────── */

  describe('AI request', () => {
    test('is sent once per playable mode, never to the chat pipeline', async () => {
      wireAi(goodReplyFor, candidatesRef);
      const result = await buildAiQuestionChallenges('en', '2026-06-10');

      expect(result).not.toBeNull();
      expect(mockCallQuestionsAiJson).toHaveBeenCalledTimes(AI_QUESTION_MODES.length);
      const labels = mockCallQuestionsAiJson.mock.calls.map((call) => call[0].label.split(':')[0]);
      expect(labels.sort()).toEqual([...AI_QUESTION_MODES].sort());
    });

    test('asks for exactly the round length and forbids inventing entities or images', () => {
      const system = buildQuestionsSystemPrompt('en');
      expect(system).toContain(`EXACTLY ${ROUND_QUESTION_COUNT} questions`);
      expect(system).toContain('never type an entity');
      expect(system).toContain('never return an image URL');
    });

    test('sends real candidate entities and only the pools that mode needs', () => {
      const user = buildQuestionsUserPrompt({
        mode: 'guess-player',
        language: 'en',
        refreshDate: '2026-06-10',
        candidates: candidatesRef.current,
      });

      expect(user).toContain(candidatesRef.current.players[0].id);
      expect(user).toContain('CANDIDATES');
      // guess-player has no use for transfer chains or scorer tables.
      expect(user).not.toContain('"transfers"');
      expect(user).not.toContain('"rankings"');
    });

    test('never leaks a resolved image URL into the prompt', () => {
      for (const mode of AI_QUESTION_MODES) {
        const user = buildQuestionsUserPrompt({
          mode,
          language: 'en',
          refreshDate: '2026-06-10',
          candidates: candidatesRef.current,
        });
        expect(user).not.toContain('https://365.example.com');
        expect(user).not.toContain('https://crests.example.com');
        expect(user).not.toContain('https://players.example.com');
      }
    });

    test('passes recent prompts through as things not to repeat', async () => {
      wireAi(goodReplyFor, candidatesRef);
      await buildAiQuestionChallenges('en', '2026-06-10', {
        avoidPromptsByMode: { 'guess-club': ['Which club was founded in 1902?'] },
      });

      const guessClubCall = mockCallQuestionsAiJson.mock.calls.find((call) =>
        call[0].label.startsWith('guess-club'),
      )!;
      expect(guessClubCall[0].user).toContain('Which club was founded in 1902?');
    });
  });

  /* ────────────── response parsing ────────────── */

  describe('AI response parsing', () => {
    test('reads the {questions:[…]} envelope', () => {
      expect(parseAiQuestionsPayload({ questions: [{ id: 'q1' }] })).toEqual({
        questions: [{ id: 'q1' }],
        insufficient: false,
      });
    });

    test('reports INSUFFICIENT_DATA without salvaging a partial round', () => {
      const parsed = parseAiQuestionsPayload({ questions: [], status: 'INSUFFICIENT_DATA' });
      expect(parsed).toEqual({ questions: [], insufficient: true });
    });

    test('drops non-object entries instead of throwing', () => {
      const parsed = parseAiQuestionsPayload({ questions: [null, 'nope', 7, { id: 'q1' }] as unknown[] });
      expect(parsed.questions).toEqual([{ id: 'q1' }]);
    });

    test('treats a missing or malformed payload as an empty round', () => {
      expect(parseAiQuestionsPayload(null).questions).toEqual([]);
      expect(parseAiQuestionsPayload({ nonsense: true }).questions).toEqual([]);
    });
  });

  /* ────────────── the happy path ────────────── */

  describe('a full round', () => {
    let rounds: GeneratedQuestionChallenge[];

    beforeEach(async () => {
      wireAi(goodReplyFor, candidatesRef);
      rounds = (await buildAiQuestionChallenges('en', '2026-06-10'))!;
      expect(rounds).not.toBeNull();
    });

    test('builds every playable mode', () => {
      expect(rounds.map((round) => round.mode).sort()).toEqual([...AI_QUESTION_MODES].sort());
    });

    test('gives every mode exactly six real questions', () => {
      for (const round of rounds) {
        expect(round.content.questions).toHaveLength(ROUND_QUESTION_COUNT);
        expect(validateRoundIntegrity(round)).toBe(true);
      }
    });

    test('never repeats a question or a subject within a round', () => {
      for (const round of rounds) {
        const prompts = round.content.questions!.map((question) => question.prompt);
        expect(new Set(prompts).size).toBe(prompts.length);
        const subjects = round.content
          .questions!.map((question) => question.entity?.id)
          .filter(Boolean);
        expect(new Set(subjects).size).toBe(subjects.length);
      }
    });

    test('is tagged as AI-authored, with the model recorded', () => {
      for (const round of rounds) {
        expect(round.metadata.source).toBe('AI');
        expect(round.metadata.model).toBe('test-model');
      }
    });

    test('records an answer for every question id', () => {
      for (const round of rounds) {
        for (const question of round.content.questions!) {
          expect(round.answer.byQuestionId?.[question.id]).toEqual(question.answer);
        }
      }
    });

    /* ── options and correct answers ── */

    test('option modes carry 4 unique options with exactly one correct id', () => {
      const optionModes = ['guess-player', 'guess-club', 'player-connections', 'transfer-puzzle'];
      for (const round of rounds.filter((entry) => optionModes.includes(entry.mode))) {
        for (const question of round.content.questions!) {
          expect(question.options).toHaveLength(4);
          expect(new Set(question.options!.map((option) => option.id)).size).toBe(4);
          expect(new Set(question.options!.map((option) => option.label)).size).toBe(4);
          expect(question.answer.correctIds).toHaveLength(1);
          expect(question.options!.map((option) => option.id)).toContain(question.answer.correctIds![0]);
        }
      }
    });

    test('does not park the correct answer in the same slot every time', () => {
      const guessPlayer = rounds.find((round) => round.mode === 'guess-player')!;
      const positions = guessPlayer.content.questions!.map((question) =>
        question.options!.findIndex((option) => option.id === question.answer.correctIds![0]),
      );
      expect(new Set(positions).size).toBeGreaterThan(1);
    });

    test('option labels are real entity names, not text the model wrote', () => {
      const guessClub = rounds.find((round) => round.mode === 'guess-club')!;
      const realNames = new Set(candidatesRef.current.clubs.map((club: any) => club.name));
      for (const question of guessClub.content.questions!) {
        for (const option of question.options!) {
          expect(realNames.has(option.label)).toBe(true);
        }
      }
    });

    /* ── images ── */

    test('guess-player shows the photo of the player who IS the answer', () => {
      const round = rounds.find((entry) => entry.mode === 'guess-player')!;
      for (const question of round.content.questions!) {
        expect(question.imageUrl).toMatch(/^https:\/\/365\.example\.com\//);
        const correctLabel = question.options!.find(
          (option) => option.id === question.answer.correctIds![0],
        )!.label;
        expect(decodeURIComponent(question.imageUrl!)).toContain(correctLabel);
        // The entity the picture was resolved for travels with it.
        expect(question.entity!.kind).toBe('player');
        expect(question.entity!.imageUrl).toBe(question.imageUrl);
        expect(question.entity!.name).toBe(correctLabel);
      }
    });

    test('guess-club shows the crest of the club that IS the answer', () => {
      const round = rounds.find((entry) => entry.mode === 'guess-club')!;
      const crestByName = new Map(
        candidatesRef.current.clubs.map((club: any) => [club.name, club.logoUrl]),
      );
      for (const question of round.content.questions!) {
        const correctLabel = question.options!.find(
          (option) => option.id === question.answer.correctIds![0],
        )!.label;
        expect(question.imageUrl).toBe(crestByName.get(correctLabel));
      }
    });

    test('every board cell, grid header, portrait, timeline step and ranked option has a real image', () => {
      const isRemote = (value: unknown) => typeof value === 'string' && /^https?:\/\//.test(value);

      const bingo = rounds.find((entry) => entry.mode === 'football-bingo')!;
      for (const question of bingo.content.questions!) {
        const cells = question.bingoBoard!.flat();
        expect(cells).toHaveLength(9);
        expect(cells.every((cell) => isRemote(cell.imageUrl) && cell.kind === 'club')).toBe(true);
      }

      const grid = rounds.find((entry) => entry.mode === 'football-grid')!;
      for (const question of grid.content.questions!) {
        expect(question.rowImages).toHaveLength(3);
        expect(question.rowImages!.every(isRemote)).toBe(true);
      }

      const connections = rounds.find((entry) => entry.mode === 'player-connections')!;
      for (const question of connections.content.questions!) {
        expect(question.players).toHaveLength(4);
        expect(question.players!.every((player) => isRemote(player.imageUrl))).toBe(true);
        // One portrait per player, never a shared placeholder.
        expect(new Set(question.players!.map((player) => player.imageUrl)).size).toBe(4);
      }

      const transfer = rounds.find((entry) => entry.mode === 'transfer-puzzle')!;
      for (const question of transfer.content.questions!) {
        const visible = question.transferTimeline!.filter((step) => !step.hidden);
        expect(visible.length).toBeGreaterThan(0);
        expect(visible.every((step) => isRemote(step.imageUrl))).toBe(true);
        expect(question.options!.every((option) => isRemote(option.imageUrl))).toBe(true);
      }

      const top10 = rounds.find((entry) => entry.mode === 'top10-challenge')!;
      for (const question of top10.content.questions!) {
        expect(question.options!.every((option) => isRemote(option.imageUrl))).toBe(true);
      }
    });

    test('top 10 keeps the real goal order, not one the model picked', () => {
      const round = rounds.find((entry) => entry.mode === 'top10-challenge')!;
      for (const question of round.content.questions!) {
        expect(question.answer.orderedIds).toEqual(['1', '2', '3']);
        expect(question.orderedAnswers!.map((item) => item.label)).toEqual(
          candidatesRef.current.rankings
            .find((ranking: any) => `league:${ranking.leagueId}` === question.entity!.id)!
            .rows.slice(0, 3)
            .map((row: any) => row.name),
        );
      }
    });

    test('XP is the sum of what the questions are worth, by difficulty', () => {
      for (const round of rounds) {
        const expected = round.content.questions!.reduce((total, question) => total + question.xpReward, 0);
        expect(round.xpReward).toBe(expected);
        expect(expected).toBeGreaterThan(0);
      }
    });

    test('sends no hub-card artwork, so cards keep their own illustration', () => {
      for (const round of rounds) {
        expect(round.image).toBe('');
      }
    });
  });

  /* ────────────── Arabic ────────────── */

  describe('Arabic rounds', () => {
    test('localizes entity names through the shared translator but keeps the real images', async () => {
      candidatesRef.current = await buildQuestionsFootballCandidates('ar', '2026-06-10');
      wireAi(goodReplyFor, candidatesRef);

      const rounds = (await buildAiQuestionChallenges('ar', '2026-06-10'))!;
      expect(rounds).not.toBeNull();
      expect(mockTranslateFootballNames).toHaveBeenCalled();

      const guessClub = rounds.find((round) => round.mode === 'guess-club')!;
      for (const question of guessClub.content.questions!) {
        expect(question.options!.every((option) => option.label.startsWith('AR:'))).toBe(true);
        // Translated label, untranslated (real) picture.
        expect(question.imageUrl).toMatch(/^https:\/\/crests\.example\.com\//);
      }

      const connections = rounds.find((round) => round.mode === 'player-connections')!;
      for (const question of connections.content.questions!) {
        expect(question.players!.every((player) => player.name.startsWith('AR:'))).toBe(true);
        expect(question.players!.every((player) => /^https?:\/\//.test(player.imageUrl!))).toBe(true);
      }
    });

    test('falls back to source names when the translator fails, keeping the round valid', async () => {
      mockTranslateFootballNames.mockRejectedValue(new Error('translator down'));
      candidatesRef.current = await buildQuestionsFootballCandidates('ar', '2026-06-10');
      wireAi(goodReplyFor, candidatesRef);

      const rounds = await buildAiQuestionChallenges('ar', '2026-06-10');
      expect(rounds).not.toBeNull();
      expect(rounds!.every(validateRoundIntegrity)).toBe(true);
    });
  });

  /* ────────────── refusals ────────────── */

  describe('a model that gets it wrong', () => {
    /** Breaks one field of one mode's reply and expects the whole day to fail. */
    async function expectRejected(mode: string, mutate: (questions: any[], candidates: any) => void) {
      wireAi((replyMode, candidates) => {
        const reply = goodReplyFor(replyMode, candidates) as { questions: any[] };
        if (replyMode === mode) mutate(reply.questions, candidates);
        return reply;
      }, candidatesRef);

      const result = await buildAiQuestionChallenges('en', '2026-06-10');
      expect(result).toBeNull();
    }

    test('rejects a player who is not in the candidates (a hallucinated name)', async () => {
      await expectRejected('guess-player', (questions) => {
        questions[0].targetPlayerId = 'player:999999';
      });
    });

    test('rejects a club option that is not in the candidates', async () => {
      await expectRejected('guess-club', (questions) => {
        questions[0].distractorClubIds[0] = 'team:999999';
      });
    });

    test('rejects a distractor that is also the correct answer', async () => {
      await expectRejected('guess-club', (questions) => {
        questions[0].distractorClubIds[0] = questions[0].targetClubId;
      });
    });

    test('rejects duplicate distractors', async () => {
      await expectRejected('guess-player', (questions) => {
        questions[0].distractorPlayerIds[1] = questions[0].distractorPlayerIds[0];
      });
    });

    test('rejects an option count that is not four', async () => {
      await expectRejected('guess-player', (questions) => {
        questions[0].distractorPlayerIds = questions[0].distractorPlayerIds.slice(0, 2);
      });
    });

    test('rejects a question below the confidence floor', async () => {
      await expectRejected('guess-player', (questions) => {
        questions[0].confidence = 40;
      });
    });

    test('rejects a question with no prompt', async () => {
      await expectRejected('guess-club', (questions) => {
        questions[0].prompt = '   ';
      });
    });

    test('rejects guess-player / guess-club with no evidence rows', async () => {
      await expectRejected('guess-club', (questions) => {
        questions[0].evidence = [];
      });
    });

    test('rejects a bingo objective that is not true of the cells it names', async () => {
      await expectRejected('football-bingo', (questions, candidates) => {
        // Swap in a club from a different country as a "correct" cell.
        const wrong = candidates.clubs.find((club: any) => club.country !== questions[0].country);
        questions[0].correctClubIds[0] = wrong.id;
      });
    });

    test('rejects a bingo card whose other cells also satisfy the objective', async () => {
      await expectRejected('football-bingo', (questions, candidates) => {
        const sameCountry = candidates.clubsByCountry[questions[0].country].find(
          (club: any) => !questions[0].correctClubIds.includes(club.id),
        );
        questions[0].otherClubIds[0] = sameCountry.id;
      });
    });

    test('rejects a grid nationality that no candidate player actually has', async () => {
      await expectRejected('football-grid', (questions) => {
        questions[0].otherNationalities[0] = 'Atlantis';
      });
    });

    test('rejects a grid whose distractor club is the target’s own club', async () => {
      await expectRejected('football-grid', (questions, candidates) => {
        const player = candidates.players.find((entry: any) => entry.id === questions[0].targetPlayerId);
        const ownClub = candidates.clubs.find((club: any) => club.apiTeamId === player.teamId);
        questions[0].otherClubIds[0] = ownClub.id;
      });
    });

    test('rejects a connections question with no true statement', async () => {
      await expectRejected('player-connections', (questions, candidates) => {
        const other = candidates.clubs.find((club: any) => club.id !== questions[0].options[0].clubId);
        questions[0].options[0].clubId = other.id;
      });
    });

    test('rejects a connections question with two true statements', async () => {
      await expectRejected('player-connections', (questions) => {
        questions[0].options[1].clubId = questions[0].options[0].clubId;
      });
    });

    test('rejects a transfer distractor that is the real destination', async () => {
      await expectRejected('transfer-puzzle', (questions, candidates) => {
        const transfer = candidates.transfers.find((entry: any) => entry.id === questions[0].transferId);
        const realClub = candidates.clubs.find((club: any) => club.name === transfer.finalStep.clubName);
        questions[0].distractorClubIds[0] = realClub.id;
      });
    });

    test('rejects a transfer distractor already visible earlier in the same chain', async () => {
      await expectRejected('transfer-puzzle', (questions, candidates) => {
        const transfer = candidates.transfers.find((entry: any) => entry.id === questions[0].transferId);
        const priorClub = candidates.clubs.find(
          (club: any) => club.name === transfer.priorSteps[0].clubName,
        );
        questions[0].distractorClubIds[0] = priorClub.id;
      });
    });

    test('rejects a round that reuses the same subject twice', async () => {
      await expectRejected('guess-player', (questions) => {
        questions[1].targetPlayerId = questions[0].targetPlayerId;
      });
    });

    test('rejects a short round rather than padding it', async () => {
      await expectRejected('guess-player', (questions) => {
        questions.splice(ROUND_QUESTION_COUNT - 1, 1);
      });
    });

    test('retries once before failing, and accepts a good second reply', async () => {
      let firstCall = true;
      mockCallQuestionsAiJson.mockImplementation(async ({ label }: { label: string }) => {
        const mode = label.split(':')[0]!;
        const reply = goodReplyFor(mode, candidatesRef.current) as { questions: any[] };
        if (mode === 'guess-player' && firstCall) {
          firstCall = false;
          reply.questions[0].confidence = 10;
        }
        return { payload: reply, model: 'test-model' };
      });

      const result = await buildAiQuestionChallenges('en', '2026-06-10');
      expect(result).not.toBeNull();
      expect(result!.find((round) => round.mode === 'guess-player')!.content.questions).toHaveLength(
        ROUND_QUESTION_COUNT,
      );
    });
  });

  /* ────────────── infrastructure failures ────────────── */

  describe('failures never become invented content', () => {
    test('returns null when no AI provider is configured', async () => {
      mockIsQuestionsAiConfigured.mockReturnValue(false);
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
      expect(mockCallQuestionsAiJson).not.toHaveBeenCalled();
    });

    test('returns null when the AI is unreachable', async () => {
      mockCallQuestionsAiJson.mockResolvedValue(null);
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('returns null on an empty AI response', async () => {
      mockCallQuestionsAiJson.mockResolvedValue({ payload: { questions: [] }, model: 'm' });
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('returns null when the AI reports INSUFFICIENT_DATA', async () => {
      mockCallQuestionsAiJson.mockResolvedValue({
        payload: { questions: [], status: 'INSUFFICIENT_DATA' },
        model: 'm',
      });
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('survives a malformed AI response without throwing', async () => {
      mockCallQuestionsAiJson.mockResolvedValue({
        payload: { questions: [{ nonsense: true }, null, 'text'] as unknown[] },
        model: 'm',
      });
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('returns null when the football entity dataset is too thin', async () => {
      mockBuildQuizEntityDataset.mockResolvedValue({
        ok: false,
        reason: 'INSUFFICIENT_DATA',
        counts: { players: 0, clubs: 0, stadiums: 0 },
      });
      wireAi(goodReplyFor, candidatesRef);
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('returns null when no player photo can be resolved', async () => {
      mockResolve365QuizPlayerImage.mockResolvedValue(null);
      candidatesRef.current = await buildQuestionsFootballCandidates('en', '2026-06-10');
      wireAi(goodReplyFor, candidatesRef);
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('drops a photo whose 365 match is too weak to trust', async () => {
      mockResolve365QuizPlayerImage.mockResolvedValue({
        athleteId: 9,
        name: 'Someone Else',
        clubName: null,
        imageUrl: 'https://365.example.com/someone-else.png',
        score: 0.3,
      });
      const candidates = await buildQuestionsFootballCandidates('en', '2026-06-10');
      expect(candidates!.players).toHaveLength(0);
    });

    test('survives a football API outage without throwing', async () => {
      mockGetTransfers.mockRejectedValue(new Error('ECONNRESET'));
      mockGetTopScorers.mockRejectedValue(new Error('ECONNRESET'));
      candidatesRef.current = await buildQuestionsFootballCandidates('en', '2026-06-10');
      expect(candidatesRef.current.transfers).toHaveLength(0);
      expect(candidatesRef.current.rankings).toHaveLength(0);

      wireAi(goodReplyFor, candidatesRef);
      await expect(buildAiQuestionChallenges('en', '2026-06-10')).resolves.toBeNull();
    });

    test('refuses a ranking whose top three are tied — no single right order', async () => {
      mockGetTopScorers.mockResolvedValue(
        Array.from({ length: 6 }, (_, i) => ({
          player: { name: `Scorer ${i}`, photo: `https://players.example.com/${i}.png` },
          statistics: [{ goals: { total: 10 } }],
        })),
      );
      const candidates = await buildQuestionsFootballCandidates('en', '2026-06-10');
      expect(candidates!.rankings).toHaveLength(0);
    });

    test('drops scorers the feed returned without a photo', async () => {
      mockGetTopScorers.mockResolvedValue(
        Array.from({ length: 6 }, (_, i) => ({
          player: { name: `Scorer ${i}` },
          statistics: [{ goals: { total: 30 - i * 2 } }],
        })),
      );
      const candidates = await buildQuestionsFootballCandidates('en', '2026-06-10');
      expect(candidates!.rankings).toHaveLength(0);
    });

    test('drops transfer rows that carry no club crest', async () => {
      mockGetTransfers.mockResolvedValue([
        {
          player: { id: 1 },
          transfers: [
            { date: '2019-07-01', teams: { in: { name: 'Club 5' } } },
            { date: '2022-07-01', teams: { in: { name: 'Club 7' } } },
          ],
        },
      ]);
      const candidates = await buildQuestionsFootballCandidates('en', '2026-06-10');
      expect(candidates!.transfers).toHaveLength(0);
    });
  });

  test('is deterministic for the same day and language', async () => {
    wireAi(goodReplyFor, candidatesRef);
    const first = await buildAiQuestionChallenges('en', '2026-06-10');
    const second = await buildAiQuestionChallenges('en', '2026-06-10');

    expect(JSON.stringify(first!.map((round) => round.content))).toEqual(
      JSON.stringify(second!.map((round) => round.content)),
    );
  });
});

/* ────────────── the integrity guard on its own ────────────── */

describe('validateQuestionIntegrity', () => {
  function mcq(overrides: Partial<QuestionChallengeQuestion> = {}): QuestionChallengeQuestion {
    return {
      id: 'q1',
      difficulty: 'EASY',
      xpReward: 10,
      prompt: 'Who is this player?',
      imageUrl: 'https://365.example.com/player-a.png',
      entity: {
        kind: 'player',
        id: 'player:1',
        name: 'Player A',
        imageUrl: 'https://365.example.com/player-a.png',
      },
      evidence: [{ id: 'e1', text: 'Plays in England', label: 'Country', value: 'England' }],
      options: [
        { id: 'a', label: 'Player A' },
        { id: 'b', label: 'Player B' },
        { id: 'c', label: 'Player C' },
        { id: 'd', label: 'Player D' },
      ],
      answer: { correctIds: ['a'] },
      ...overrides,
    };
  }

  test('accepts a well-formed guess-player question', () => {
    expect(validateQuestionIntegrity('guess-player', mcq())).toBe(true);
  });

  test('rejects a missing hero image — the picture IS the question', () => {
    expect(validateQuestionIntegrity('guess-player', mcq({ imageUrl: undefined }))).toBe(false);
  });

  test('rejects a hero image that does not belong to the recorded entity', () => {
    const question = mcq();
    question.entity!.imageUrl = 'https://365.example.com/somebody-else.png';
    expect(validateQuestionIntegrity('guess-player', question)).toBe(false);
  });

  test('rejects duplicate option labels', () => {
    const question = mcq();
    question.options![1]!.label = 'Player A';
    expect(validateQuestionIntegrity('guess-player', question)).toBe(false);
  });

  test('rejects duplicate option ids', () => {
    const question = mcq();
    question.options![1]!.id = 'a';
    expect(validateQuestionIntegrity('guess-player', question)).toBe(false);
  });

  test('rejects a correct id that is not one of the options', () => {
    expect(validateQuestionIntegrity('guess-player', mcq({ answer: { correctIds: ['z'] } }))).toBe(false);
  });

  test('rejects an empty answer', () => {
    expect(validateQuestionIntegrity('guess-player', mcq({ answer: { correctIds: [] } }))).toBe(false);
  });

  test('rejects a bingo board with a correct id that is not on it', () => {
    const board = Array.from({ length: 3 }, (_, row) =>
      Array.from({ length: 3 }, (_, col) => ({
        id: `r${row}-c${col}`,
        label: `Club ${row * 3 + col}`,
        imageUrl: `https://crests.example.com/${row * 3 + col}.png`,
        kind: 'club' as const,
      })),
    );
    const question = mcq({
      bingoBoard: board,
      answer: { correctIds: ['r0-c0', 'r1-c1', 'r9-c9'] },
    });
    expect(validateQuestionIntegrity('football-bingo', question)).toBe(false);
  });

  test('rejects a grid answer outside the 3x3 range', () => {
    const question = mcq({
      rows: ['A', 'B', 'C'],
      columns: ['X', 'Y', 'Z'],
      rowImages: [
        'https://crests.example.com/1.png',
        'https://crests.example.com/2.png',
        'https://crests.example.com/3.png',
      ],
      answer: { correctIds: ['r5-c2'] },
    });
    expect(validateQuestionIntegrity('football-grid', question)).toBe(false);
  });

  test('rejects transfer options that do not all carry a crest', () => {
    const question = mcq({
      transferTimeline: [
        { id: 't1', label: 'Club 3', imageUrl: 'https://crests.example.com/3.png' },
        { id: 't2', label: '?', hidden: true },
      ],
      options: [
        { id: 'a', label: 'Club 7', imageUrl: 'https://crests.example.com/7.png' },
        { id: 'b', label: 'Club 8' },
        { id: 'c', label: 'Club 9', imageUrl: 'https://crests.example.com/9.png' },
        { id: 'd', label: 'Club 10', imageUrl: 'https://crests.example.com/10.png' },
      ],
      answer: { correctIds: ['a'] },
    });
    expect(validateQuestionIntegrity('transfer-puzzle', question)).toBe(false);
  });

  test('rejects connections portraits that reuse one image', () => {
    const shared = 'https://365.example.com/shared.png';
    const question = mcq({
      players: [
        { id: 'p1', name: 'A', imageUrl: shared },
        { id: 'p2', name: 'B', imageUrl: shared },
        { id: 'p3', name: 'C', imageUrl: 'https://365.example.com/c.png' },
        { id: 'p4', name: 'D', imageUrl: 'https://365.example.com/d.png' },
      ],
    });
    expect(validateQuestionIntegrity('player-connections', question)).toBe(false);
  });
});
