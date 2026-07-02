/**
 * Quiz campaign themes — extend QUIZ_THEME_CAMPAIGNS for EURO, AFCON, etc.
 * Switch behavior via env only: QUIZ_THEME=DEFAULT | WORLD_CUP | ...
 */

import type { QuizQuestionType } from '../types/quiz.types';
import { QuizTheme } from '../types/quiz-theme.types';
import { logger } from '../utils/logger';
import { getWorldCupTabState } from '../services/app-features.service';

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
    'FIFA World Cup 2026 (currently ongoing, hosted by the United States, Canada and Mexico — the first 48-team edition) and FIFA World Cup history — participating nations, hosts, winners, historic matches, famous goals, records, Golden Boot and Golden Ball winners, national-team stars, and memorable tournament moments',
  systemPromptBlock: `## CAMPAIGN THEME: FIFA WORLD CUP (2026 EDITION ONGOING)
Generate ONLY FIFA World Cup related questions. The World Cup 2026 is happening NOW.

Current-edition facts you may rely on (all widely established, stable facts):
- FIFA World Cup 2026 is co-hosted by the United States, Canada and Mexico.
- It is the first World Cup with 48 teams.
Prefer a healthy mix: some questions about the CURRENT World Cup 2026 (hosts, participating nations, format) and some about World Cup history (winners, legendary players, records, iconic moments).

Allowed question types ONLY: normal, image, guess_player.
Do NOT use logo or stadium question types.

AVOID unless directly tied to the World Cup:
- club football and current club squads
- domestic leagues and cups
- Champions League and Europa League
- transfer market or club current form

When dataset entities are club players, frame questions around their national-team or World Cup career — never club-only trivia.

The dataset includes a "nations" array — use nation names from it for national-team MCQ options (hosts, participants, winners, finalists).
For normal questions about countries, all four options MUST be exact nation names from the nations list (English or Arabic alias).
NEVER use numbers, years, shirt numbers, positions, or phrases as option text — only entity names from the dataset.
Do NOT ask about live 2026 scores, current standings, or which team is "leading now" — those change during the tournament and are not in the dataset.
For guess_player: include nationality + position + age when available, and reference World Cup context in the question.`,
  userPromptLine:
    'Generate only FIFA World Cup questions — mix the ongoing World Cup 2026 (hosts USA/Canada/Mexico, participating nations) with World Cup history. Do not ask about live scores or current standings.',
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

/**
 * Resolve the active quiz theme.
 *
 * Priority:
 *  1. Explicit QUIZ_THEME env value (operator override — always wins).
 *  2. Auto WORLD_CUP when the app is in World Cup campaign mode (so the daily
 *     quiz follows the app-wide World Cup takeover without extra config).
 *  3. DEFAULT.
 *
 * Unknown QUIZ_THEME values log a warning and fall through to campaign/default.
 */
export function resolveQuizTheme(env: NodeJS.ProcessEnv = process.env): QuizTheme {
  const rawEnv = env.QUIZ_THEME?.trim();
  if (rawEnv) {
    const raw = rawEnv.toUpperCase();
    const theme = THEME_ENV_ALIASES[raw];
    if (theme) return theme;
    if (raw !== 'DEFAULT') {
      logger.warn(`[QuizTheme] Unknown QUIZ_THEME="${raw}" — falling back to campaign/default`);
    } else {
      return QuizTheme.DEFAULT;
    }
  }

  try {
    if (getWorldCupTabState().campaignMode) {
      return QuizTheme.WORLD_CUP;
    }
  } catch {
    // World Cup state unavailable — fall through to DEFAULT.
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
