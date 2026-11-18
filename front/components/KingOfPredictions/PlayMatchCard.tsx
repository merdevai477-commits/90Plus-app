import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

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
  | 'none';

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
  onPick: (pick: CardPick) => void;
  onHomeScore: (value: string) => void;
  onAwayScore: (value: string) => void;
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
  if (phase === 'waiting') return { bg: theme.badgeWaitBg, text: theme.badgeWaitText, icon: 'time' as const };
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
  onPick,
  onHomeScore,
  onAwayScore,
}: Props) {
  const status = statusLook(phase, theme, copy);
  const settled = phase === 'waiting' || phase === 'correct' || phase === 'wrong' || phase === 'none';
  const showChoices = isGame && !settled;
  const showScores = !isGame && !settled;
  const errorBorder = phase === 'missed';
  const liveMinute = match.elapsed != null ? `${match.elapsed}’` : null;

  const timeLine = useMemo(() => {
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
  }, [copy, liveMinute, match.time, phase, theme.muted, theme.primary, theme.time]);

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
    if (isGame || homeScore === '' || awayScore === '') return null;
    const home = Number(homeScore);
    const away = Number(awayScore);
    if (!Number.isFinite(home) || !Number.isFinite(away)) return null;
    if (home === away) return 'draw';
    return home > away ? 'home' : 'away';
  }, [awayScore, homeScore, isGame]);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: theme.card,
          borderColor: errorBorder ? theme.errorBorder : theme.cardBorder,
          borderWidth: errorBorder ? 1 : theme.cardBorder === 'transparent' ? 0 : 1,
          shadowColor: theme.cardShadow,
          // Figma cards are laid out LTR (home left, badge left) even on Arabic screens.
          direction: 'ltr',
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
            <Text style={[styles.scoreBig, { color: theme.scoreLine, fontFamily: fonts.semi }]}>{actualScore}</Text>
            <Text style={[styles.yourPickLabel, { color: theme.muted, fontFamily: fonts.regular }]}>{copy.yourPick}</Text>
            <View
              style={[
                styles.pickChip,
                { backgroundColor: pickBadgeLook(phase, theme).bg },
              ]}
            >
              <Text
                style={[styles.pickChipText, { color: pickBadgeLook(phase, theme).text, fontFamily: fonts.semi }]}
                numberOfLines={1}
              >
                {pickLabel ?? copy.notPredicted}
              </Text>
              <Ionicons
                name={pickBadgeLook(phase, theme).icon}
                size={10}
                color={pickBadgeLook(phase, theme).text}
              />
            </View>
          </View>
          <TeamBlock logo={match.awayTeam.logo} name={null} size={54} />
        </View>
      ) : (
        <>
          <View style={styles.teamsRow}>
            <TeamBlock logo={match.homeTeam.logo} name={!isGame ? homeName : null} size={44} nameColor={theme.ink} font={fonts.semi} />
            <Text style={[styles.vs, { color: theme.vs, fontFamily: fonts.semi }]}>{copy.vs}</Text>
            <TeamBlock logo={match.awayTeam.logo} name={!isGame ? awayName : null} size={44} nameColor={theme.ink} font={fonts.semi} />
          </View>

          {showChoices ? (
            <View style={styles.choices}>
              <Choice
                label={copy.winOf.replace('{team}', homeName)}
                selected={pick === 'home'}
                disabled={locked}
                theme={theme}
                font={fonts.semi}
                onPress={() => onPick('home')}
              />
              <Choice
                label={copy.draw}
                selected={pick === 'draw'}
                disabled={locked}
                theme={theme}
                font={fonts.semi}
                showX
                onPress={() => onPick('draw')}
              />
              <Choice
                label={copy.winOf.replace('{team}', awayName)}
                selected={pick === 'away'}
                disabled={locked}
                theme={theme}
                font={fonts.semi}
                onPress={() => onPick('away')}
              />
            </View>
          ) : null}

          {showScores ? (
            <View style={styles.scoreBlock}>
              <View style={styles.scoreRow}>
                <ScoreBox
                  value={homeScore}
                  onChange={onHomeScore}
                  theme={theme}
                  font={fonts.bold}
                  locked={locked}
                  filled={winnerSide === 'home' || winnerSide === 'draw'}
                  focusedHint={false}
                />
                <Text style={[styles.colon, { color: theme.muted, fontFamily: fonts.semi }]}>:</Text>
                <ScoreBox
                  value={awayScore}
                  onChange={onAwayScore}
                  theme={theme}
                  font={fonts.bold}
                  locked={locked}
                  filled={winnerSide === 'away' || winnerSide === 'draw'}
                  focusedHint={false}
                />
              </View>
              {resultCaption ? (
                <Text style={[styles.scoreCaption, { color: theme.scoreCaption, fontFamily: fonts.medium }]}>
                  {resultCaption}
                </Text>
              ) : null}
            </View>
          ) : null}
        </>
      )}
    </View>
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
        <Image source={{ uri: logo }} style={{ width: size, height: size }} contentFit="contain" />
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
  disabled,
  theme,
  font,
  showX,
  onPress,
}: {
  label: string;
  selected: boolean;
  disabled: boolean;
  theme: KingPlayTheme;
  font: string;
  showX?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        {
          backgroundColor: selected ? theme.choiceOnBg : theme.choiceIdleBg,
          borderColor: selected ? theme.choiceOnBg : theme.choiceIdleBorder,
          opacity: disabled && !selected ? 0.55 : 1,
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
    </Pressable>
  );
}

function ScoreBox({
  value,
  onChange,
  theme,
  font,
  locked,
  filled,
}: {
  value: string;
  onChange: (next: string) => void;
  theme: KingPlayTheme;
  font: string;
  locked: boolean;
  filled: boolean;
  focusedHint: boolean;
}) {
  return (
    <View
      style={[
        styles.scoreBox,
        {
          backgroundColor: filled && value !== '' ? theme.scoreOnBg : theme.scoreIdleBg,
          borderColor: theme.scoreFocusBorder,
          borderWidth: 0,
        },
      ]}
    >
      <TextInput
        value={value}
        editable={!locked}
        onChangeText={(text) => onChange(text.replace(/\D/g, '').slice(0, 2))}
        keyboardType="number-pad"
        maxLength={2}
        placeholder="-"
        placeholderTextColor={theme.scoreIdleText}
        style={[
          styles.scoreInput,
          {
            color: filled && value !== '' ? theme.scoreOnText : theme.scoreIdleText,
            fontFamily: font,
          },
        ]}
        selectionColor={theme.primary}
      />
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
  scoreInput: { width: '100%', height: '100%', fontSize: 22, textAlign: 'center', padding: 0 },
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
