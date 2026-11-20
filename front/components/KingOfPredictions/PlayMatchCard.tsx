import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import type { Match } from '../Matches/matchCardUtils';
import type { KingPlayTheme } from './playTheme';

export type CardPick = 'home' | 'draw' | 'away';
export type CardPhase =
  | 'open'
  | 'predicted'
  | 'waiting'
  | 'correct'
  | 'wrong'
  | 'missed'
  | 'none'
  | 'postponed';

type Props = {
  match: Match;
  index: number;
  isGame: boolean;
  theme: KingPlayTheme;
  phase: CardPhase;
  pick: CardPick | null;
  homeScore: string;
  awayScore: string;
  homeName: string;
  awayName: string;
  pickLabel: string | null;
  fonts: { bold: string; semi: string; medium: string; regular: string };
  copy: {
    predictNow: string;
    predicted: string;
    waitingEnd: string;
    predictionEnded: string;
    notPredicted: string;
    postponed: string;
    matchStarts: string;
    matchStarted: string;
    matchEnded: string;
    yourPick: string;
    draw: string;
    winOf: string;
    predictedWin: string;
    predictedDraw: string;
    vs: string;
  };
  locked: boolean;
  onPress: () => void;
};

function padIndex(index: number) {
  return String(index + 1).padStart(2, '0');
}

function statusLook(phase: CardPhase, theme: KingPlayTheme, copy: Props['copy']) {
  switch (phase) {
    case 'predicted':
      return { bg: theme.badgeDoneBg, text: theme.badgeDoneText, label: copy.predicted };
    case 'waiting':
      return { bg: theme.badgeWaitBg, text: theme.badgeWaitText, label: copy.waitingEnd };
    case 'postponed':
      return { bg: theme.badgeWaitBg, text: theme.badgeWaitText, label: copy.postponed };
    case 'correct':
    case 'wrong':
    case 'none':
      return { bg: theme.badgeEndedBg, text: theme.badgeEndedText, label: copy.predictionEnded };
    case 'missed':
      return { bg: theme.badgeMissBg, text: theme.badgeMissText, label: copy.notPredicted };
    default:
      return { bg: theme.badgePredictBg, text: theme.badgePredictText, label: copy.predictNow };
  }
}

function pickBadgeLook(phase: CardPhase, theme: KingPlayTheme) {
  if (phase === 'waiting' || phase === 'postponed') {
    return { bg: theme.badgeWaitBg, text: theme.badgeWaitText, icon: 'time' as const };
  }
  if (phase === 'correct') return { bg: theme.badgeCorrectBg, text: theme.badgeCorrectText, icon: 'checkmark' as const };
  if (phase === 'wrong') return { bg: theme.badgeWrongBg, text: theme.badgeWrongText, icon: 'close' as const };
  return { bg: theme.badgeNoneBg, text: theme.badgeNoneText, icon: 'close' as const };
}

