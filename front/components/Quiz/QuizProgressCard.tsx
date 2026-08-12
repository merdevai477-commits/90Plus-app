/**
 * QuizProgressCard — the Football Quiz screen's "Question X of Y" card
 * (Figma node 238:374).
 *
 * The card itself is the shared one from ./gameChrome.tsx, so it is pixel-
 * identical to every other game mode. This wrapper adds the two things that are
 * specific to this screen: absolute positioning under the header, and the
 * silent question countdown.
 *
 * JUDGMENT CALL: Figma shows no visible countdown digit anywhere on this screen.
 * The underlying countdown/timeout functionality (`handleTimeout` via
 * `onTimeUp`) is still required by QuizHubScreen's business logic, so the timer
 * keeps running internally here — it is just not rendered.
 */

import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { useDesignScale } from '../../utils/responsive';
import { GAME_LAYOUT, GameProgressCard } from './gameChrome';

interface QuizProgressCardProps {
  current: number;
  total: number;
  /** Unused visually (Figma has no progress bar) — retained for prop-compat. */
  progress?: number;
  /** Unused: the shared card builds its own bilingual label. */
  questionLabel?: string;
  /** Changes when the active question changes — resets the timer. */
  timerKey: string;
  /** Bumped when a timeout submit fails so the countdown can fire again. */
  timerRetryEpoch?: number;
  timerActive: boolean;
  timeLimitSec: number;
  onTimeUp: () => void;
  /** Safe-area top inset; the card is placed relative to it when pinned. */
  topInset: number;
  /**
   * `true` (default) keeps the historical absolute placement under the header.
   * `false` renders the card IN FLOW directly beneath an in-flow QuizHeader,
   * inside the screen's ScrollView, so it scrolls with the content like every
   * other mode's counter. The shared card already carries the 52pt Figma gap
   * (`headerToProgress`) in its own `marginTop`, so the rhythm is identical.
   */
  pinned?: boolean;
}

function QuizProgressCardInner({
  current,
  total,
  timerKey,
  timerRetryEpoch = 0,
  timerActive,
  timeLimitSec,
  onTimeUp,
  topInset,
  pinned = true,
}: QuizProgressCardProps) {
  const { language } = useTranslation();
  const { s } = useDesignScale();
  const secondsRef = useRef(timeLimitSec);
  const onTimeUpRef = useRef(onTimeUp);
  const firedRef = useRef(false);
  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    secondsRef.current = timeLimitSec;
    firedRef.current = false;
  }, [timerKey, timeLimitSec]);

  useEffect(() => {
    firedRef.current = false;
  }, [timerRetryEpoch]);

  useEffect(() => {
    if (!timerActive) return;
    const interval = setInterval(() => {
      secondsRef.current = secondsRef.current <= 1 ? 0 : secondsRef.current - 1;
      if (secondsRef.current === 0 && !firedRef.current) {
        firedRef.current = true;
        onTimeUpRef.current();
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [timerKey, timerActive]);

  /**
   * Header top + header height. The shared card contributes the 52pt gap to the
   * header itself (`headerToProgress`), so it is not added again here.
   */
  const placement = useMemo(
    () => ({
      top: topInset + s(GAME_LAYOUT.contentTop) + s(GAME_LAYOUT.headerHeight),
      left: s(GAME_LAYOUT.gutter),
      right: s(GAME_LAYOUT.gutter),
    }),
    [topInset, s],
  );

  return (
    <View style={pinned ? [styles.wrap, placement] : undefined}>
      <GameProgressCard current={current} total={total} language={language} />
    </View>
  );
}

export const QuizProgressCard = React.memo(QuizProgressCardInner);

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    zIndex: 21,
  },
});
