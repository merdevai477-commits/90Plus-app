/**
 * Predict a single match: winner cards + score boxes + confirm.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Info, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { PredictionMatch } from './data';
import { ScoreKeypad } from './ScoreKeypad';
import { PG, PG_GRADIENTS, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

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
  const { extra, bold, medium } = usePGFonts();
  const { t } = useTranslation();
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

  const teamCard = (side: 'home' | 'away') => {
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
        <TeamBadge name={tm.name} logo={tm.logo ?? undefined} size={44} color="transparent" />
        <Text style={[styles.pickName, { fontFamily: medium }]} numberOfLines={2}>
          {tm.name}
        </Text>
      </Pressable>
    );
  };

  const scoreBox = (side: 'home' | 'away', value: number | null) => (
    <Pressable onPress={() => setKeypad(side)} style={styles.scoreBox}>
      <Text style={[styles.scoreVal, { fontFamily: extra }]}>{value == null ? '—' : value}</Text>
    </Pressable>
  );

  return (
    <>
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <View style={styles.head}>
            <Pressable onPress={onClose} style={styles.close} hitSlop={8}>
              <X size={20} color={PG.textMuted} />
            </Pressable>
            <Text style={[styles.title, { fontFamily: extra }]}>{pg.modalTitle}</Text>
            <View style={styles.close} />
          </View>

          <View style={[styles.matchRow, row]}>
            <View style={styles.team}>
              <TeamBadge name={match.home.name} logo={match.home.logo ?? undefined} size={52} color="transparent" />
              <Text style={[styles.teamName, { fontFamily: medium }]} numberOfLines={2}>{match.home.name}</Text>
            </View>
            <View style={styles.vsCol}>
              <Text style={[styles.vs, { fontFamily: extra }]}>VS</Text>
              <Text style={[styles.time, { fontFamily: medium }]}>{match.time}</Text>
            </View>
            <View style={styles.team}>
              <TeamBadge name={match.away.name} logo={match.away.logo ?? undefined} size={52} color="transparent" />
              <Text style={[styles.teamName, { fontFamily: medium }]} numberOfLines={2}>{match.away.name}</Text>
            </View>
          </View>

          <Text style={[styles.section, { fontFamily: extra }]}>{pg.whoWins}</Text>
          <View style={[styles.picks, row]}>
            {teamCard('home')}
            {teamCard('away')}
          </View>

          <Text style={[styles.section, { fontFamily: extra }]}>{pg.matchScore}</Text>
          <View style={[styles.scores, row]}>
            {scoreBox('home', homeScore)}
            <Text style={[styles.vs, { fontFamily: extra }]}>VS</Text>
            {scoreBox('away', awayScore)}
          </View>

          <Pressable
            disabled={busy || !derivedWinner}
            onPress={() => void submit()}
            style={({ pressed }) => [pressed && { opacity: 0.92 }, (!derivedWinner || busy) && { opacity: 0.55 }]}
          >
            <LinearGradient colors={[...PG_GRADIENTS.purple]} style={styles.confirm}>
              {busy ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.confirmTxt, { fontFamily: bold }]}>{pg.confirmPrediction}</Text>
              )}
            </LinearGradient>
          </Pressable>
          <View style={[styles.hintRow, row]}>
            <Info size={14} color={PG.textMuted} />
            <Text style={[styles.hint, { fontFamily: medium }]}>{pg.editBeforeKickoff}</Text>
          </View>
        </View>
        <ScoreKeypad
          embedded
          visible={keypad != null}
          title={keypad === 'away' ? pg.keypadAway.replace('{team}', match.away.name) : pg.keypadHome.replace('{team}', match.home.name)}
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
    </>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    position: 'relative',
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: PG.bg,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: PG.borderBright,
    paddingHorizontal: 20,
    paddingTop: 12,
    gap: 12,
  },
  head: { flexDirection: 'row', alignItems: 'center' },
  close: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { flex: 1, color: PG.text, fontSize: 16, textAlign: 'center' },
  matchRow: { alignItems: 'center', paddingVertical: 8 },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: PG.text, fontSize: 12, textAlign: 'center' },
  vsCol: { width: 72, alignItems: 'center', gap: 4 },
  vs: { color: PG.primary, fontSize: 16 },
  time: { color: PG.textMuted, fontSize: 11 },
  section: { color: PG.text, fontSize: 15, marginTop: 4 },
  picks: { gap: 10 },
  pick: {
    flex: 1,
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.borderSoft,
  },
  pickOn: { borderColor: PG.primary, backgroundColor: 'rgba(168,85,247,0.16)' },
  pickName: { color: PG.text, fontSize: 12, textAlign: 'center' },
  scores: { alignItems: 'center', justifyContent: 'center', gap: 16 },
  scoreBox: {
    width: 88,
    height: 64,
    borderRadius: 16,
    backgroundColor: PG.cardElevated,
    borderWidth: 1,
    borderColor: PG.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scoreVal: { color: PG.text, fontSize: 24 },
  confirm: {
    minHeight: 52,
    borderRadius: PG_RADII.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 8,
    ...PG_GLOW_PURPLE,
  },
  confirmTxt: { color: '#fff', fontSize: 16 },
  hintRow: { alignItems: 'center', justifyContent: 'center', gap: 6, paddingBottom: 4 },
  hint: { color: PG.textMuted, fontSize: 11, flexShrink: 1 },
});
