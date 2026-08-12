/**
 * Weekly ranking card — Figma node 147:312.
 *
 * Countdown to the end of the current cycle, the top five standings, and the
 * "view full ranking" pill. Every number comes from the backend; the countdown
 * is the only thing computed locally, and only from the server's `endAt`.
 */

import React, { memo, useEffect, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinLeaderboardEntry } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { displayNameOf, formatNumber, splitCountdown } from '../data';
import { SW_GRADIENT, useShareWinStyles } from '../styles';
import LeaderboardRow from './LeaderboardRow';

interface WeeklyRankingCardProps {
  entries: ShareWinLeaderboardEntry[];
  /** Server-provided end of the current cycle (ISO). */
  cycleEndAt: string;
  onViewFullRanking: () => void;
}

/** Ticks once a second, but only derives from the server's cycle end. */
function useCountdown(cycleEndAt: string) {
  const [remaining, setRemaining] = useState(() =>
    Math.max(0, new Date(cycleEndAt).getTime() - Date.now()),
  );

  useEffect(() => {
    const target = new Date(cycleEndAt).getTime();
    const tick = () => setRemaining(Math.max(0, target - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cycleEndAt]);

  return splitCountdown(remaining);
}

function CountdownBox({ value, label }: { value: string; label: string }) {
  const { sw } = useShareWinStyles();
  return (
    <View style={sw.countdownBox}>
      <LinearGradient
        colors={SW_GRADIENT.tile}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 }}
      />
      <Text style={sw.countdownValue}>{value}</Text>
      <Text style={sw.countdownLabel}>{label}</Text>
    </View>
  );
}

const WeeklyRankingCard = memo(function WeeklyRankingCard({
  entries,
  cycleEndAt,
  onViewFullRanking,
}: WeeklyRankingCardProps) {
  const { sw, metrics } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const countdown = useCountdown(cycleEndAt);
  const { s } = metrics;

  return (
    <View style={[sw.card, sw.weeklyCard]}>
      <View style={sw.weeklyInner}>
        <View style={sw.weeklyHeader}>
          <View style={sw.weeklyTitleGroup}>
            <Text style={sw.cardTitle}>{copy.weeklyTitle}</Text>
            <Text style={sw.weeklyEndsIn}>{copy.weeklyEndsIn}</Text>
          </View>

          <View style={sw.countdownRow}>
            <CountdownBox value={countdown.days} label={copy.unitDays} />
            <CountdownBox value={countdown.hours} label={copy.unitHours} />
            <CountdownBox value={countdown.minutes} label={copy.unitMinutes} />
            <CountdownBox value={countdown.seconds} label={copy.unitSeconds} />
          </View>
        </View>

        <View style={sw.boardList}>
          {entries.length === 0 ? (
            <Text style={sw.boardEmpty}>{copy.leaderboardEmpty}</Text>
          ) : (
            entries.map((entry, index) => (
              <LeaderboardRow
                key={entry.userId}
                rank={entry.rank}
                userId={entry.userId}
                username={entry.username}
                name={displayNameOf(entry)}
                avatar={entry.avatar}
                scoreLabel={formatNumber(entry.score, language)}
                tierIndex={index}
              />
            ))
          )}
        </View>
      </View>

      <Pressable
        style={sw.fullRankingCta}
        onPress={onViewFullRanking}
        accessibilityRole="button"
        accessibilityLabel={copy.viewFullRanking}
      >
        <Text style={sw.fullRankingText}>{copy.viewFullRanking}</Text>
        <Image
          source={SW_ASSET.chevronRight}
          style={{ width: s(24), height: s(24) }}
          contentFit="contain"
          transition={0}
        />
      </Pressable>
    </View>
  );
});

export default WeeklyRankingCard;
