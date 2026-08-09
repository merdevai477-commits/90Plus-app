import { getApiUrl } from '../config/api.config';
import { safeJsonParse } from '../utils/safeJsonParse';
import type { Language } from '../src/i18n';

export type QuestionModeId =
  | 'guess-player'
  | 'football-bingo'
  | 'football-grid'
  | 'player-connections'
  | 'guess-club'
  | 'transfer-puzzle'
  | 'top10-challenge'
  | 'football-quiz';

export type QuestionModeQuestionType =
  | 'mcq'
  | 'bingo'
  | 'grid'
  | 'connections'
  | 'transfer'
  | 'top10';

export interface QuestionOption {
  id: string;
  label: string;
  imageUrl?: string;
  badge?: string;
  /**
   * Muted second line under the option label — Figma 285:1807
   * ("مثال: زملاء في مانشستر سيتي"). Player Connections uses it to illustrate
   * each relationship; other modes leave it empty and render a single line.
   */
  example?: string;
}

/**
 * One clue row in the "Evidence" section.
 *
 * Two shapes, both drawn in Figma:
 *  • Guess The Player (231:73) — a single sentence in `text`.
 *  • Guess The Club (233:299)  — a `label` on the icon side and its `value` on
 *    the opposite side ("Founded" … "1899").
 */
export interface QuestionEvidence {
  id: string;
  text: string;
  label?: string;
  value?: string;
  icon?: string;
}

export interface QuestionModeQuestion {
  id: string;
  type: QuestionModeQuestionType;
  title: string;
  subtitle?: string;
  prompt: string;
  imageUrl?: string;
  options?: QuestionOption[];
  board?: {
    id: string;
    label?: string;
    imageUrl?: string;
    /**
     * What `label` names — lets the board pick a themed glyph (club shield,
     * player silhouette, flag, stadium) for a cell whose `imageUrl` didn't
     * resolve, instead of leaving the artwork area empty.
     */
    kind?: 'club' | 'player' | 'country' | 'stadium';
  }[][];
  rowHeaders?: string[];
  colHeaders?: string[];
  /**
   * Crest/flag per Football Grid header, aligned index-for-index with
   * `rowHeaders` / `colHeaders`. Resolved from the English header name so the
   * artwork is the same in both languages.
   */
  rowHeaderImages?: (string | undefined)[];
  colHeaderImages?: (string | undefined)[];
  connectionPlayers?: Array<{ id: string; name: string; imageUrl: string }>;
  transferChain?: Array<{ id: string; label: string; imageUrl?: string; unknown?: boolean }>;
  rankingItems?: Array<{ id: string; label: string; imageUrl?: string }>;
  correctAnswers: string[];
  hint?: string;
  xpReward?: number;
  /** Evidence/clues shown in guess-club / guess-player mode. */
  evidence?: QuestionEvidence[];
  /**
   * The real football entity this question's artwork belongs to, as resolved
   * server-side. Present so a picture can be traced back to the entity it was
   * looked up for — it is never used to look anything up on the client.
   */
  entity?: { kind: string; id: string; name: string; imageUrl?: string };
}

export interface QuestionModeSummary {
  id: QuestionModeId;
  title: string;
  subtitle: string;
  xpReward: number;
  totalQuestions: number;
  icon: string;
  previewImage: string;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  refreshTime: string;
  completionState: 'locked' | 'available' | 'completed';
  completionPercentage: number;
  unlockState: boolean;
  streakContribution: boolean;
  leaderboardEligibility: boolean;
}

export interface QuestionModeCatalogItem {
  id: QuestionModeId;
  title: string;
  subtitle: string;
  icon: string;
}

export const QUESTION_MODE_CATALOG: QuestionModeCatalogItem[] = [
  { id: 'guess-player', title: 'Guess The Player', subtitle: 'خمن اللاعب', icon: 'user' },
  { id: 'football-bingo', title: 'Football Bingo', subtitle: 'بينجو كرة القدم', icon: 'grid-3x3' },
  { id: 'football-grid', title: 'Football Grid', subtitle: 'شبكة كرة القدم', icon: 'table' },
  { id: 'player-connections', title: 'Player connections', subtitle: 'ربط اللاعبين', icon: 'git-branch' },
  { id: 'guess-club', title: 'Guess The Club', subtitle: 'خمن النادي', icon: 'shield' },
  { id: 'transfer-puzzle', title: 'Transfer Puzzle', subtitle: 'ألغاز الانتقالات', icon: 'shuffle' },
  { id: 'top10-challenge', title: 'Top 10 Challenge', subtitle: 'تحدي أفضل 10', icon: 'list-ordered' },
  { id: 'football-quiz', title: 'Football Quiz', subtitle: 'أسئلة كرة القدم', icon: 'circle-help' },
];

