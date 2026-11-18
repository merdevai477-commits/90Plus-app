/**
 * Monthly ranking — Figma Frame123 nodes 2022:6591 / 2022:6507 / 2022:6332.
 * Countdown + podium + participants 4–7 + load-more CTA.
 */

import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import { useTranslation } from '../../../src/i18n';
import type { ShareWinLeaderboardEntry } from '../../../services/shareWin.service';
import { SW_ASSET } from '../assets';
import { displayNameOf, formatNumber, splitCountdown } from '../data';
import { useShareWinStyles } from '../styles';
import Podium from './Podium';

interface WeeklyRankingCardProps {
  entries: ShareWinLeaderboardEntry[];
  cycleEndAt: string;
  onViewFullRanking: () => void;
}

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

const WeeklyRankingCard = memo(function WeeklyRankingCard({
  entries,
  cycleEndAt,
  onViewFullRanking,
}: WeeklyRankingCardProps) {
  const { metrics, theme } = useShareWinStyles();
  const { t, language } = useTranslation();
  const copy = t.shareWin;
  const countdown = useCountdown(cycleEndAt);
  const { s, f } = metrics;

  const top3 = entries.filter((e) => e.rank <= 3).slice(0, 3);
  const rest = entries.filter((e) => e.rank >= 4).slice(0, 4);

  const styles = useMemo(
    () =>
      StyleSheet.create({
        section: {
          width: '100%',
          gap: s(22),
        },
        header: {
          width: '100%',
          gap: s(8),
          alignItems: 'flex-end',
        },
        title: {
          fontSize: f(20),
          fontWeight: '700',
          color: theme.dark,
          textAlign: 'right',
          width: '100%',
        },
        subtitle: {
          fontSize: f(12),
          fontWeight: '600',
          color: theme.muted,
          textAlign: 'right',
          width: '100%',
        },
        body: {
          width: '100%',
          gap: s(31),
          alignItems: 'center',
        },
        countdown: {
          width: '100%',
          height: s(152),
          borderRadius: s(20),
          borderWidth: 1,
          borderColor: 'rgba(255,255,255,0.25)',
          padding: s(16),
          gap: s(8),
          alignItems: 'center',
          shadowColor: '#4D40CC',
          shadowOffset: { width: 0, height: 5 },
          shadowOpacity: 0.14,
          shadowRadius: 8,
          elevation: 4,
        },
        countdownHead: {
          width: '100%',
          height: s(22),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        countdownTitle: {
          flex: 1,
          fontSize: f(13),
          fontWeight: '600',
          color: theme.white,
          textAlign: 'right',
        },
        units: {
          width: '100%',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        unit: {
          width: s(72),
          height: s(90),
          alignItems: 'center',
          gap: s(4),
        },
        digit: {
          width: s(72),
          height: s(72),
          borderRadius: s(12),
          backgroundColor: 'rgba(255,255,255,0.2)',
          alignItems: 'center',
          justifyContent: 'center',
        },
        digitText: {
          fontSize: f(40),
          fontWeight: '600',
          color: theme.white,
          textAlign: 'center',
        },
        unitLabel: {
          fontSize: f(10),
          fontWeight: '600',
          color: 'rgba(255,255,255,0.96)',
          textAlign: 'center',
        },
        colon: {
          width: s(8),
          height: s(28),
        },
        listCard: {
          width: '100%',
          borderRadius: s(20),
          backgroundColor: theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          paddingHorizontal: s(14),
          paddingVertical: s(21),
          gap: s(8),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.12,
          shadowRadius: 2,
          elevation: 2,
        },
        listHead: {
          width: '100%',
          height: s(30),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        rangeBadge: {
          width: s(86),
          height: s(24),
          borderRadius: s(12),
          backgroundColor: theme.pale,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rangeText: {
          fontSize: f(9),
          fontWeight: '600',
          color: theme.dark,
          textAlign: 'center',
        },
        listTitle: {
          fontSize: f(16),
          fontWeight: '600',
          color: theme.ink,
          textAlign: 'right',
        },
        row: {
          width: '100%',
          height: s(62),
          borderRadius: s(16),
          backgroundColor: theme.rowBg,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: s(10),
          paddingVertical: s(8),
        },
        pointsCol: {
          width: s(70),
          alignItems: 'center',
          justifyContent: 'center',
        },
        pointsValue: {
          fontSize: f(20),
          fontWeight: '700',
          color: theme.primary,
          textAlign: 'center',
        },
        pointsUnit: {
          fontSize: f(10),
          color: theme.muted,
          textAlign: 'center',
        },
        userCol: {
          flex: 1,
          alignItems: 'flex-end',
          paddingHorizontal: s(8),
          gap: 1,
        },
        userName: {
          fontSize: f(11),
          fontWeight: '600',
          color: theme.ink,
          textAlign: 'right',
        },
        userScore: {
          fontSize: f(9),
          color: theme.dark,
          textAlign: 'right',
        },
        avatar: {
          width: s(40),
          height: s(40),
          borderRadius: s(20),
          backgroundColor: theme.avatarBg,
          alignItems: 'center',
          justifyContent: 'center',
        },
        avatarLetter: {
          fontSize: f(14),
          color: theme.primary,
          textAlign: 'center',
        },
        rankBadge: {
          width: s(30),
          height: s(30),
          borderRadius: s(15),
          backgroundColor: theme.pale,
          alignItems: 'center',
          justifyContent: 'center',
        },
        rankText: {
          fontSize: f(11),
          fontWeight: '600',
          color: theme.dark,
          textAlign: 'center',
        },
        cta: {
          width: '100%',
          height: s(52),
          borderRadius: s(15),
          backgroundColor: theme.primary,
          borderWidth: 1,
          borderColor: theme.light,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(8),
          marginTop: s(4),
        },
        ctaText: {
          fontSize: f(12),
          fontWeight: '600',
          color: theme.white,
          textAlign: 'center',
        },
        empty: {
          fontSize: f(13),
          color: theme.muted,
          textAlign: 'center',
          paddingVertical: s(16),
        },
      }),
    [f, s, theme],
  );

  const units = [
    { value: countdown.days, label: copy.unitDays },
    { value: countdown.hours, label: copy.unitHours },
    { value: countdown.minutes, label: copy.unitMinutes },
    { value: countdown.seconds, label: copy.unitSeconds },
  ];

  return (
    <View style={styles.section}>
      <View style={styles.header}>
        <Text style={styles.title} accessibilityRole="header">
          {copy.weeklyTitle}
        </Text>
        <Text style={styles.subtitle}>{copy.weeklySubtitle}</Text>
      </View>

      <View style={styles.body}>
        <LinearGradient
          colors={[...theme.countdownGradient]}
          locations={[0, 0.48, 1]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={styles.countdown}
        >
          <View style={styles.countdownHead}>
            <Text style={styles.countdownTitle}>{copy.countdownRemaining}</Text>
            <Image
              source={SW_ASSET.clockV2}
              style={{ width: s(18), height: s(18) }}
              contentFit="contain"
              transition={0}
            />
          </View>
          <View style={styles.units}>
            {units.map((unit, index) => (
              <React.Fragment key={unit.label}>
                {index > 0 ? (
                  <Image
                    source={SW_ASSET.colonDots}
                    style={styles.colon}
                    contentFit="contain"
                    transition={0}
                  />
                ) : null}
                <View style={styles.unit}>
                  <View style={styles.digit}>
                    <Text style={styles.digitText}>{unit.value}</Text>
                  </View>
                  <Text style={styles.unitLabel}>{unit.label}</Text>
                </View>
              </React.Fragment>
            ))}
          </View>
        </LinearGradient>

        {top3.length > 0 ? <Podium entries={top3} /> : null}

        <View style={styles.listCard}>
          <View style={styles.listHead}>
            <View style={styles.rangeBadge}>
              <Text style={styles.rangeText}>{copy.participantsRange}</Text>
            </View>
            <Text style={styles.listTitle}>{copy.participantsTitle}</Text>
          </View>

          {rest.length === 0 ? (
            <Text style={styles.empty}>{copy.leaderboardEmpty}</Text>
          ) : (
            rest.map((entry) => {
              const name = displayNameOf(entry);
              const letter = (name || '?').charAt(0).toUpperCase();
              return (
                <View key={entry.userId} style={styles.row}>
                  <View style={styles.pointsCol}>
                    <Text style={styles.pointsValue}>
                      {formatNumber(entry.participants, language)}
                    </Text>
                    <Text style={styles.pointsUnit}>{copy.friendsUnit}</Text>
                  </View>
                  <View style={styles.userCol}>
                    <Text style={styles.userName} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={styles.userScore}>
                      {`${formatNumber(entry.score, language)} ${copy.pointsLabel}`}
                    </Text>
                  </View>
                  <View style={styles.avatar}>
                    {entry.avatar ? (
                      <Image
                        source={{ uri: entry.avatar }}
                        style={{ width: s(40), height: s(40), borderRadius: s(20) }}
                        contentFit="cover"
                        transition={120}
                      />
                    ) : (
                      <Text style={styles.avatarLetter}>{letter}</Text>
                    )}
                  </View>
                  <View style={styles.rankBadge}>
                    <Text style={styles.rankText}>{entry.rank}</Text>
                  </View>
                </View>
              );
            })
          )}

          <Pressable
            style={styles.cta}
            onPress={onViewFullRanking}
            accessibilityRole="button"
            accessibilityLabel={copy.viewMoreParticipants}
          >
            <Text style={styles.ctaText}>{copy.viewMoreParticipants}</Text>
            <Image
              source={SW_ASSET.chevronDownV2}
              style={{ width: s(18), height: s(18) }}
              contentFit="contain"
              transition={0}
            />
          </Pressable>
        </View>
      </View>
    </View>
  );
});

export default WeeklyRankingCard;
