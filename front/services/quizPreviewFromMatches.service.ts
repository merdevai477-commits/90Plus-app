/**
 * Quiz preview from API-Football v3 (api-sports.io) via Railway proxy.
 * Server uses FOOTBALL_API_KEY from root .env — the app never calls api-sports directly.
 * GET /api/football/cached/matches/:date → logos; GET /api/football/venues/:id → stadium (wide).
 */

import {
  ApiFootballService,
  type Fixture,
  MAJOR_LEAGUES,
} from './apiFootball';
import { ApiFootballDirectService } from './apiFootballDirect.service';
import { getQuizConfig } from '../config/env';
import {
  OPTION_KEYS,
  type OptionKey,
  type QuizImageLayout,
  type QuizQuestionData,
} from '../components/Quiz/quiz.constants';
import { logger } from './logger';

function ymd(d: Date): string {
  return d.toISOString().split('T')[0];
}

function datesToTry(): string[] {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return [ymd(today), ymd(yesterday), ymd(tomorrow)];
}

async function fetchFixturesForQuiz(
  viaDirect: boolean,
): Promise<{ fixtures: Fixture[]; date: string }> {
  for (const date of datesToTry()) {
    const fixtures = viaDirect
      ? await ApiFootballDirectService.getFixturesByDate(date)
      : await ApiFootballService.getFixtures({ date });
    const withLogos = fixtures.filter(
      (f) =>
        isValidLogo(f.teams?.home?.logo) &&
        isValidLogo(f.teams?.away?.logo) &&
        f.teams.home.name &&
        f.teams.away.name,
    );
    if (withLogos.length >= 4) {
      return { fixtures, date };
    }
    logger.info('[QuizPreview] Only', withLogos.length, 'matches on', date);
  }
  throw new Error('[QuizPreview] No date with enough matches (tried 3 days)');
}

function shuffle<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function buildOptions(
  correct: string,
  namePool: string[],
): QuizQuestionData['options'] {
  const distractors = shuffle(
    namePool.filter((n) => n !== correct),
  ).slice(0, 3);
  const texts = shuffle([correct, ...distractors]);
  return texts.map((text, i) => ({
    key: OPTION_KEYS[i],
    text,
  }));
}

function isValidLogo(url?: string | null): boolean {
  return Boolean(url?.trim().startsWith('http'));
}

function rankFixture(f: Fixture): number {
  const majorIds = Object.values(MAJOR_LEAGUES) as number[];
  return majorIds.includes(f.league.id) ? 0 : 1;
}

/**
 * Fetches today's cached matches and maps up to `limit` preview questions.
 * Throws if the API returns too few matches with logos.
 */
export async function buildQuizPreviewFromMatches(
  limit = 6,
): Promise<QuizQuestionData[]> {
  const { useDirectApi } = getQuizConfig();
  const viaDirect = useDirectApi && ApiFootballDirectService.isEnabled();
  logger.info(
    '[QuizPreview] Loading matches',
    viaDirect ? '(direct api-sports)' : '(Railway proxy)',
  );

  const { fixtures, date } = await fetchFixturesForQuiz(viaDirect);
  const eligible = fixtures
    .filter(
      (f) =>
        isValidLogo(f.teams?.home?.logo) &&
        isValidLogo(f.teams?.away?.logo) &&
        f.teams.home.name &&
        f.teams.away.name,
    )
    .sort((a, b) => rankFixture(a) - rankFixture(b));

  if (eligible.length < 4) {
    throw new Error(
      `[QuizPreview] Need at least 4 matches with logos on ${date}, got ${eligible.length}`,
    );
  }

  const pool = eligible.slice(0, 40);
  const teamNames = pool.flatMap((f) => [
    f.teams.home.name,
    f.teams.away.name,
  ]);
  const leagueNames = [...new Set(pool.map((f) => f.league.name))];

  const questions: QuizQuestionData[] = [];

  const pushHomeTeam = (f: Fixture, layout: QuizImageLayout = 'square') => {
    const correct = f.teams.home.name;
    questions.push({
      id: `m-${f.fixture.id}-home`,
      question: `Who is the home team in this match?\n${f.teams.away.name} (away) · ${f.league.name}`,
      imageUrl: f.teams.home.logo,
      imageLayout: layout,
      difficulty: 'Easy',
      options: buildOptions(correct, teamNames),
    });
  };

  const pushLeague = (f: Fixture) => {
    const correct = f.league.name;
    questions.push({
      id: `m-${f.fixture.id}-league`,
      question: 'Which competition is this fixture from?',
      imageUrl: f.league.logo,
      imageLayout: 'square',
      difficulty: 'Medium',
      options: buildOptions(correct, leagueNames),
    });
  };

  const pushAwayTeam = (f: Fixture) => {
    const correct = f.teams.away.name;
    questions.push({
      id: `m-${f.fixture.id}-away`,
      question: `Who is the away team?\n${f.teams.home.name} (home) · ${f.league.name}`,
      imageUrl: f.teams.away.logo,
      imageLayout: 'square',
      difficulty: 'Easy',
      options: buildOptions(correct, teamNames),
    });
  };

  const venueNamePool = [
    ...new Set(
      pool
        .map((f) => f.fixture.venue?.name)
        .filter((n): n is string => Boolean(n?.trim())),
    ),
  ];

  const tryAddStadiumQuestion = async () => {
    if (venueNamePool.length < 4 || questions.length >= limit) return;
    for (const f of pool) {
      const venueId = f.fixture.venue?.id;
      if (!venueId) continue;
      try {
        const venue = viaDirect
          ? await ApiFootballDirectService.getVenueInfo(venueId)
          : await ApiFootballService.getVenueInfo(venueId);
        const correct = venue?.name || f.fixture.venue?.name;
        if (!correct || !isValidLogo(venue?.image)) continue;
        questions.push({
          id: `m-${f.fixture.id}-venue`,
          question: `In which stadium is this match played?\n${f.teams.home.name} vs ${f.teams.away.name}`,
          imageUrl: venue!.image,
          imageLayout: 'wide',
          difficulty: 'Hard',
          options: buildOptions(correct, venueNamePool),
        });
        return;
      } catch {
        continue;
      }
    }
  };

  pushHomeTeam(pool[0]);
  if (pool[1]) pushLeague(pool[1]);
  await tryAddStadiumQuestion();
  if (pool[2]) pushAwayTeam(pool[2]);

  for (let i = 3; i < pool.length && questions.length < limit; i++) {
    const f = pool[i];
    if (i % 3 === 0) pushHomeTeam(f);
    else if (i % 3 === 1) pushLeague(f);
    else pushAwayTeam(f);
  }

  logger.info('[QuizPreview] Built', questions.length, 'questions from matches API');
  return questions.slice(0, limit);
}