export interface QuestionModeSession {
  sessionId: string;
  mode: QuestionModeSummary;
  currentIndex: number;
  totalQuestions: number;
  timeLimitSec: number;
  questions: QuestionModeQuestion[];
}

/**
 * "Ask the crowd" — how other players actually answered this question.
 * `available` is false until enough real submissions exist; the screen then
 * keeps the lifeline locked instead of showing an invented split.
 */
export interface QuestionCrowdStats {
  challengeId: string;
  questionId: string;
  available: boolean;
  sampleSize: number;
  percentages: Record<string, number>;
}

export interface SubmitQuestionModeAnswerResult {
  questionId?: string;
  isCorrect: boolean;
  completionPercentage: number;
  completed: boolean;
  score: number;
  attempts: number;
  elapsedTime: number;
  xpEarned: number;
  totalXpAwarded: number;
  answer: {
    correctIds?: string[];
    acceptedIds?: string[];
    orderedIds?: string[];
  };
  hint?: string | null;
}

/**
 * Real counters for the hub's stats strip, computed by the backend from this
 * user's own answer rows and today's published challenges.
 */
export interface QuestionsModesSummary {
  answeredCount: number;
  xpEarnedTotal: number;
  xpAvailableToday: number;
}

export interface QuestionsModesResult {
  modes: QuestionModeSummary[];
  summary: QuestionsModesSummary | null;
}

interface QuestionsModesResponse {
  status: string;
  data?: {
    refreshDate: string;
    summary?: {
      answeredCount?: number;
      xpEarnedTotal?: number;
      xpAvailableToday?: number;
    };
    modes: Array<{
      id: string;
      type: QuestionModeId;
      title: string;
      description: string;
      image: string;
      icon: string;
      difficulty: 'EASY' | 'MEDIUM' | 'HARD';
      xpReward: number;
      refreshTime: string;
      completionState: 'locked' | 'available' | 'completed';
      completionPercentage: number;
      unlockState: boolean;
      streakContribution: boolean;
      leaderboardEligibility: boolean;
    }>;
  };
}

interface QuestionModeSessionResponse {
  status: string;
  data?: {
    challengeId: string;
    type: QuestionModeId;
    title: string;
    description: string;
    image: string;
    icon: string;
    difficulty: 'EASY' | 'MEDIUM' | 'HARD';
    xpReward: number;
    refreshDate: string;
    refreshTime: string;
    completionState: 'locked' | 'available' | 'completed';
    completionPercentage: number;
    unlockState: boolean;
    streakContribution: boolean;
    leaderboardEligibility: boolean;
    content: Record<string, any>;
    answer?: {
      correctIds?: string[];
      acceptedIds?: string[];
      orderedIds?: string[];
    };
    attempts: number;
    completed: boolean;
    score: number;
    elapsedTime: number;
  };
}

function normalizeLanguage(lang: Language): 'ar' | 'en' {
  return lang === 'en' ? 'en' : 'ar';
}

