/**
 * =============================================================================
 * QUESTION MODE PLAYER SCREEN
 * =============================================================================
 *
 * The screen you land on after tapping a card on the Questions Hub. Handles the
 * six playable modes — the shell is shared; only the answer surface swaps.
 *
 * Ported 1:1 from the Figma set (448pt artboard, 22pt gutters ⇒ 404pt column):
 *   Guess The Player .... 231:73
 *   Football Bingo ...... 233:224
 *   Football Grid ....... 233:249
 *   Player Connections .. 233:274
 *   Guess The Club ...... 233:299
 *   Transfer Puzzle ..... 238:324
 *
 * Every measurement below is the RAW FIGMA VALUE passed through
 * `useDesignScale()`, so proportions hold from iPhone SE (320pt) to tablets.
 *
 * ── SCREEN ANATOMY (top to bottom) ───────────────────────────────────────────
 *   GameScreenHeader   back · title · XP        ./gameChrome.tsx
 *   GameProgressCard   "Question 2 of 6"        ./gameChrome.tsx
 *   question heading   title + subtitle
 *   hero media         404-wide 3:2 artwork     guess-player · guess-club
 *   evidence           clue rows                guess-player · guess-club
 *   answer surface     a board OR an option list
 *   ActionBar          lifelines + confirm (pinned)
 *
 * ── WHAT YOU CAN CHANGE WHERE ────────────────────────────────────────────────
 *   COLOURS / HEADER / PROGRESS ... ./gameChrome.tsx
 *   BOARDS & CARD GRIDS ........... ./QuestionsModeBoards.tsx
 *   VERTICAL RHYTHM ............... SECTION_GAP (just below)
 *   ALL OTHER SPACING / TYPE ...... createStyles()
 *   EVIDENCE ICONS ................ EVIDENCE_ICONS
 *   LIFELINES ..................... ./QuestionLifelines.tsx
 *   CONFIRM BUTTON ................ styles.confirmButton + QUIZ_FIGMA_ACTION_GRAD_*
 *   QUESTION CONTENT .............. served by the API, authored by the quiz AI
 *   CREST / PORTRAIT SOURCE ....... resolved server-side, arrives on the question
 *
 * Structural notes:
 * - Header + progress card live inside the scroll flow, so scrolled content
 *   can't slide underneath transparent overlays.
 * - Only the action bar is pinned; the scroll pads itself by the bar's
 *   measured height so the last option is never covered.
 * =============================================================================
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Animated,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import {
  CalendarDays,
  CircleDot,
  HelpCircle,
  LandPlot,
  Lightbulb,
  MapPin,
  Shirt,
  Trophy,
} from 'lucide-react-native';

import { useQuestionModeSession } from '../../hooks/useQuestionModeSession';
import { useTranslation, type Language } from '../../src/i18n';
import { useLanguageStore } from '../../src/i18n/store';
import { useDesignScale, type DesignScale } from '../../utils/responsive';
import { getAppFont } from '../../utils/fontSetup';
import {
  BingoBoard,
  ClubAnswerGrid,
  ConnectionsPlayersGrid,
  ConstraintGridBoard,
  TopTenInputs,
  TransferPath,
} from './QuestionsModeBoards';
import { GameAnswerOption, GameAnswerOptionList } from './GameAnswerOption';
import { MOTION, useQuestionEntrance } from './gameMotion';
import { type Lifeline } from './QuestionLifelines';
import {
  GAME_COLOR,
  GAME_LAYOUT,
  GameActionBar,
  GameLoadingState,
  GameProgressCard,
  GameScreenHeader,
  SECTION_RULE_GRADIENT,
} from './gameChrome';
import { GlobalQuizStats } from './GlobalQuizStats';
import {
  QUIZ_FIGMA_ACTION_GRAD_END,
  QUIZ_FIGMA_ACTION_GRAD_START,
} from './quiz.constants';

type PlayableModeId =
  | 'guess-player'
  | 'football-bingo'
  | 'football-grid'
  | 'player-connections'
  | 'guess-club'
  | 'transfer-puzzle'
  | 'top10-challenge';

/** Stable empty arrays so an absent board doesn't rebuild its renderer's props. */
const EMPTY_CONNECTION_PLAYERS: { id: string; name: string; imageUrl?: string }[] = [];
const EMPTY_TRANSFER_CHAIN: { id: string; label: string; imageUrl?: string; unknown?: boolean }[] = [];

/* ═══════════════════════════════════════════════════════════════════════════
 * VERTICAL RHYTHM — the gaps between the screen's blocks, in Figma units.
 * These are the numbers to touch if a section sits too high or too low.
 * ═══════════════════════════════════════════════════════════════════════════ */

const SECTION_GAP = {
  /** Progress card → question heading. Figma 300 − 280. */
  heading: 20,
  /** Heading → hero artwork. Figma 399 − 354 (233:299). */
  hero: 45,
  /** Heading → a board (grid / bingo / players / transfer). Figma 413 − 354. */
  board: 59,
  /** Hero → evidence block. Figma 692 − 668 (233:299). */
  evidence: 24,
  /** Evidence → option list. Figma 923 − 859 (231:73). */
  optionsAfterEvidence: 64,
  /** Evidence → club answer grid. Figma 1033 − 989 (233:299). */
  cardsAfterEvidence: 44,
  /** Players grid → option list. Figma 911 − 873 (233:274). */
  optionsAfterBoard: 38,
} as const;

