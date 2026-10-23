import { memo } from 'react';
import { Text, type StyleProp, type TextStyle } from 'react-native';
import { useLiveDisplayClock } from '../../hooks/useLiveDisplayClock';

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
 * Matches-list live minute (no MM:SS). Match details uses useLiveDisplayClock
 * with seconds enabled.
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

  return (
    <Text style={[style, inStoppage ? stoppageStyle : null]} numberOfLines={1}>
      {label}
    </Text>
  );
});
