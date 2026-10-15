import { useMemo } from 'react';
import {
  formatMatchTime,
  isLiveStoppage,
  resolveLiveMinuteLabel,
} from '../../components/Matches/leagueApiUtils';
import { isStaleInPlayClock } from '../../utils/staleMatchClock';
import { useAnchoredPeriodStart } from '../../hooks/useAnchoredPeriodStart';
import { useLiveDisplayClock } from '../../hooks/useLiveDisplayClock';

const LIVE_STATUSES = ['1H', '2H', 'ET', 'BT', 'P', 'LIVE', 'INT'];
const FINISHED_STATUSES = ['FT', 'AET', 'PEN'];
/** Terminal states with no meaningful score/live indicator. */
const NOT_PLAYED_STATUSES = ['CANC', 'PST', 'ABD', 'AWD', 'WO', 'TBD'];
/** Halted-but-resumable states — keep the score, drop the live pulse. */
const PAUSED_STATUSES = ['SUSP'];

export type MatchStatusLineInput = {
  /** Coarse status: 'live' | 'finished' | 'upcoming'. */
  status: string;
  statusShort?: string;
  elapsed?: number | null;
  stoppage?: number | null;
  startTimestamp?: number;
  clockAnchorKey?: string | number;
  fixtureDate?: string;
  time?: string;
  statusLabel?: string;
  halftimeLabel?: string;
  finishedLabel?: string;
  vsLabel?: string;
  liveLabel?: string;
  penaltiesShortLabel?: string;
  kickoffStatusLabel?: string;
};

/** Live clock + status text shared by the full scoreboard and the compact bar. */
export function useMatchStatusLine({
  status,
  statusShort,
  elapsed,
  stoppage,
  startTimestamp,
  clockAnchorKey,
  fixtureDate,
  time,
  statusLabel,
  halftimeLabel = 'HT',
  finishedLabel = 'FT',
  vsLabel = 'VS',
  liveLabel = 'LIVE',
  penaltiesShortLabel = 'Pens',
  kickoffStatusLabel,
}: MatchStatusLineInput) {
  const short = statusShort || '';
  const isHalftime = short === 'HT';
  const isNotPlayed = NOT_PLAYED_STATUSES.includes(short);
  const isPaused = PAUSED_STATUSES.includes(short);
  const staleLive = isStaleInPlayClock({
    statusShort: short,
    elapsed,
    extra: stoppage,
    kickoffIso: fixtureDate,
  });
  const isLive =
    !staleLive &&
    !isNotPlayed &&
    !isPaused &&
    (LIVE_STATUSES.includes(short) || (status === 'live' && !isHalftime));
  const isFinished =
    staleLive ||
    (!isNotPlayed &&
      (FINISHED_STATUSES.includes(short) || (status === 'finished' && !isPaused)));
  const isStoppage = isLive && isLiveStoppage(short, elapsed, stoppage);
  // Badge text for finished/paused/not-played states (falls back to English).
  const finishedBadgeText =
    statusLabel ||
    (short === 'AET' ? 'AET' : short === 'PEN' ? penaltiesShortLabel : finishedLabel);
  const specialBadgeText = statusLabel || short || '—';

  const kickoffTime = useMemo(() => {
    if (fixtureDate) return formatMatchTime(fixtureDate);
    return time || '--:--';
  }, [fixtureDate, time]);

  // Seconds tick only in open play. Stoppage, half-time and full time keep
  // the existing minute or status label.
  const clockActive = isLive && !isStoppage && !isHalftime;

  const anchoredStart = useAnchoredPeriodStart(
    clockAnchorKey,
    short,
    elapsed,
    startTimestamp,
  );

  const minuteLabel =
    resolveLiveMinuteLabel(short, elapsed, {
      startTimestamp: clockActive ? anchoredStart : undefined,
      extra: stoppage,
    }) ??
    (isLive ? short || liveLabel : '');

  const liveClock = useLiveDisplayClock({
    fixtureId: clockAnchorKey != null ? String(clockAnchorKey) : '',
    statusShort: short,
    elapsed,
    extra: stoppage,
    fallbackLabel: minuteLabel,
  });

  const statusLine = isLive
    ? (clockActive ? liveClock : minuteLabel)
    : isFinished
    ? finishedBadgeText
    : isHalftime
    ? halftimeLabel
    : isNotPlayed || isPaused
    ? specialBadgeText
    : (kickoffStatusLabel || kickoffTime || vsLabel);

  return {
    short,
    isLive,
    isFinished,
    isHalftime,
    isStoppage,
    isNotPlayed,
    isPaused,
    statusLine,
    minuteLabel,
    kickoffTime,
  };
}
