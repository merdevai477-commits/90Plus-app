import { memo, useEffect } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useLiveDisplayClock } from '../../hooks/useLiveDisplayClock';
import {
  isClockBaselineEnabled,
  noteListMinute,
  noteListRowRender,
  noteLiveRowMounted,
} from '../../utils/clockBaseline';

type MatchListLiveClockProps = {
  fixtureId: string;
  statusShort?: string | null;
  elapsed?: number | null;
  extra?: number | null;
  fallbackLabel: string;
  inStoppage?: boolean;
  style?: StyleProp<TextStyle>;
  stoppageStyle?: StyleProp<TextStyle>;
};

/**
 * Matches-list live minute. Details uses the same minute-only label.
 *
 * Named distinctly from `liveMatchClock.ts` (pure MM:SS helpers) because Windows
 * is case-insensitive.
 */
export const MatchListLiveClock = memo(function MatchListLiveClock({
  fixtureId,
  statusShort,
  elapsed,
  extra,
  fallbackLabel,
  inStoppage,
  style,
  stoppageStyle,
}: MatchListLiveClockProps) {
  const label = useLiveDisplayClock({
    fixtureId,
    statusShort,
    elapsed,
    extra,
    fallbackLabel,
    showSeconds: false,
  });

  if (isClockBaselineEnabled()) {
    noteListRowRender();
    noteListMinute(fixtureId, label, elapsed);
  }

  useEffect(() => {
    if (!isClockBaselineEnabled()) return;
    return noteLiveRowMounted(fixtureId);
  }, [fixtureId]);

  return (
    <Text style={[style, inStoppage ? stoppageStyle : null]} numberOfLines={1}>
      {label}
    </Text>
  );
});