export function PlayMatchCard({
  match,
  index,
  isGame,
  theme,
  phase,
  pick,
  homeScore,
  awayScore,
  homeName,
  awayName,
  pickLabel,
  fonts,
  copy,
  locked,
  onPress,
}: Props) {
  const status = statusLook(phase, theme, copy);
  const settled =
    phase === 'waiting' ||
    phase === 'correct' ||
    phase === 'wrong' ||
    phase === 'none' ||
    phase === 'postponed';
  const errorBorder = phase === 'missed';
  const liveMinute = match.elapsed != null ? `${match.elapsed}’` : null;
  const borderColor = errorBorder
    ? theme.errorBorder
    : theme.isDark
      ? theme.cardBorder
      : '#E5E0F5';
  const borderWidth = errorBorder ? 1 : theme.isDark ? (theme.cardBorder === 'transparent' ? 0 : 1) : 1;

  const timeLine = useMemo(() => {
    if (phase === 'postponed') {
      return { color: theme.badgeWaitText, text: copy.postponed, minute: null as string | null };
    }
    if (phase === 'waiting') {
      return { color: theme.primary, text: copy.matchStarted, minute: liveMinute };
    }
    if (phase === 'correct' || phase === 'wrong' || phase === 'none') {
      return { color: theme.muted, text: copy.matchEnded, minute: null as string | null };
    }
    return {
      color: theme.time,
      text: `${copy.matchStarts} ${match.time || ''}`.trim(),
      minute: null as string | null,
    };
  }, [copy, liveMinute, match.time, phase, theme]);

  const actualScore =
    match.score.home != null && match.score.away != null
      ? `${match.score.home} - ${match.score.away}`
      : '0 - 0';

  const resultCaption = useMemo(() => {
    if (isGame || homeScore === '' || awayScore === '') return null;
    const home = Number(homeScore);
    const away = Number(awayScore);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
    if (home === away) return copy.predictedDraw.replace('{home}', homeName).replace('{away}', awayName);
    if (home > away) return copy.predictedWin.replace('{team}', homeName);
    return copy.predictedWin.replace('{team}', awayName);
  }, [awayName, awayScore, copy.predictedDraw, copy.predictedWin, homeName, homeScore, isGame]);

  const winnerSide: 'home' | 'away' | 'draw' | null = useMemo(() => {
    if (isGame) return pick;
    if (homeScore === '' || awayScore === '') return null;
    const home = Number(homeScore);
    const away = Number(awayScore);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
    if (home === away) return 'draw';
    return home > away ? 'home' : 'away';
  }, [awayScore, homeScore, isGame, pick]);

  return (
    <Pressable
      disabled={locked && settled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor,
          borderWidth,
          shadowColor: theme.cardShadow,
          opacity: pressed && !locked ? 0.92 : 1,
        },
      ]}
    >
      <View style={styles.header}>
        <View style={[styles.badge, { backgroundColor: status.bg }]}>
          <Text style={[styles.badgeText, { color: status.text, fontFamily: fonts.semi }]} numberOfLines={1}>
            {status.label}
          </Text>
        </View>
        <View style={styles.timeWrap}>
          <View style={styles.timeTexts}>
            {timeLine.minute ? (
              <Text style={[styles.minute, { color: theme.muted, fontFamily: fonts.semi }]}>{timeLine.minute}</Text>
            ) : null}
            <Text style={[styles.time, { color: timeLine.color, fontFamily: fonts.semi }]} numberOfLines={1}>
              {timeLine.text}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: theme.divider }]} />
          <Text style={[styles.matchNo, { color: theme.matchNumber, fontFamily: fonts.semi }]}>{padIndex(index)}</Text>
        </View>
      </View>

      {settled ? (
        <View style={styles.settledRow}>
          <TeamBlock logo={match.homeTeam.logo} name={null} size={54} />
          <View style={styles.settledMid}>
            {phase === 'postponed' ? (
              <Text style={[styles.scoreBig, { color: theme.badgeWaitText, fontFamily: fonts.semi }]}>{copy.postponed}</Text>
            ) : (
              <Text style={[styles.scoreBig, { color: theme.scoreLine, fontFamily: fonts.semi }]}>{actualScore}</Text>
            )}
            <Text style={[styles.yourPickLabel, { color: theme.muted, fontFamily: fonts.regular }]}>{copy.yourPick}</Text>
            <View style={[styles.pickChip, { backgroundColor: pickBadgeLook(phase, theme).bg }]}>
              <Text
                style={[styles.pickChipText, { color: pickBadgeLook(phase, theme).text, fontFamily: fonts.semi }]}
                numberOfLines={1}
              >
                {pickLabel ?? copy.notPredicted}
              </Text>
              <Ionicons name={pickBadgeLook(phase, theme).icon} size={10} color={pickBadgeLook(phase, theme).text} />
            </View>
          </View>
          <TeamBlock logo={match.awayTeam.logo} name={null} size={54} />
        </View>
      ) : (
        <>
          <View style={styles.teamsRow}>
            <TeamBlock
              logo={match.homeTeam.logo}
              name={!isGame ? homeName : null}
              size={44}
              nameColor={theme.ink}
              font={fonts.semi}
            />
            <Text style={[styles.vs, { color: theme.vs, fontFamily: fonts.semi }]}>{copy.vs}</Text>
            <TeamBlock
              logo={match.awayTeam.logo}
              name={!isGame ? awayName : null}
              size={44}
              nameColor={theme.ink}
              font={fonts.semi}
            />
          </View>

          {isGame ? (
            <View style={styles.choices}>
              <Choice
                label={copy.winOf.replace('{team}', homeName)}
                selected={winnerSide === 'home'}
                theme={theme}
                font={fonts.semi}
              />
              <Choice
                label={copy.draw}
                selected={winnerSide === 'draw'}
                theme={theme}
                font={fonts.semi}
                showX
              />
              <Choice
                label={copy.winOf.replace('{team}', awayName)}
                selected={winnerSide === 'away'}
                theme={theme}
                font={fonts.semi}
              />
            </View>
          ) : (
            <View style={styles.scoreBlock}>
              <View style={styles.scoreRow}>
                <ScoreBox
                  value={homeScore}
                  theme={theme}
                  font={fonts.bold}
                  filled={winnerSide === 'home' || winnerSide === 'draw'}
                />
                <Text style={[styles.colon, { color: theme.muted, fontFamily: fonts.semi }]}>:</Text>
                <ScoreBox
                  value={awayScore}
                  theme={theme}
                  font={fonts.bold}
                  filled={winnerSide === 'away' || winnerSide === 'draw'}
                />
              </View>
              {resultCaption ? (
                <Text style={[styles.scoreCaption, { color: theme.scoreCaption, fontFamily: fonts.medium }]}>
                  {resultCaption}
                </Text>
              ) : null}
            </View>
          )}
        </>
      )}
    </Pressable>
  );
}

