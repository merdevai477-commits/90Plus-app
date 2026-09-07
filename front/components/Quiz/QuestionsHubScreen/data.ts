/**
 * =============================================================================
 * QUESTIONS HUB — DATA, COPY & LAYOUT RULES
 * =============================================================================
 *
 * Everything on the hub that is *content* rather than *styling*:
 * the card artwork map, the XP fallbacks, all user-facing strings, and the
 * responsive column rules.
 *
 * Styling lives next door in ./styles.ts.
 *
 * ── QUICK INDEX ──────────────────────────────────────────────────────────────
 *   CARD ARTWORK ............ MODE_LOCAL_IMAGE
 *   XP SHOWN ON A CARD ...... the API's xpReward, and nothing else
 *   CARD SHAPE PER MODE ..... getChallengeLayout()
 *   ALL HUB COPY ............ getQuestionsHubCopy()
 *   STATS STRIP CONTENTS .... buildSummaryStats()
 *   COLUMN BREAKPOINTS ...... getGridColumns()
 *   SAFE-AREA PADDING ....... getQuestionsHubContentStyle()
 * =============================================================================
 */

import type { EdgeInsets } from 'react-native-safe-area-context';

import type { Language } from '../../../src/i18n';
import {
  QUESTION_MODE_CATALOG,
  type QuestionModeId,
  type QuestionModeSummary,
} from '../../../services/questionsModes';

/** Horizontal space between two cards. Mirrors ./styles.ts → GRID_GAP. */
export const GRID_GAP = 16;

/** Hard cap so the grid doesn't sprawl on very wide tablets. */
export const MAX_CONTENT_WIDTH = 720;

/**
 * CARD ARTWORK — the image on each hub card.
 *
 * This is the mode's own illustration: it identifies the GAME, not any
 * footballer or club, so it is app artwork rather than football data. The
 * question screen has no bundled artwork at all — every picture there is the
 * real image the API resolved for that question's entity.
 *
 * CUSTOMIZE: point a mode at a different file in front/assets/images/.
 */
/**
 * Bundled card art per mode. Modes without a still (e.g. football-bingo until
 * design exports one) omit an entry and ChallengeCard falls back to vector art.
 */
export const MODE_LOCAL_IMAGE: Partial<Record<QuestionModeId, number>> = {
  'guess-player': require('../../../assets/images/guess-player.jpg'),
  'football-grid': require('../../../assets/images/football-grid.jpg'),
  'player-connections': require('../../../assets/images/player-connection.webp'),
  'guess-club': require('../../../assets/images/guess-club.webp'),
  'transfer-puzzle': require('../../../assets/images/transfer-puzzle.jpg'),
  'top10-challenge': require('../../../assets/images/top-challenge.webp'),
  'football-quiz': require('../../../assets/images/football-quiz.webp'),
};

export type ChallengeLayout = 'horizontal' | 'vertical';

export interface Challenge {
  id: QuestionModeId;
  title: string;
  subtitle: string;
  xpReward: number;
  imageSource?: { uri: string } | number;
  /** Bundled asset used if `imageSource` is a remote URI that fails to load. */
  fallbackImageSource?: number;
  layout: ChallengeLayout;
  onPress: () => void;
}

export interface Stat {
  id: string;
  label: string;
  value: string;
  /** Shorter label used on phones under 360pt. */
  compactLabel?: string;
}

export interface QuestionsHubCopy {
  heroKicker: string;
  heroTitleStart: string;
  heroTitleEnd: string;
  heroSubtitle: string;
  sectionTitle: string;
  answeredLabel: string;
  questionsXpLabel: string;
  backToRank: string;
}

export interface QuestionsHubLayout {
  contentWidth: number;
  horizontalPad: number;
  columns: number;
  /** True under 360pt — switches the stats strip to its tighter variant. */
  isCompact: boolean;
}

/**
 * ALL HUB COPY lives here.
 * CUSTOMIZE: edit a string to change what the screen says. The hero title is
 * split into `heroTitleStart` + "XP" + `heroTitleEnd` so the gradient-filled
 * "XP" can sit inline — see components/HeroBanner.tsx.
 */
