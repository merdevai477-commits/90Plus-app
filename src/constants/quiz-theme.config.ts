/**
 * Quiz campaign themes — extend QUIZ_THEME_CAMPAIGNS for EURO, AFCON, etc.
 * Switch behavior via env only: QUIZ_THEME=DEFAULT | WORLD_CUP | ...
 */

import type { QuizQuestionType } from '../types/quiz.types';
import { QuizTheme } from '../types/quiz-theme.types';
import { logger } from '../utils/logger';

export interface QuizThemeCampaign {
  id: QuizTheme;
  topicFocus: string;
  /** Injected into the system prompt when this campaign is active. */
  systemPromptBlock: string;
  /** Short line appended to the user prompt. */
  userPromptLine: string;
  allowedTypes: readonly QuizQuestionType[];
  typeTargets: Readonly<Record<QuizQuestionType, number>>;
  avoidTopics: readonly string[];
}

const DEFAULT_TYPE_TARGETS: Record<QuizQuestionType, number> = {
  normal: 3,
  guess_player: 3,
  logo: 3,
  stadium: 3,
  image: 3,
};

const WORLD_CUP_TYPE_TARGETS: Record<QuizQuestionType, number> = {
  normal: 8,
  image: 4,
  guess_player: 3,
  logo: 0,
  stadium: 0,
};

const WORLD_CUP_CAMPAIGN: QuizThemeCampaign = {
  id: QuizTheme.WORLD_CUP,
  topicFocus:
    'FIFA World Cup history — winners, historic matches, famous goals, records, Golden Boot and Golden Ball winners, national teams, World Cup stadiums and hosts, tournament statistics, and memorable moments',
  systemPromptBlock: `## CAMPAIGN THEME: FIFA WORLD CUP
Generate only FIFA World Cup related questions.
100% of questions MUST be about FIFA World Cup history.

Topics may include: World Cup winners, historic matches, famous World Cup goals, records, Golden Boot winners, Golden Ball winners, national teams, stadiums used in World Cups, World Cup hosts, World Cup statistics, memorable World Cup moments.

Allowed question types ONLY: normal, image, guess_player.
Do NOT use logo or stadium question types.

AVOID unless directly tied to World Cup history:
- club football and current club squads
- domestic leagues and cups
- Champions League and Europa League
- transfer market or current form

When dataset entities are club players, frame questions around their national-team or World Cup career — never club-only trivia.

The dataset includes a "nations" array — use nation names from it for national-team MCQ options (winners, hosts, finalists).
For normal questions about countries, all four options MUST be exact nation names from the nations list (English or Arabic alias).
NEVER use numbers, years, shirt numbers, positions, or phrases as option text — only entity names from the dataset.
For guess_player: include nationality + position + age when available, and reference World Cup context in the question.`,
  userPromptLine: 'Generate only FIFA World Cup related questions.',
  allowedTypes: ['normal', 'image', 'guess_player'],
  typeTargets: WORLD_CUP_TYPE_TARGETS,
  avoidTopics: [
    'club football',
    'league football',
    'domestic competitions',
    'Champions League',
    'Europa League',
    'current club squads',
  ],
};

/** Campaign definitions. Themes without an entry behave like DEFAULT. */
export const QUIZ_THEME_CAMPAIGNS: Partial<Record<QuizTheme, QuizThemeCampaign>> = {
  [QuizTheme.WORLD_CUP]: WORLD_CUP_CAMPAIGN,
};

const THEME_ENV_ALIASES: Record<string, QuizTheme> = {
  DEFAULT: QuizTheme.DEFAULT,
  WORLD_CUP: QuizTheme.WORLD_CUP,
  WORLD_CUP_MODE: QuizTheme.WORLD_CUP,
  EURO: QuizTheme.EURO,
  EURO_MODE: QuizTheme.EURO,
  AFCON: QuizTheme.AFCON,
  AFCON_MODE: QuizTheme.AFCON,
  CHAMPIONS_LEAGUE: QuizTheme.CHAMPIONS_LEAGUE,
  CHAMPIONS_LEAGUE_MODE: QuizTheme.CHAMPIONS_LEAGUE,
};

/** Read QUIZ_THEME from env (default DEFAULT). Unknown values log a warning and fall back. */
export function resolveQuizTheme(env: NodeJS.ProcessEnv = process.env): QuizTheme {
  const raw = (env.QUIZ_THEME ?? 'DEFAULT').trim().toUpperCase();
  const theme = THEME_ENV_ALIASES[raw];
  if (theme) return theme;
  if (raw !== 'DEFAULT') {
    logger.warn(`[QuizTheme] Unknown QUIZ_THEME="${raw}" — using DEFAULT`);
  }
  return QuizTheme.DEFAULT;
}

export function getQuizThemeCampaign(theme: QuizTheme): QuizThemeCampaign | null {
  return QUIZ_THEME_CAMPAIGNS[theme] ?? null;
}

export function getDefaultTypeTargets(): Readonly<Record<QuizQuestionType, number>> {
  return DEFAULT_TYPE_TARGETS;
}

export function resolveTopicFocus(
  theme: QuizTheme,
  dailyTopic: string,
): string {
  const campaign = getQuizThemeCampaign(theme);
  return campaign?.topicFocus ?? dailyTopic;
}