/** Question artwork frame — Figma 404 × 269 (233:299 is 1536:1024, the same 3:2). */
const IMAGE_ASPECT_RATIO = 3 / 2;

/**
 * How many times each lifeline may be used per round.
 * Figma draws "2" in the badge (node 384:339).
 */
const LIFELINE_USES_PER_ROUND = 2;

/**
 * EVIDENCE ROW ICONS — mapped onto the glyphs Figma uses (node 260:1422:
 * uiw:date, boxicons:location, icon-park court, mingcute t-shirt).
 * Add a key here and to StaticEvidence['icon'] to introduce a new clue type.
 * Unknown/missing keys fall back to the question mark.
 */
const EVIDENCE_ICONS = {
  calendar: CalendarDays,
  globe: MapPin,
  pitch: LandPlot,
  palette: Shirt,
  shirt: Shirt,
  trophy: Trophy,
  ball: CircleDot,
} as const;

function resolveEvidenceIcon(key?: string) {
  if (key && key in EVIDENCE_ICONS) {
    return EVIDENCE_ICONS[key as keyof typeof EVIDENCE_ICONS];
  }
  return HelpCircle;
}

function titleByMode(modeId: PlayableModeId, language: Language): string {
  const ar: Record<PlayableModeId, string> = {
    'guess-player': 'خمن اللاعب',
    'football-bingo': 'بينجو كرة القدم',
    'football-grid': 'شبكة كرة القدم',
    'player-connections': 'اتصالات اللاعبين',
    'guess-club': 'خمن النادي',
    'transfer-puzzle': 'ألغاز الانتقالات',
    'top10-challenge': 'تحدي أفضل 10',
  };
  const en: Record<PlayableModeId, string> = {
    'guess-player': 'Guess The Player',
    'football-bingo': 'Football Bingo',
    'football-grid': 'Football Grid',
    'player-connections': 'Player Connections',
    'guess-club': 'Guess The Club',
    'transfer-puzzle': 'Transfer Puzzle',
    'top10-challenge': 'Top 10 Challenge',
  };
  return language === 'ar' ? ar[modeId] : en[modeId];
}

/* -------------------------------------------------------------------------- */
/* Styles                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * `isRtl` mirrors the row layouts. Figma is drawn in Arabic (RTL); in English
 * the same rows read left-to-right, which is why several `flexDirection` and
 * `textAlign` values are conditional rather than hardcoded.
 */