export function getQuestionsHubCopy(language: Language): QuestionsHubCopy {
  const isArabic = language === 'ar';

  return {
    heroKicker: isArabic ? 'اختبر معلوماتك' : 'Test Your Knowledge',
    heroTitleStart: isArabic ? 'واربح نقاط' : 'Earn',
    heroTitleEnd: isArabic ? '' : 'Points',
    heroSubtitle: isArabic
      ? 'أجب على الأسئلة وتحدى أصدقائك!'
      : 'Answer questions and challenge your friends!',
    sectionTitle: isArabic ? 'اختر نوع التحدي' : 'Choose Challenge Type',
    answeredLabel: isArabic ? 'الأسئلة المجاب عنها' : 'Answered',
    /*
     * "XP from Questions", NOT "Total XP".
     *
     * This number is the XP this user earned IN THE QUESTIONS MODES; the stat
     * beside it is the account's whole XP balance. Labelling the smaller one
     * "Total XP" put two different quantities side by side under names that
     * promised they were the same, which is why the two never matched.
     */
    questionsXpLabel: isArabic ? 'نقاط الأسئلة' : 'Questions XP',
    backToRank: isArabic ? 'رجوع للرانك' : 'Back to Rank',
  };
}

/**
 * CARD SHAPE PER MODE.
 * 'horizontal' → 194 × 109, artwork beside the copy.
 * 'vertical'   → 194 × 149, artwork above the copy.
 * CUSTOMIZE: move a mode between the two silhouettes here. Remember to give it
 * matching padding in components/ChallengeCard.tsx → CHALLENGE_LAYOUT.
 */
export function getChallengeLayout(modeId: QuestionModeId): ChallengeLayout {
  return modeId === 'guess-player' || modeId === 'football-bingo' ? 'horizontal' : 'vertical';
}

/** API artwork wins when present; otherwise the bundled asset is used. */
export function resolveModeImageSource(
  mode: QuestionModeSummary,
): { uri: string } | number | undefined {
  if (mode.previewImage && mode.previewImage.trim().length > 0) {
    return { uri: mode.previewImage };
  }
  return MODE_LOCAL_IMAGE[mode.id];
}

export function getQuestionsHubLayout(screenWidth: number): QuestionsHubLayout {
  return {
    contentWidth: Math.min(screenWidth, MAX_CONTENT_WIDTH),
    horizontalPad: 0,
    columns: getGridColumns(screenWidth),
    isCompact: screenWidth < 360,
  };
}

/**
 * RESPONSIVE COLUMN COUNT.
 * CUSTOMIZE: move these breakpoints to change when the grid gains a column.
 */
export function getGridColumns(screenWidth: number): number {
  if (screenWidth >= 960) return 4;
  if (screenWidth >= 640) return 3;
  return 2;
}

export function chunkItems<T>(items: T[], columns: number): T[][] {
  const rows: T[][] = [];
  for (let index = 0; index < items.length; index += columns) {
    rows.push(items.slice(index, index + columns));
  }
  return rows;
}

/**
 * Merges the API's modes over the local catalogue so the grid always shows all
 * eight cards in a stable order, even before (or without) a successful fetch.
 *
 * A card the API hasn't sent yet keeps its name and artwork — which are app
 * copy — but advertises NO reward. XP is a real number the backend derives from
 * the questions it actually published today; a plausible-looking stand-in on
 * the card would be a promise the round doesn't keep. `ChallengeCard` renders
 * no XP line for a zero.
 *
 * NAME AND SUB-NAME ARE ALWAYS APP COPY, never the API's.
 * Figma node 1:2 gives every card the same two-part name: the mode's English
 * name on top, its Arabic name beneath — "Football Grid" / "شبكة كرة القدم" —
 * and that pair is exactly QUESTION_MODE_CATALOG. The API's `subtitle` is its
 * `description` field, a full sentence ("Guess the player from the clues and
 * photo"); rendering that here replaced the Arabic sub-name with an ellipsised
 * sentence and squeezed the "+60 XP" reward off the card entirely. The API
 * still owns everything that is actually live: xpReward, previewImage,
 * completion state, difficulty.
 */
