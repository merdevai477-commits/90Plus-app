/**
 * Predict a single match — Figma 494:4661.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TeamBadge from '../common/TeamBadge';
import GradientText from '../ShareWin/components/GradientText';
import { useTranslation } from '../../src/i18n';
import { prefetchImageUrls } from '../../utils/prefetchMatchAssets';
import { with365ImageSize } from '../../utils/scores365AthletePhoto';
import type { PredictionMatch } from './data';
import { ScoreKeypad } from './ScoreKeypad';
import { usePGFonts } from './theme';

const ICON_CLOSE = require('../../assets/images/prediction-groups/icon-close-cross.svg');
const ICON_INFO = require('../../assets/images/prediction-groups/icon-info-outline.svg');

const VS_GRADIENT = ['#A855F7', '#633291'] as const;
const CONFIRM_GRADIENT = ['#3D0AB3', '#190448'] as const;
const CARD_GRADIENT = ['#0C051A', '#07040D'] as const;

type Winner = 'home' | 'away' | null;
type ScoreSide = 'home' | 'away' | null;

export function PredictMatchModal({
  visible,
  isRTL,
  match,
  busy,
  onClose,
  onConfirm,
}: {
  visible: boolean;
  isRTL: boolean;
  match: PredictionMatch | null;
  busy?: boolean;
  onClose: () => void;
  onConfirm: (payload: {
    mode: 'WINNER' | 'EXACT';
    predictedWinner: 'home' | 'draw' | 'away';
    predictedHomeScore?: number;
    predictedAwayScore?: number;
  }) => Promise<void>;
}) {
  const insets = useSafeAreaInsets();
  const { height: windowH } = useWindowDimensions();
  const { bold, medium, regular } = usePGFonts();
  const { t, direction } = useTranslation();
  const pg = t.predictionGroups.predictions;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const [winner, setWinner] = useState<Winner>(null);
  const [homeScore, setHomeScore] = useState<number | null>(null);
  const [awayScore, setAwayScore] = useState<number | null>(null);
  const [keypad, setKeypad] = useState<ScoreSide>(null);

  useEffect(() => {
    if (visible) {
      setWinner(null);
      setHomeScore(null);
      setAwayScore(null);
      setKeypad(null);
    }
  }, [visible, match?.id]);

  useEffect(() => {
    if (!visible || !match) return;
    prefetchImageUrls(
      [
        with365ImageSize(match.home.logo, 256),
        with365ImageSize(match.away.logo, 256),
        match.home.logo,
        match.away.logo,
      ],
      8,
    );
  }, [visible, match?.id, match?.home.logo, match?.away.logo]);

  const hasScores = homeScore != null && awayScore != null;
  const derivedWinner = useMemo<'home' | 'draw' | 'away' | null>(() => {
    if (hasScores) {
      if (homeScore! > awayScore!) return 'home';
      if (awayScore! > homeScore!) return 'away';
      return 'draw';
    }
    return winner;
  }, [awayScore, hasScores, homeScore, winner]);

  const submit = useCallback(async () => {
    if (!match || !derivedWinner) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    if (hasScores) {
      await onConfirm({
        mode: 'EXACT',
        predictedWinner: derivedWinner,
        predictedHomeScore: homeScore!,
        predictedAwayScore: awayScore!,
      });
      return;
    }
    await onConfirm({
      mode: 'WINNER',
      predictedWinner: derivedWinner,
    });
  }, [awayScore, derivedWinner, hasScores, homeScore, match, onConfirm]);

  if (!match) return null;

  const teamPick = (side: 'home' | 'away') => {
    const tm = match[side];
    const selected = winner === side;
    return (
      <Pressable
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          setWinner(side);
        }}
        style={[styles.pick, selected && styles.pickOn]}
      >
        <TeamBadge
          name={tm.name}
          logo={tm.logo ?? undefined}
          size={56}
          color="transparent"
          highQuality
        />
        <Text
          style={[styles.pickName, { fontFamily: medium, writingDirection: direction }]}
          numberOfLines={2}
        >
          {tm.name}
        </Text>
      </Pressable>
    );
  };

  const scoreBox = (side: 'home' | 'away', value: number | null) => (
    <Pressable onPress={() => setKeypad(side)} style={styles.scoreBox}>
      <Text style={[styles.scoreVal, { fontFamily: bold }]}>
        {value == null ? '—' : String(value)}
      </Text>
    </Pressable>
  );

  const maxCardH = Math.min(732, windowH * 0.92);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 8 }]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.cardWrap, { maxHeight: maxCardH }]}>
          <LinearGradient
            colors={CARD_GRADIENT}
            start={{ x: 0.5, y: 1 }}
            end={{ x: 0.5, y: 0 }}
            style={styles.card}
          >
            <ScrollView
              bounces={false}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={styles.scrollInner}
            >
              <View style={[styles.head, row]}>
                <Pressable
                  onPress={onClose}
                  style={styles.close}
                  hitSlop={8}
                  accessibilityRole="button"
                >
                  <Image
                    source={ICON_CLOSE}
                    style={styles.closeIcon}
                    contentFit="contain"
                    transition={0}
                  />
                </Pressable>
              </View>

              <View style={styles.body}>
                <Text
                  style={[styles.title, { fontFamily: bold, writingDirection: direction }]}
                >
                  {pg.modalTitle}
                </Text>

                <View style={[styles.matchRow, row]}>
                  <View style={styles.teamColHome}>
                    <TeamBadge
                      name={match.home.name}
                      logo={match.home.logo ?? undefined}
                      size={56}
                      color="transparent"
                      highQuality
                    />
                    <Text
                      style={[styles.teamName, { fontFamily: bold, writingDirection: direction }]}
                      numberOfLines={2}
                    >
                      {match.home.name}
                    </Text>
                  </View>
                  <View style={styles.vsCol}>
                    <GradientText
                      colors={VS_GRADIENT}
                      style={[styles.vsBig, { fontFamily: bold }]}
                    >
                      VS
                    </GradientText>
                    <Text style={[styles.time, { fontFamily: medium }]}>{match.time}</Text>
                  </View>
                  <View style={styles.teamColAway}>
                    <TeamBadge
                      name={match.away.name}
                      logo={match.away.logo ?? undefined}
                      size={58}
                      color="transparent"
                      highQuality
                    />
                    <Text
                      style={[styles.teamName, { fontFamily: bold, writingDirection: direction }]}
                      numberOfLines={2}
                    >
                      {match.away.name}
                    </Text>
                  </View>
                </View>

                <View style={styles.block}>
                  <Text
                    style={[styles.section, { fontFamily: bold, writingDirection: direction }]}
                  >
                    {pg.whoWins}
                  </Text>
                  <View style={[styles.picks, row]}>
                    {teamPick('home')}
                    {teamPick('away')}
                  </View>
                </View>

                <View style={styles.block}>
                  <Text
                    style={[styles.section, { fontFamily: bold, writingDirection: direction }]}
                  >
                    {pg.matchScore}
                  </Text>
                  <View style={[styles.scores, row]}>
                    {scoreBox('home', homeScore)}
                    <GradientText
                      colors={VS_GRADIENT}
                      style={[styles.vsScore, { fontFamily: bold }]}
                    >
                      VS
                    </GradientText>
                    {scoreBox('away', awayScore)}
                  </View>
                </View>
              </View>

              <View style={styles.footer}>
                <Pressable
                  disabled={busy || !derivedWinner}
                  onPress={() => void submit()}
                  style={({ pressed }) => [
                    pressed && { opacity: 0.92 },
                    (!derivedWinner || busy) && { opacity: 0.55 },
                    styles.confirmPress,
                  ]}
                >
                  <LinearGradient
                    colors={CONFIRM_GRADIENT}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={styles.confirm}
                  >
                    {busy ? (
                      <ActivityIndicator color="#fff" />
                    ) : (
                      <Text style={[styles.confirmTxt, { fontFamily: bold }]}>
                        {pg.confirmPrediction}
                      </Text>
                    )}
                  </LinearGradient>
                </Pressable>
                <View style={[styles.hintRow, row]}>
                  <Text
                    style={[
                      styles.hint,
                      { fontFamily: regular ?? medium, writingDirection: direction },
                    ]}
                  >
                    {pg.editBeforeKickoff}
                  </Text>
                  <Image
                    source={ICON_INFO}
                    style={styles.infoIcon}
                    contentFit="contain"
                    transition={0}
                  />
                </View>
              </View>
            </ScrollView>
          </LinearGradient>
        </View>

        <ScoreKeypad
          embedded
          visible={keypad != null}
          title={
            keypad === 'away'
              ? pg.keypadAway.replace('{team}', match.away.name)
              : pg.keypadHome.replace('{team}', match.home.name)
          }
          value={keypad === 'away' ? awayScore ?? 0 : homeScore ?? 0}
          confirmLabel={pg.confirmScore}
          onChange={(n) => {
            if (keypad === 'away') setAwayScore(n);
            else setHomeScore(n);
          }}
          onConfirm={() => {
            if (keypad === 'home' && awayScore == null) setKeypad('away');
            else setKeypad(null);
          }}
          onClose={() => setKeypad(null)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  cardWrap: {
    borderRadius: 44,
    overflow: 'hidden',
    shadowColor: 'rgba(90,18,158,0.36)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 26,
    elevation: 18,
    zIndex: 2,
  },
  card: {
    borderRadius: 44,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(79,10,144,0.62)',
    overflow: 'hidden',
  },
  scrollInner: {
    paddingVertical: 16,
    alignItems: 'center',
    gap: 48,
  },
  head: {
    width: '100%',
    height: 35,
    paddingHorizontal: 28,
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  close: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: { width: 36, height: 36 },
  body: {
    width: '100%',
    maxWidth: 331,
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 12,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 24,
    textAlign: 'center',
    width: '100%',
  },
  matchRow: {
    width: '100%',
    height: 101,
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    borderRadius: 25,
  },
  teamColHome: {
    width: 81,
    alignItems: 'center',
    gap: 9,
  },
  teamColAway: {
    width: 72,
    alignItems: 'center',
    gap: 9,
  },
  teamName: {
    color: '#FFFFFF',
    fontSize: 15,
    textAlign: 'center',
  },
  vsCol: {
    width: 105,
    height: 101,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  vsBig: {
    color: '#A855F7',
    fontSize: 21,
    textAlign: 'center',
  },
  time: {
    color: '#777777',
    fontSize: 13,
    textAlign: 'center',
  },
  block: {
    width: '100%',
    alignItems: 'center',
    gap: 16,
    marginTop: 8,
  },
  section: {
    color: '#FFFFFF',
    fontSize: 23,
    textAlign: 'center',
    width: '100%',
  },
  picks: {
    width: '100%',
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 12,
  },
  pick: {
    flex: 1,
    maxWidth: 160,
    minHeight: 114,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    borderRadius: 16,
    backgroundColor: '#07040D',
    borderWidth: 1,
    borderColor: '#241830',
    paddingHorizontal: 8,
    paddingVertical: 12,
  },
  pickOn: {
    borderColor: '#A855F7',
    backgroundColor: 'rgba(168,85,247,0.14)',
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 5,
  },
  pickName: {
    color: '#FFFFFF',
    fontSize: 13,
    textAlign: 'center',
  },
  scores: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 6,
  },
  scoreBox: {
    width: 95,
    height: 74,
    borderRadius: 16,
    backgroundColor: '#07040D',
    borderWidth: 1,
    borderColor: '#241830',
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreVal: {
    color: '#FFFFFF',
    fontSize: 28,
  },
  vsScore: {
    color: '#A855F7',
    fontSize: 26,
    textAlign: 'center',
  },
  footer: {
    width: '100%',
    maxWidth: 331,
    alignSelf: 'center',
    alignItems: 'stretch',
    gap: 8,
    paddingHorizontal: 12,
  },
  confirmPress: {
    width: '100%',
    alignSelf: 'stretch',
  },
  confirm: {
    width: '100%',
    minHeight: 62,
    height: 62,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 0,
  },
  confirmTxt: {
    color: '#FFFFFF',
    fontSize: 18,
    textAlign: 'center',
  },
  hintRow: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    alignSelf: 'center',
  },
  hint: {
    color: '#6B6B6B',
    fontSize: 12,
    textAlign: 'center',
  },
  infoIcon: { width: 16, height: 16 },
});