function createStyles(scale: number, fontScale: number, language: string) {
  const s = (designValue: number) => Math.round(designValue * scale);
  const f = (designFontSize: number) => Math.round(designFontSize * fontScale);
  const isRtl = language === 'ar';
  const font = (weight: 400 | 500 | 600 | 700 | 800) => getAppFont(weight, language);

  /** Leading edge for rows that hug one side (evidence, hint info). */
  const rowStart = isRtl ? ('row' as const) : ('row-reverse' as const);
  const textAlign = isRtl ? ('right' as const) : ('left' as const);

  return StyleSheet.create({
    /* ── Screen shell ─────────────────────────────────────────────────── */
    root: { flex: 1, backgroundColor: GAME_COLOR.background },
    centered: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    scroll: { flex: 1 },
    /** 22pt side gutters → the Figma 404pt content column. */
    scrollContent: { paddingHorizontal: s(GAME_LAYOUT.gutter) },

    /* ── QUESTION HEADING — Figma 289:443 / 260:1473 ──────────────────── */
    questionHeader: {
      marginTop: s(SECTION_GAP.heading),
      alignItems: 'center',
      alignSelf: 'center',
      // Figma pins the heading to a narrow centred column (263–341pt) so long
      // prompts wrap into a tidy stack rather than running gutter to gutter.
      width: '84%',
      gap: s(2),
    },
    questionTitle: {
      fontFamily: font(600),
      fontSize: f(24),
      lineHeight: f(31),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    questionSubtitle: {
      fontFamily: font(400),
      fontSize: f(16),
      lineHeight: f(21),
      color: GAME_COLOR.textMuted,
      textAlign: 'center',
    },

    /* ── HERO ARTWORK — Figma 260:1349 (404 wide, 3:2, radius 25) ─────── */
    media: {
      marginTop: s(SECTION_GAP.hero),
      width: '100%',
      aspectRatio: IMAGE_ASPECT_RATIO,
      borderRadius: s(25),
      overflow: 'hidden',
      backgroundColor: GAME_COLOR.tileSurface,
      // Same 1px edge every card, row and cell on this screen carries. Without
      // it a very dark illustration has no boundary against the black page and
      // reads as "no image at all".
      borderWidth: 1,
      borderColor: GAME_COLOR.rowBorder,
    },
    mediaImage: { width: '100%', height: '100%' },

    /* ── ANSWER SURFACE OFFSETS ───────────────────────────────────────── */
    boardBlock: { marginTop: s(SECTION_GAP.board) },
    /** "Premier League · 2010" above the ten Top 10 inputs. */
    top10Caption: {
      fontFamily: font(600),
      fontSize: f(14),
      lineHeight: f(18),
      color: GAME_COLOR.accent,
      textAlign: 'center',
      marginBottom: s(12),
    },
    optionsAfterEvidence: { marginTop: s(SECTION_GAP.optionsAfterEvidence) },
    cardsAfterEvidence: { marginTop: s(SECTION_GAP.cardsAfterEvidence) },
    optionsAfterBoard: { marginTop: s(SECTION_GAP.optionsAfterBoard) },

    /* ── EVIDENCE — Figma 260:1418 ────────────────────────────────────── */
    evidence: { marginTop: s(SECTION_GAP.evidence) },
    evidenceHeader: {
      alignSelf: isRtl ? 'flex-end' : 'flex-start',
      flexDirection: rowStart,
      alignItems: 'center',
      gap: s(8),
      marginBottom: s(8),
    },
    evidenceHeaderText: {
      fontFamily: font(600),
      fontSize: f(18),
      lineHeight: f(24),
      color: GAME_COLOR.textPrimary,
    },
    /** Figma node 260:1421 — a 4pt round-capped bar, #460BCB → #230665. */
    evidenceHeaderRule: { width: s(4), height: s(20), borderRadius: s(2) },
    /**
     * Rows stack into one card: only the first and last corners round, and
     * every row after the first drops its top border so the seams stay 1px.
     */
    /**
     * Figma draws the icon tile + label on the READING-START edge and the value
     * on the opposite one. The JSX order is [lead, value], so Arabic reverses
     * the row to push the lead to the right and English leaves it to the left.
     */
    evidenceRow: {
      minHeight: s(64),
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: s(12),
      paddingHorizontal: s(24),
      paddingVertical: s(10),
      borderWidth: 1,
      borderTopWidth: 0,
      borderColor: GAME_COLOR.rowBorder,
    },
    evidenceRowFirst: { borderTopWidth: 1, borderTopLeftRadius: s(25), borderTopRightRadius: s(25) },
    evidenceRowLast: { borderBottomLeftRadius: s(25), borderBottomRightRadius: s(25) },
    /** Icon tile + label, hugging the leading edge. JSX order is [tile, label]. */
    evidenceLead: {
      flexShrink: 1,
      flexDirection: isRtl ? 'row-reverse' : 'row',
      alignItems: 'center',
      gap: s(12),
    },
    evidenceLabel: {
      flexShrink: 1,
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(21),
      color: GAME_COLOR.textPrimary,
      textAlign,
    },
    /** The fact itself, on the opposite edge — Figma node 260:1424. */
    evidenceValue: {
      flexShrink: 1,
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(21),
      color: GAME_COLOR.textValue,
      textAlign: isRtl ? 'left' : 'right',
    },

    /* ── SHARED 42×42 TILE (option letter + evidence icon) ────────────── */
    tile: {
      width: s(42),
      height: s(42),
      borderRadius: s(10),
      borderWidth: 1,
      borderColor: GAME_COLOR.accent,
      backgroundColor: GAME_COLOR.tileSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },

    /*
     * ANSWER ROWS live in ./GameAnswerOption — one component for every mode,
     * Football Quiz included. Only the offsets that position the stack on THIS
     * screen stay here (see optionsAfterEvidence / optionsAfterBoard above).
     */

    /* ── INLINE FEEDBACK ──────────────────────────────────────────────── */
    hintBanner: {
      marginTop: s(16),
      flexDirection: rowStart,
      alignItems: 'center',
      gap: s(8),
      paddingHorizontal: s(12),
      paddingVertical: s(10),
      borderRadius: s(10),
      borderWidth: 1,
      borderColor: 'rgba(250,204,21,0.44)',
      backgroundColor: 'rgba(250,204,21,0.12)',
    },
    hintBannerText: {
      flex: 1,
      fontFamily: font(600),
      fontSize: f(13),
      lineHeight: f(18),
      color: '#FDE68A',
      textAlign,
    },
    resultPill: {
      marginTop: s(16),
      alignSelf: isRtl ? 'flex-end' : 'flex-start',
      paddingHorizontal: s(12),
      paddingVertical: s(8),
      borderRadius: s(10),
      borderWidth: 1,
    },
    resultPillCorrect: { borderColor: GAME_COLOR.correct, backgroundColor: 'rgba(34,197,94,0.18)' },
    resultPillWrong: { borderColor: GAME_COLOR.wrong, backgroundColor: 'rgba(239,68,68,0.18)' },
    resultPillText: { fontFamily: font(700), fontSize: f(13), color: GAME_COLOR.textPrimary },

    /* ── LOADING / ERROR / COMPLETE STATES ────────────────────────────── */
    stateCard: {
      width: '100%',
      maxWidth: s(404),
      alignItems: 'center',
      gap: s(12),
      padding: s(24),
      borderRadius: s(16),
      borderWidth: 1,
      borderColor: GAME_COLOR.progressBorder,
      backgroundColor: GAME_COLOR.background,
    },
    stateTitle: {
      fontFamily: font(700),
      fontSize: f(24),
      lineHeight: f(32),
      color: GAME_COLOR.textPrimary,
      textAlign: 'center',
    },
    stateBody: {
      fontFamily: font(500),
      fontSize: f(16),
      lineHeight: f(22),
      color: GAME_COLOR.textMuted,
      textAlign: 'center',
    },
    stateAction: {
      marginTop: s(4),
      alignSelf: 'stretch',
      height: s(56),
      borderRadius: s(16),
      overflow: 'hidden',
    },
    /** The state CTA reuses the action bar's gradient fill and label type. */
    stateActionFill: { flex: 1, alignItems: 'center', justifyContent: 'center' },
    stateActionText: {
      fontFamily: font(600),
      fontSize: f(18),
      lineHeight: f(24),
      color: GAME_COLOR.textPrimary,
    },
    stateGutter: { paddingHorizontal: s(GAME_LAYOUT.gutter) },
  });
}

type QuizStyles = ReturnType<typeof createStyles>;

/** Styles are a pure function of (scale, language) — cache to avoid rebuilds. */
const styleCache = new Map<string, QuizStyles>();

function useQuizModeStyles(): { styles: QuizStyles; metrics: DesignScale; isRtl: boolean } {
  const metrics = useDesignScale();
  const language = useLanguageStore((state) => state.language);
  const { scale, fontScale } = metrics;
  const cacheKey = `${Math.round(scale * 1000)}-${language}`;

  const styles = useMemo(() => {
    const cached = styleCache.get(cacheKey);
    if (cached) return cached;
    const created = createStyles(scale, fontScale, language);
    styleCache.set(cacheKey, created);
    return created;
  }, [cacheKey, scale, fontScale, language]);

  return { styles, metrics, isRtl: language === 'ar' };
}

/* -------------------------------------------------------------------------- */
/* Presentational pieces                                                      */
/* -------------------------------------------------------------------------- */

function EvidenceSection({
  evidence,
  language,
}: {
  evidence: { id: string; text: string; label?: string; value?: string; icon?: string }[];
  language: Language;
}) {
  const { styles, metrics } = useQuizModeStyles();

  return (
    <View style={styles.evidence}>
      <View style={styles.evidenceHeader}>
        <Text style={styles.evidenceHeaderText}>{language === 'ar' ? 'الأدلة' : 'Evidence'}</Text>
        <LinearGradient
          colors={[...SECTION_RULE_GRADIENT]}
          start={{ x: 0, y: 0 }}
          end={{ x: 0, y: 1 }}
          style={styles.evidenceHeaderRule}
        />
      </View>

      {evidence.map((clue, index) => {
        const Icon = resolveEvidenceIcon(clue.icon);
        // Guess The Club authors label + value; Guess The Player only has the
        // sentence, which then takes the label slot and leaves the value empty.
        const label = clue.label ?? clue.text;

        return (
          <LinearGradient
            key={clue.id}
            colors={[...GAME_COLOR.rowGradient]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={[
              styles.evidenceRow,
              index === 0 && styles.evidenceRowFirst,
              index === evidence.length - 1 && styles.evidenceRowLast,
            ]}
          >
            <View style={styles.evidenceLead}>
              <View style={styles.tile}>
                <Icon size={metrics.s(24)} color={GAME_COLOR.accent} strokeWidth={2} />
              </View>
              <Text style={styles.evidenceLabel}>{label}</Text>
            </View>

            {clue.value ? <Text style={styles.evidenceValue}>{clue.value}</Text> : null}
          </LinearGradient>
        );
      })}
    </View>
  );
}

/**
 * THE QUESTION ARTWORK FRAME — Figma 404 × 269, radius 25.
 *
 * Shows the ONE picture this question carries: the image the server resolved
 * for the football entity the question is about (a 365Scores portrait for a
 * player, an API-Football crest for a club). There is deliberately no fallback
 * chain behind it — a generic mode illustration standing in for a missing
 * portrait is what made "Guess The Player" show the same artwork for every
 * question and hid the fact that the real image had gone missing.
 *
 * If the URL fails to load the frame renders empty rather than substituting a
 * different picture; a mode whose questions carry no hero (the board modes)
 * renders nothing at all.
 *
 * The frame keeps the same 1px border every other surface on this screen has,
 * so a very dark crest still reads as a framed image on the near-black page.
 */
function QuestionHeroMedia({
  uri,
  accessibilityLabel,
  contentFit = 'cover',
}: {
  uri?: string;
  accessibilityLabel?: string;
  contentFit?: 'cover' | 'contain';
}) {
  const { styles } = useQuizModeStyles();
  const [failed, setFailed] = useState(false);

  // A new question resets the state, so one bad URL never suppresses the next
  // question's artwork.
  useEffect(() => {
    setFailed(false);
  }, [uri]);

  if (!uri || failed) return null;

  return (
    <View style={styles.media}>
      <Image
        source={{ uri }}
        style={styles.mediaImage}
        contentFit={contentFit}
        transition={MOTION.duration.image}
        cachePolicy="memory-disk"
        accessibilityLabel={accessibilityLabel}
        onError={() => setFailed(true)}
      />
    </View>
  );
}

/** Copy on the pinned bar's primary button. */
function primaryLabelFor(revealed: boolean, language: Language): string {
  if (revealed) return language === 'ar' ? 'السؤال التالي' : 'Next Question';
  return language === 'ar' ? 'تأكيد الإجابة' : 'Confirm Answer';
}

/* -------------------------------------------------------------------------- */
/* Screen                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Backend reason code → something a player can act on.
 *
 * These four states are genuinely different and must not collapse into one
 * message: the round is on its way, the round could not be built today, the
 * session dropped, or something else broke.
 */
function describeSessionFailure(reason: string | null, language: 'ar' | 'en'): string {
  const ar = language === 'ar';
  switch (reason) {
    case 'GENERATION_IN_PROGRESS':
      return ar
        ? 'يتم تجهيز تحدي اليوم الآن. حاول مرة أخرى بعد لحظات.'
        : "Today's challenge is being prepared. Try again in a moment.";
    case 'QUESTION_GENERATION_UNAVAILABLE':
    case 'MODE_ROUND_MISSING':
    case 'GENERATION_BACKOFF_ACTIVE':
    case 'QUESTIONS_CHALLENGE_EMPTY':
      return ar
        ? 'تحدي اليوم لهذا الوضع غير متاح. جرّب وضعًا آخر أو عد لاحقًا.'
        : "Today's challenge isn't available for this mode yet. Try another mode or check back later.";
    case 'AUTH_REQUIRED':
      return ar ? 'يجب تسجيل الدخول لبدء التحدي.' : 'Please sign in to play.';
    case 'QUESTIONS_CHALLENGE_NOT_FOUND':
    case 'MODE_NOT_FOUND':
      return ar ? 'هذا الوضع غير متاح حاليًا.' : 'This mode is not available right now.';
    default:
      return ar ? 'تعذر تحميل التحدي' : 'Unable to load challenge';
  }
}

export default function QuestionsModeScreen({ modeId }: { modeId: PlayableModeId }) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { language } = useTranslation();
  const { styles, metrics } = useQuizModeStyles();

  const {
    loading,
    error,
    session,
    currentQuestion,
    selected,
    revealed,
    usedHint,
    completed,
    score,
    xpEarned,
    lastAnswerCorrect,
    eliminatedIds,
    gridPlacements,
    rejectedCell,
    textEntries,
    textResults,
    top10Reveal,
    setTextEntry,
    submitTextEntries,
    toggleSelection,
    submitAnswer,
    nextQuestion,
    changeQuestion,
    eliminateWrongAnswers,
    /*
     * `useHint`/`usedHint` (the hook's original reveal-a-clue lifeline) and
     * `revealAnswerStats` ("ask the crowd") are not wired into the action bar.
     * The product has exactly two lifelines — 50:50 and Change Question — so
     * there is no hexagon left for either. Both stay defined in the hook, and
     * the crowd endpoint stays live on the backend: `usedHint` still drives the
     * hint banner below, and nothing here should rip out working, unrelated
     * grading or API logic.
     */
  } = useQuestionModeSession(modeId, language);

  // ENTRY ANIMATION — the shared question transition (./gameMotion), replayed
  // on every question change. Football Quiz runs the identical one.
  const questionEntrance = useQuestionEntrance(currentQuestion?.id);
  const [actionBarHeight, setActionBarHeight] = useState(0);

  // Remaining uses for the two lifelines, for the whole round.
  /** "50:50" — eliminate wrong answers. See `eliminateWrongAnswers`. */
  const [fiftyUses, setFiftyUses] = useState(LIFELINE_USES_PER_ROUND);
  /** Remaining Change Question uses this round — capped at 2, see `changeQuestion`. */
  const [changeUses, setChangeUses] = useState(LIFELINE_USES_PER_ROUND);

  const handleActionBarLayout = useCallback((event: LayoutChangeEvent) => {
    setActionBarHeight(event.nativeEvent.layout.height);
  }, []);

  /**
   * ARTWORK.
   * Every image is resolved server-side against the football entity it belongs
   * to (see src/services/questions-challenges.ai-generator.service.ts) and
   * arrives on the question itself. Nothing is looked up here from a name:
   * guessing a crest/portrait URL from a label used to silently attach the
   * wrong club's badge, and never resolved at all in Arabic.
   */
  const letteredChoices = useMemo(() => {
    const alphabet =
      language === 'ar' ? ['أ', 'ب', 'ج', 'د', 'هـ', 'و'] : ['A', 'B', 'C', 'D', 'E', 'F'];
    return (currentQuestion?.options ?? []).map((option, index) => ({
      ...option,
      letter: alphabet[index] ?? '?',
      imageUrl: option.imageUrl,
    }));
  }, [currentQuestion?.options, language]);

  /*
   * Letters are assigned above from the FULL option list, before anything is
   * hidden — a surviving option keeps its original letter after a 50:50 (it
   * doesn't get relettered "A/B"), exactly like a real elimination round.
   * Rendering, below, works off this filtered view instead.
   */
  const visibleChoices = useMemo(
    () => letteredChoices.filter((option) => !eliminatedIds.includes(option.id)),
    [eliminatedIds, letteredChoices],
  );

  const connectionPlayers = currentQuestion?.connectionPlayers ?? EMPTY_CONNECTION_PLAYERS;

  const transferChain = currentQuestion?.transferChain ?? EMPTY_TRANSFER_CHAIN;

  const gridColImages = useMemo(
    () => (currentQuestion?.colHeaders ?? []).map((_, index) => currentQuestion?.colHeaderImages?.[index]),
    [currentQuestion?.colHeaders, currentQuestion?.colHeaderImages],
  );

  const gridRowImages = useMemo(
    () => (currentQuestion?.rowHeaders ?? []).map((_, index) => currentQuestion?.rowHeaderImages?.[index]),
    [currentQuestion?.rowHeaders, currentQuestion?.rowHeaderImages],
  );

  const headerTitle = titleByMode(modeId, language);
  const contentTopInset = insets.top + metrics.s(GAME_LAYOUT.contentTop);

  /**
   * The lifelines — Figma Frame 174. The design drew three hexagons; the
   * middle one was "ask the crowd / ask a friend", which 90Plus does not have
   * as a product, so the bar ships the two that exist: 50:50 and reload.
   *
   * The "reload" lifeline is CHANGE QUESTION, not skip/next — see
   * `changeQuestion` in useQuestionModeSession.ts. It used to call
   * `nextQuestion()`, which silently advanced the round instead of swapping
   * the current question for a different one; the round-progression fields
   * (`currentIndex`, score, completion) were never meant to move here. A use
   * is only spent (`changeUses` decremented) when `changeQuestion()` actually
   * finds a replacement — an exhausted bank leaves the count untouched rather
   * than burning a use on a no-op.
   */
  /**
   * Can this question's options be eliminated / polled at all? Only a flat
   * option list (mcq / connections / transfer / guess-club's card grid) has a
   * discrete set of "wrong answers" to hide or show a percentage for — a
   * board-based question (grid / bingo / top10) has neither, so both
   * lifelines render locked there rather than doing nothing on tap.
   */
  const optionCount = currentQuestion?.options?.length ?? 0;
  const canEliminate = optionCount > 2;

  const lifelines = useMemo<Lifeline[]>(
    () => [
      {
        // "50:50" — eliminate wrong answers, leaving the correct one + one
        // wrong one. See `eliminateWrongAnswers` in useQuestionModeSession.ts.
        id: 'fifty',
        glyph: 'fifty',
        badgeKind: 'count',
        badgeLabel: String(fiftyUses),
        disabled: fiftyUses === 0 || revealed || !canEliminate,
        accessibilityLabel: language === 'ar' ? 'احذف إجابتين خاطئتين' : 'Remove wrong answers',
        onPress: () => {
          if (fiftyUses === 0 || revealed || !canEliminate) return;
          // Server-resolved (see eliminateWrongAnswers) — a use is only spent
          // once it actually confirms two ids to keep.
          void eliminateWrongAnswers().then((didEliminate) => {
            if (didEliminate) setFiftyUses((remaining) => remaining - 1);
          });
        },
      },
      {
        id: 'change',
        glyph: 'reload',
        badgeKind: 'count',
        badgeLabel: String(changeUses),
        disabled: changeUses === 0 || revealed,
        accessibilityLabel: language === 'ar' ? 'تغيير السؤال' : 'Change question',
        onPress: () => {
          if (changeUses === 0 || revealed) return;
          if (changeQuestion()) {
            setChangeUses((remaining) => remaining - 1);
          }
        },
      },
    ],
    [
      canEliminate,
      changeQuestion,
      changeUses,
      eliminateWrongAnswers,
      fiftyUses,
      language,
      revealed,
    ],
  );

  const renderTerminalState = (body: React.ReactNode) => (
    <View
      style={[styles.root, styles.centered, styles.stateGutter, { paddingTop: contentTopInset }]}
    >
      {body}
    </View>
  );

  if (loading) {
    // The one shared spinner — see GameLoadingState in ./gameChrome.tsx.
    return <GameLoadingState topInset={contentTopInset} />;
  }

  if (error || !session || !currentQuestion) {
    /*
     * `error` is the backend's stable reason CODE, which was being rendered
     * straight into the card — players were shown literal strings like
     * "QUESTION_GENERATION_UNAVAILABLE". Codes stay the transport contract;
     * this maps the ones we know to something a person can act on, and each
     * state says a different, true thing. Anything unmapped still falls back
     * to the generic line rather than leaking a code.
     */
    const message = describeSessionFailure(error, language);

    return renderTerminalState(
      <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>{headerTitle}</Text>
        <Text style={styles.stateBody}>{message}</Text>
        <TouchableOpacity
          style={styles.stateAction}
          onPress={() => router.back()}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[QUIZ_FIGMA_ACTION_GRAD_START, QUIZ_FIGMA_ACTION_GRAD_END]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.stateActionFill}
          >
            <Text style={styles.stateActionText}>{language === 'ar' ? 'رجوع' : 'Go Back'}</Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>,
    );
  }

  if (completed) {
    return renderTerminalState(
      <View style={styles.stateCard}>
        <Text style={styles.stateTitle}>
          {language === 'ar' ? 'انتهى التحدي' : 'Challenge Complete'}
        </Text>
        <Text style={styles.stateBody}>
          {language === 'ar'
            ? `النتيجة ${score} من ${session.totalQuestions}`
            : `Score ${score} of ${session.totalQuestions}`}
        </Text>
        {/*
          The round's NET XP: +1 per correct answer, −1 per wrong one, so it
          can legitimately be negative and must not be printed as "+-2 XP".
        */}
        <Text style={styles.stateBody}>{`${xpEarned >= 0 ? '+' : '−'}${Math.abs(xpEarned)} XP`}</Text>
        <TouchableOpacity
          style={styles.stateAction}
          onPress={() => router.replace('/(tabs)/quiz')}
          activeOpacity={0.88}
          accessibilityRole="button"
        >
          <LinearGradient
            colors={[QUIZ_FIGMA_ACTION_GRAD_START, QUIZ_FIGMA_ACTION_GRAD_END]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.stateActionFill}
          >
            <Text style={styles.stateActionText}>
              {language === 'ar' ? 'العودة للتحديات' : 'Back to Challenges'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>,
    );
  }

  /**
   * Boards that grade themselves the moment the answer is complete — the
   * server says so per question (`selection.autoSubmit`), the app never
   * hardcodes which modes those are.
   */
  const autoSubmits = currentQuestion.selection.autoSubmit;
  /** Top 10 is typed, not tapped: its answer is the ten input boxes. */
  const isTextEntry = currentQuestion.selection.selectionMode === 'text';
  const canSubmit = isTextEntry
    ? textEntries.some((entry) => entry.trim().length > 0)
    : selected.length > 0;
  const evidence = currentQuestion.evidence ?? [];
  const showEvidence = evidence.length > 0;

  /**
   * QUESTION IMAGE — the question's own, and only that.
   *
   * It was resolved server-side for the exact football entity the question is
   * about and arrives on the question itself, so it can never be paired with a
   * different entity's name. Modes that draw their own board (grid, bingo,
   * connections, transfer) carry no hero and render none.
   */
  const heroImageUrl = currentQuestion.imageUrl?.trim() || undefined;

  /**
   * Guess The Club answers as a 2×2 crest grid (Figma 233:299); every other
   * multiple-choice mode uses the stacked rows.
   */
  const useClubCardGrid = modeId === 'guess-club' && letteredChoices.length > 0;
  const isChoiceList =
    !useClubCardGrid &&
    (currentQuestion.type === 'mcq' ||
      currentQuestion.type === 'connections' ||
      currentQuestion.type === 'transfer' ||
      // Football Grid picks a PLAYER for the highlighted cell, from the same
      // stacked rows every other mode answers with — the board above shows
      // where that player would go.
      currentQuestion.type === 'grid');

  const renderChoiceList = (spacing: object) => (
    // The shared answer stack — same 12pt rhythm and same rows as every other
    // mode, Football Quiz included. See ./GameAnswerOption.
    // `visibleChoices`, not `letteredChoices`: a 50:50 hides options here by
    // not rendering them at all, rather than disabling them in place.
    <GameAnswerOptionList style={spacing as never}>
      {visibleChoices.map((option) => {
        const isSelected = selected.includes(option.id);
        const isCorrect = revealed && currentQuestion.correctAnswers.includes(option.id);
        const isWrong = revealed && isSelected && !isCorrect;
        /*
         * Transfer Puzzle answers are clubs and show a crest instead of a
         * letter badge (Figma 241:500); Football Grid's answers are players
         * and show their portrait the same way, because on a board mode the
         * face IS how you recognise the answer.
         */
        const showsEntityImage =
          currentQuestion.type === 'transfer' || currentQuestion.type === 'grid';

        return (
          <GameAnswerOption
            key={option.id}
            label={option.label}
            example={option.example}
            letter={showsEntityImage ? undefined : option.letter}
            crestUrl={option.imageUrl}
            showCrest={showsEntityImage}
            selected={isSelected}
            revealed={revealed}
            correct={isCorrect}
            wrong={isWrong}
            onPress={() => toggleSelection(option.id)}
          />
        );
      })}
    </GameAnswerOptionList>
  );

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: contentTopInset,
            paddingBottom:
              (actionBarHeight || metrics.s(GAME_LAYOUT.actionBarHeight)) + metrics.s(29),
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <GameScreenHeader
          title={headerTitle}
          onBack={() => router.back()}
          stats={<GlobalQuizStats />}
          backAccessibilityLabel={language === 'ar' ? 'رجوع' : 'Back'}
        />

        <GameProgressCard
          current={session.currentIndex + 1}
          total={session.totalQuestions}
          language={language}
        />

        <Animated.View style={questionEntrance}>
          <View style={styles.questionHeader}>
            <Text style={styles.questionTitle}>
              {currentQuestion.prompt || currentQuestion.title}
            </Text>
            {currentQuestion.subtitle ? (
              <Text style={styles.questionSubtitle}>{currentQuestion.subtitle}</Text>
            ) : null}
          </View>

          <QuestionHeroMedia
            uri={heroImageUrl}
            accessibilityLabel={currentQuestion.prompt || currentQuestion.title}
            contentFit={modeId === 'guess-club' ? 'contain' : 'cover'}
          />

          {showEvidence ? <EvidenceSection evidence={evidence} language={language} /> : null}

          {currentQuestion.type === 'bingo' && currentQuestion.board ? (
            <View style={styles.boardBlock}>
              <BingoBoard
                board={currentQuestion.board}
                selected={selected}
                onToggle={toggleSelection}
                disabled={revealed}
              />
            </View>
          ) : null}

          {/*
            FOOTBALL GRID — the whole 3×3 board, drawn on every question of the
            round because every question IS one of its cells. Cells fill in as
            the server accepts placements; the current cell is highlighted and
            the players to choose from are the option rows below.
          */}
          {currentQuestion.type === 'grid' &&
          currentQuestion.rowHeaders &&
          currentQuestion.colHeaders ? (
            <View style={styles.boardBlock}>
              <ConstraintGridBoard
                rowHeaders={currentQuestion.rowHeaders}
                colHeaders={currentQuestion.colHeaders}
                rowImages={gridRowImages}
                colImages={gridColImages}
                placements={gridPlacements}
                activeCell={currentQuestion.gridCell}
                rejectedCell={rejectedCell}
              />
            </View>
          ) : null}

          {currentQuestion.type === 'connections' && connectionPlayers.length > 0 ? (
            <View style={styles.boardBlock}>
              <ConnectionsPlayersGrid players={connectionPlayers} />
            </View>
          ) : null}

          {currentQuestion.type === 'transfer' && transferChain.length > 0 ? (
            <View style={styles.boardBlock}>
              <TransferPath chain={transferChain} />
            </View>
          ) : null}

          {/*
            TOP 10 — ten numbered inputs under the list's own heading. The
            player types names; the server matches them (spelling tolerance
            included) and only then are the real names shown.
          */}
          {currentQuestion.type === 'top10' && currentQuestion.top10 ? (
            <View style={styles.boardBlock}>
              <Text style={styles.top10Caption}>
                {currentQuestion.top10.seasonLabel
                  ? `${currentQuestion.top10.categoryLabel} · ${currentQuestion.top10.seasonLabel}`
                  : currentQuestion.top10.categoryLabel}
              </Text>
              <TopTenInputs
                slots={currentQuestion.top10.slots}
                entries={textEntries}
                onChangeEntry={setTextEntry}
                results={textResults}
                reveal={top10Reveal}
                disabled={revealed}
                placeholder={language === 'ar' ? 'اسم اللاعب' : 'Player name'}
              />
            </View>
          ) : null}

          {useClubCardGrid ? (
            <View style={showEvidence ? styles.cardsAfterEvidence : styles.boardBlock}>
              <ClubAnswerGrid
                options={visibleChoices}
                selected={selected}
                revealed={revealed}
                correctIds={currentQuestion.correctAnswers}
                onToggle={toggleSelection}
              />
            </View>
          ) : null}

          {isChoiceList
            ? renderChoiceList(
                showEvidence ? styles.optionsAfterEvidence : styles.optionsAfterBoard,
              )
            : null}

          {usedHint && currentQuestion.hint ? (
            <View style={styles.hintBanner}>
              <Lightbulb size={metrics.s(16)} color="#FDE68A" strokeWidth={2.2} />
              <Text style={styles.hintBannerText}>{currentQuestion.hint}</Text>
            </View>
          ) : null}

          {revealed ? (
            <View
              style={[
                styles.resultPill,
                lastAnswerCorrect ? styles.resultPillCorrect : styles.resultPillWrong,
              ]}
            >
              <Text style={styles.resultPillText}>
                {lastAnswerCorrect
                  ? language === 'ar'
                    ? 'إجابة صحيحة'
                    : 'Correct Answer'
                  : language === 'ar'
                    ? 'إجابة غير صحيحة'
                    : 'Wrong Answer'}
              </Text>
            </View>
          ) : null}
        </Animated.View>
      </ScrollView>

      {/*
        Figma Frame 174 — the same pinned bar every game mode uses.

        On a board that answers itself (`selection.autoSubmit`: Football Bingo's
        third cell, Football Grid's placement) there is nothing to confirm, so
        the primary button is not drawn until the answer has been revealed and
        it becomes "Next Question".
      */}
      <GameActionBar
        lifelines={lifelines}
        primaryLabel={primaryLabelFor(revealed, language)}
        onPrimary={
          revealed ? nextQuestion : isTextEntry ? submitTextEntries : () => submitAnswer()
        }
        primaryDisabled={!revealed && !canSubmit}
        showPrimary={revealed || !autoSubmits}
        onLayout={handleActionBarLayout}
        bottomInset={insets.bottom}
      />
    </View>
  );
}