async function authFetch(path: string, token: string, init?: RequestInit): Promise<Response> {
  return fetch(`${getApiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init?.headers ?? {}),
    },
  });
}

function makeModeSummary(
  session: QuestionModeSessionResponse['data'],
  totalQuestions: number,
): QuestionModeSummary {
  return {
    id: session?.type ?? 'guess-player',
    title: session?.title ?? '',
    subtitle: session?.description ?? '',
    xpReward: session?.xpReward ?? 0,
    totalQuestions,
    icon: session?.icon ?? 'circle-help',
    previewImage: session?.image ?? '',
    difficulty: session?.difficulty ?? 'MEDIUM',
    refreshTime: session?.refreshTime ?? '00:00',
    completionState: session?.completionState ?? 'available',
    completionPercentage: session?.completionPercentage ?? 0,
    unlockState: session?.unlockState ?? true,
    streakContribution: session?.streakContribution ?? true,
    leaderboardEligibility: session?.leaderboardEligibility ?? true,
  };
}

const QUESTION_TYPE_BY_MODE: Record<QuestionModeId, QuestionModeQuestionType> = {
  'guess-player': 'mcq',
  'guess-club': 'mcq',
  'football-quiz': 'mcq',
  'football-bingo': 'bingo',
  'football-grid': 'grid',
  'player-connections': 'connections',
  'transfer-puzzle': 'transfer',
  'top10-challenge': 'top10',
};

function mapOptions(raw: unknown): QuestionOption[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((option: any) => ({
      id: String(option?.id ?? ''),
      label: String(option?.label ?? ''),
      // Straight through from the server, which resolved it for the entity this
      // option names. Nothing is looked up from the label on the client.
      imageUrl: typeof option?.imageUrl === 'string' ? option.imageUrl : undefined,
      badge: typeof option?.badge === 'string' ? option.badge : undefined,
      example: typeof option?.example === 'string' ? option.example : undefined,
    }))
    .filter((option) => option.id !== '');
}

function mapEvidence(raw: unknown): QuestionEvidence[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  return raw.map((entry: any, index: number) => ({
    id: String(entry?.id ?? `e${index + 1}`),
    text: String(entry?.text ?? entry?.label ?? ''),
    label: typeof entry?.label === 'string' ? entry.label : undefined,
    value: typeof entry?.value === 'string' ? entry.value : undefined,
    icon: typeof entry?.icon === 'string' ? entry.icon : undefined,
  }));
}

function optionalImage(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

/**
 * ONE question of a round → the shape the screen renders.
 *
 * Every image field is copied straight across from the server payload. The
 * question's own `imageUrl` is authoritative for the hero frame: it was
 * resolved against the football entity the question is about (365Scores
 * portrait / API-Football crest), so it is the only picture that can honestly
 * sit above that prompt.
 */
function mapRoundQuestion(
  mode: QuestionModeId,
  raw: any,
  index: number,
  fallbackTitle: string,
): QuestionModeQuestion {
  const answer = raw?.answer ?? {};
  const ordered = Array.isArray(answer.orderedIds) ? answer.orderedIds.map(String) : [];
  const correctIds = Array.isArray(answer.correctIds) ? answer.correctIds.map(String) : [];

  const base: QuestionModeQuestion = {
    id: String(raw?.id ?? `q${index + 1}`),
    type: QUESTION_TYPE_BY_MODE[mode] ?? 'mcq',
    title: fallbackTitle,
    subtitle: typeof raw?.description === 'string' ? raw.description : undefined,
    prompt: String(raw?.prompt ?? ''),
    imageUrl: optionalImage(raw?.imageUrl),
    correctAnswers: ordered.length > 0 ? ordered : correctIds,
    hint: typeof raw?.hint === 'string' ? raw.hint : undefined,
    xpReward: typeof raw?.xpReward === 'number' ? raw.xpReward : undefined,
    evidence: mapEvidence(raw?.evidence),
    entity:
      raw?.entity && typeof raw.entity === 'object'
        ? {
            kind: String(raw.entity.kind ?? ''),
            id: String(raw.entity.id ?? ''),
            name: String(raw.entity.name ?? ''),
            imageUrl: optionalImage(raw.entity.imageUrl),
          }
        : undefined,
  };

  switch (base.type) {
    case 'bingo':
      return {
        ...base,
        board: Array.isArray(raw?.bingoBoard) ? raw.bingoBoard : [],
      };
    case 'grid':
      return {
        ...base,
        rowHeaders: Array.isArray(raw?.rows) ? raw.rows.map(String) : [],
        colHeaders: Array.isArray(raw?.columns) ? raw.columns.map(String) : [],
        rowHeaderImages: Array.isArray(raw?.rowImages) ? raw.rowImages : undefined,
        colHeaderImages: Array.isArray(raw?.columnImages) ? raw.columnImages : undefined,
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
      return {
        ...base,
        rankingItems: mapOptions(raw?.options),
      };
    default:
      return {
        ...base,
        options: mapOptions(raw?.options),
      };
  }
}

/**
 * The whole round. The server publishes one challenge row per mode per day
 * holding every question in `content.questions`; a round is exactly those, in
 * order. An empty list is surfaced as an empty round, never padded.
 */
export function mapSessionToRound(
  session: NonNullable<QuestionModeSessionResponse['data']>,
): QuestionModeQuestion[] {
  const content = session.content ?? {};
  const raw = Array.isArray(content.questions) ? content.questions : [];
  return raw.map((question, index) => mapRoundQuestion(session.type, question, index, session.title));
}

export const QuestionsModesService = {
  async getModes(token: string, language: Language): Promise<QuestionsModesResult> {
    const lang = normalizeLanguage(language);
    const res = await authFetch(`/quiz/questions/modes?language=${lang}`, token);
    const json = await safeJsonParse<QuestionsModesResponse>(res, { status: 'ERROR' });

    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!res.ok || json.status !== 'SUCCESS' || !Array.isArray(json.data?.modes)) {
      throw new Error(`API_ERROR_${res.status}`);
    }

    const rawSummary = json.data.summary;
    const summary: QuestionsModesSummary | null =
      rawSummary && typeof rawSummary.answeredCount === 'number'
        ? {
            answeredCount: rawSummary.answeredCount,
            xpEarnedTotal: rawSummary.xpEarnedTotal ?? 0,
            xpAvailableToday: rawSummary.xpAvailableToday ?? 0,
          }
        : null;

    const modes = json.data.modes.map((mode) => ({
      id: mode.type,
      title: mode.title,
      subtitle: mode.description,
      xpReward: mode.xpReward,
      // The modes list doesn't ship the round's questions, so its length is
      // unknown here. It becomes real when a session is opened.
      totalQuestions: 0,
      icon: mode.icon,
      previewImage: mode.image,
      difficulty: mode.difficulty,
      refreshTime: mode.refreshTime,
      completionState: mode.completionState,
      completionPercentage: mode.completionPercentage,
      unlockState: mode.unlockState,
      streakContribution: mode.streakContribution,
      leaderboardEligibility: mode.leaderboardEligibility,
    }));

    return { modes, summary };
  },

  async createSession(
    token: string,
    modeId: Exclude<QuestionModeId, 'football-quiz'>,
    language: Language,
  ): Promise<QuestionModeSession> {
    const lang = normalizeLanguage(language);
    const res = await authFetch(`/quiz/questions/modes/${modeId}/session?language=${lang}`, token);
    const json = await safeJsonParse<QuestionModeSessionResponse>(res, { status: 'ERROR' });

    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (res.status === 404) {
      throw new Error('MODE_NOT_FOUND');
    }
    if (!res.ok || json.status !== 'SUCCESS' || !json.data) {
      throw new Error(`API_ERROR_${res.status}`);
    }

    const questions = mapSessionToRound(json.data);

    return {
      sessionId: json.data.challengeId,
      mode: makeModeSummary(json.data, questions.length),
      currentIndex: 0,
      // The round is however many real questions the API published today.
      totalQuestions: questions.length,
      timeLimitSec: typeof json.data.content?.timer === 'number' ? json.data.content.timer : 20,
      questions,
    };
  },

  async submitAnswer(
    token: string,
    modeId: Exclude<QuestionModeId, 'football-quiz'>,
    body: {
      challengeId: string;
      /** Which question of the round is being answered. */
      questionId: string;
      selectedIds: string[];
      elapsedTime: number;
      language: Language;
    },
  ): Promise<SubmitQuestionModeAnswerResult> {
    const res = await authFetch(`/quiz/questions/modes/${modeId}/answer`, token, {
      method: 'POST',
      body: JSON.stringify({
        challengeId: body.challengeId,
        questionId: body.questionId,
        selectedIds: body.selectedIds,
        elapsedTime: body.elapsedTime,
        language: normalizeLanguage(body.language),
      }),
    });

    const json = await safeJsonParse<{ status: string; data?: SubmitQuestionModeAnswerResult }>(res, {
      status: 'ERROR',
    });

    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!res.ok || json.status !== 'SUCCESS' || !json.data) {
      throw new Error(`API_ERROR_${res.status}`);
    }

    return json.data;
  },

  /**
   * ASK THE CROWD. Reads the real per-option split the backend counted from
   * other players' submissions. A failure or an unavailable split resolves to
   * `available: false` — the lifeline stays locked rather than guessing.
   */
  async getCrowdStats(
    token: string,
    modeId: Exclude<QuestionModeId, 'football-quiz'>,
    params: { challengeId: string; questionId: string; language: Language },
  ): Promise<QuestionCrowdStats> {
    const unavailable: QuestionCrowdStats = {
      challengeId: params.challengeId,
      questionId: params.questionId,
      available: false,
      sampleSize: 0,
      percentages: {},
    };

    const query = new URLSearchParams({
      challengeId: params.challengeId,
      questionId: params.questionId,
      language: normalizeLanguage(params.language),
    }).toString();

    const res = await authFetch(`/quiz/questions/modes/${modeId}/crowd?${query}`, token);
    const json = await safeJsonParse<{ status: string; data?: QuestionCrowdStats }>(res, {
      status: 'ERROR',
    });

    if (!res.ok || json.status !== 'SUCCESS' || !json.data) return unavailable;
    return json.data;
  },

  async useHint(
    token: string,
    modeId: Exclude<QuestionModeId, 'football-quiz'>,
    body: {
      challengeId: string;
      language: Language;
    },
  ): Promise<{ hint: string | null }> {
    const res = await authFetch(`/quiz/questions/modes/${modeId}/hint`, token, {
      method: 'POST',
      body: JSON.stringify({
        challengeId: body.challengeId,
        language: normalizeLanguage(body.language),
      }),
    });

    const json = await safeJsonParse<{ status: string; data?: { hint: string | null } }>(res, {
      status: 'ERROR',
    });

    if (res.status === 401) {
      throw new Error('AUTH_REQUIRED');
    }
    if (!res.ok || json.status !== 'SUCCESS' || !json.data) {
      throw new Error(`API_ERROR_${res.status}`);
    }

    return json.data;
  },
};