function TeamBlock({
  logo,
  name,
  size,
  nameColor,
  font,
}: {
  logo?: string;
  name: string | null;
  size: number;
  nameColor?: string;
  font?: string;
}) {
  return (
    <View style={[styles.team, { width: 116 }]}>
      {logo ? (
        <Image
          source={{ uri: logo }}
          style={{ width: size, height: size }}
          contentFit="contain"
          cachePolicy="memory-disk"
          recyclingKey={logo}
        />
      ) : (
        <View style={{ width: size, height: size }} />
      )}
      {name ? (
        <Text style={[styles.teamName, { color: nameColor, fontFamily: font }]} numberOfLines={1}>
          {name}
        </Text>
      ) : null}
    </View>
  );
}

function Choice({
  label,
  selected,
  theme,
  font,
  showX,
}: {
  label: string;
  selected: boolean;
  theme: KingPlayTheme;
  font: string;
  showX?: boolean;
}) {
  return (
    <View
      style={[
        styles.choice,
        {
          backgroundColor: selected ? theme.choiceOnBg : theme.choiceIdleBg,
          borderColor: selected ? theme.choiceOnBg : theme.choiceIdleBorder,
        },
      ]}
    >
      <Text
        style={[styles.choiceText, { color: selected ? theme.choiceOnText : theme.choiceIdleText, fontFamily: font }]}
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.7}
      >
        {label}
      </Text>
      {showX ? (
        <Ionicons name="close" size={14} color={selected ? theme.choiceOnText : theme.choiceIdleText} />
      ) : null}
    </View>
  );
}

function ScoreBox({
  value,
  theme,
  font,
  filled,
}: {
  value: string;
  theme: KingPlayTheme;
  font: string;
  filled: boolean;
}) {
  return (
    <View
      style={[
        styles.scoreBox,
        {
          backgroundColor: filled && value !== '' ? theme.scoreOnBg : theme.scoreIdleBg,
        },
      ]}
    >
      <Text
        style={[
          styles.scoreText,
          {
            color: filled && value !== '' ? theme.scoreOnText : theme.scoreIdleText,
            fontFamily: font,
          },
        ]}
      >
        {value || '-'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 17,
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
    shadowOpacity: 0.18,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 2,
    direction: 'ltr',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  badge: {
    height: 19,
    paddingHorizontal: 10,
    borderRadius: 34,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: { fontSize: 10 },
  timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  timeTexts: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  time: { fontSize: 10 },
  minute: { fontSize: 8 },
  divider: { width: 1, height: 15 },
  matchNo: { fontSize: 12 },
  teamsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  team: { alignItems: 'center', justifyContent: 'center', gap: 4 },
  teamName: { fontSize: 12, textAlign: 'center' },
  vs: { fontSize: 24 },
  choices: { flexDirection: 'row', gap: 5 },
  choice: {
    flex: 1,
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  choiceText: { fontSize: 13, textAlign: 'center' },
  scoreBlock: { alignItems: 'center', gap: 8 },
  scoreRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  scoreBox: {
    width: 72,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreText: { fontSize: 22, textAlign: 'center' },
  colon: { fontSize: 22 },
  scoreCaption: { fontSize: 12, textAlign: 'center' },
  settledRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 85,
  },
  settledMid: { alignItems: 'center', gap: 2, minWidth: 94 },
  scoreBig: { fontSize: 24 },
  yourPickLabel: { fontSize: 10 },
  pickChip: {
    marginTop: 2,
    height: 21,
    borderRadius: 24,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  pickChipText: { fontSize: 10 },
});