export function mergeQuestionModes(data?: QuestionModeSummary[]): QuestionModeSummary[] {
  const liveById = new Map((data ?? []).map((item) => [item.id, item]));

  return QUESTION_MODE_CATALOG.map((catalogItem) => {
    const live = liveById.get(catalogItem.id);

    if (live) {
      return { ...live, title: catalogItem.title, subtitle: catalogItem.subtitle };
    }

    return {
      id: catalogItem.id,
      title: catalogItem.title,
      subtitle: catalogItem.subtitle,
      xpReward: 0,
      totalQuestions: 0,
      icon: catalogItem.icon,
      previewImage: '',
      difficulty: 'MEDIUM',
      refreshTime: '00:00',
      completionState: 'available',
      completionPercentage: 0,
      unlockState: true,
      streakContribution: true,
      leaderboardEligibility: true,
    };
  });
}

export function buildChallengeItems(
  modes: QuestionModeSummary[],
  onPressMode: (modeId: QuestionModeId) => void,
): Challenge[] {
  return modes.map((mode) => ({
    id: mode.id,
    title: mode.title,
    subtitle: mode.subtitle,
    xpReward: mode.xpReward,
    imageSource: resolveModeImageSource(mode),
    fallbackImageSource: MODE_LOCAL_IMAGE[mode.id],
    layout: getChallengeLayout(mode.id),
    onPress: () => onPressMode(mode.id),
  }));
}

/**
 * THE FOOTER STRIP — [level] │ XP │ Answered │ Total XP │ [star].
 *
 * ONE SOURCE OF TRUTH PER NUMBER, all of them the database:
 *   XP ......... the signed-in user's live XP balance (XpContext → /xp).
 *   Answered ... `summary.answeredCount`, counted by the backend from this
 *                user's own UserQuestionChallenge rows.
 *   Total XP ... `summary.xpEarnedTotal`, the XP those same rows actually
 *                awarded.
 *
 * Nothing here is derived from a question bank, a per-mode XP table, or the
 * questions on screen. A value that hasn't loaded renders as an em dash — the
 * strip must never fill in a plausible-looking number of its own.
 *
 * CUSTOMIZE: add, remove or reorder entries. The screen renders the first
 * three (see QuestionsHubScreen.tsx → summaryStats.slice(0, 3)).
 */
export function buildSummaryStats(args: {
  language: Language;
  xp: number;
  answeredCount: number | null;
  xpEarnedTotal: number | null;
}): Stat[] {
  const { language, xp, answeredCount, xpEarnedTotal } = args;
  const copy = getQuestionsHubCopy(language);
  const show = (value: number | null) => (value === null ? '—' : value.toLocaleString());

  return [
    // The account's authoritative XP balance, from the XP service.
    { id: 'xp', label: 'XP', value: xp.toLocaleString() },
    {
      id: 'answered',
      label: copy.answeredLabel,
      value: show(answeredCount),
      compactLabel: copy.answeredLabel,
    },
    // …and how much of that came from playing Questions.
    {
      id: 'questions-xp',
      label: copy.questionsXpLabel,
      value: show(xpEarnedTotal),
      compactLabel: copy.questionsXpLabel,
    },
  ];
}

/**
 * SCROLL CONTENT PADDING.
 * Figma places the coin cluster 33pt below the status bar, so the top inset is
 * `max(safeArea.top, 0) + 33`. The bottom inset clears the tab bar.
 *
 * CUSTOMIZE: TOP_OFFSET / BOTTOM_OFFSET below.
 *
 * @param scale `s()` from useDesignScale — converts Figma units to device units.
 */
const TOP_OFFSET = 33;
const BOTTOM_OFFSET = 26;

export function getQuestionsHubContentStyle(
  layout: QuestionsHubLayout,
  insets: EdgeInsets,
  scale: (value: number) => number = (value) => value,
) {
  return {
    paddingTop: insets.top + scale(TOP_OFFSET),
    paddingBottom: insets.bottom + scale(BOTTOM_OFFSET),
    paddingHorizontal: layout.horizontalPad,
    width: '100%' as const,
  };
}
