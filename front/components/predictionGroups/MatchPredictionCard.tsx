/**
 * MatchPredictionCard — one match with score entry + scoring-mode selection.
 *
 *  - Team crests + names on the sides, date/time in the middle.
 *  - Score input: numeric stepper (+/-) buttons with a UI-thread press-scale
 *    animation (PressableScale — the Moti-free equivalent).
 *  - Two scoring modes: "فائز أو تعادل (نقطة)" and "نتيجة دقيقة (3 نقاط)".
 *    The selected mode gets a glowing border (shadowColor/shadowRadius — the
 *    Skia-blur-free fallback the spec allows).
 *  - `locked` (upcoming preview) and `finished` (results) render read-only.
 *
 * Self-contained interactive state; parent only supplies data + `isRTL`.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronUp, Star, Target } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { GlassCard, PressableScale } from './atoms';
import type { PredictionMatch } from './data';
import { PG, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

type Mode = 'winner' | 'exact' | null;

export interface MatchPredictionCardProps {
  match: PredictionMatch & { status?: string };
  isRTL: boolean;
  locked?: boolean;
  finished?: boolean;
  apiMatchId?: number;
  initialPrediction?: {
    mode: 'WINNER' | 'EXACT';
    predictedWinner: string | null;
    predictedHomeScore: number | null;
    predictedAwayScore: number | null;
  } | null;
  onDraftChange?: (patch: {
    mode?: 'WINNER' | 'EXACT';
    home?: number;
    away?: number;
    winner?: 'home' | 'draw' | 'away' | null;
  }) => void;
}

function Stepper({
  value,
  onChange,
  disabled,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
}) {
  const { extra } = usePGFonts();
  const bump = (delta: number) => {
    const next = Math.max(0, Math.min(20, value + delta));
    if (next !== value) {
      onChange(next);
      Haptics.selectionAsync().catch(() => {});
    }
  };
  const arrow = disabled ? PG.textMuted : PG.purpleSoft;
  return (
    <View style={[styles.spinner, disabled && styles.spinnerDisabled]}>
      <Text style={[styles.spinnerNum, { fontFamily: extra }]}>{value}</Text>
      <View style={styles.spinnerBtns}>
        <Pressable
          disabled={disabled}
          onPress={() => bump(1)}
          hitSlop={6}
          style={styles.spinnerBtn}
          accessibilityRole="button"
          accessibilityLabel="زيادة"
        >
          <ChevronUp size={14} color={arrow} />
        </Pressable>
        <View style={styles.spinnerDivider} />
        <Pressable
          disabled={disabled}
          onPress={() => bump(-1)}
          hitSlop={6}
          style={styles.spinnerBtn}
          accessibilityRole="button"
          accessibilityLabel="إنقاص"
        >
          <ChevronDown size={14} color={arrow} />
        </Pressable>
      </View>
    </View>
  );
}

export function MatchPredictionCard({
  match,
  isRTL,
  locked,
  finished,
  initialPrediction,
  onDraftChange,
}: MatchPredictionCardProps) {
  const { medium, bold, extra } = usePGFonts();
  const [home, setHome] = useState(
    finished ? match.result?.home ?? 0 : initialPrediction?.predictedHomeScore ?? 0,
  );
  const [away, setAway] = useState(
    finished ? match.result?.away ?? 0 : initialPrediction?.predictedAwayScore ?? 0,
  );
  const [mode, setMode] = useState<Mode>(
    initialPrediction?.mode === 'EXACT' ? 'exact' : initialPrediction ? 'winner' : null,
  );

  useEffect(() => {
    if (initialPrediction) {
      setHome(initialPrediction.predictedHomeScore ?? 0);
      setAway(initialPrediction.predictedAwayScore ?? 0);
      setMode(initialPrediction.mode === 'EXACT' ? 'exact' : 'winner');
    }
  }, [initialPrediction]);

  const emit = (patch: {
    mode?: 'WINNER' | 'EXACT';
    home?: number;
    away?: number;
    winner?: 'home' | 'draw' | 'away' | null;
  }) => {
    onDraftChange?.(patch);
  };

  const setHomeScore = (n: number) => {
    setHome(n);
    const winner = n > away ? 'home' : n < away ? 'away' : 'draw';
    emit({ home: n, winner, mode: mode === 'exact' ? 'EXACT' : 'WINNER' });
  };

  const setAwayScore = (n: number) => {
    setAway(n);
    const winner = home > n ? 'home' : home < n ? 'away' : 'draw';
    emit({ away: n, winner, mode: mode === 'exact' ? 'EXACT' : 'WINNER' });
  };

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const readOnly = locked || finished;

  const pickMode = (m: Mode) => {
    setMode(m);
    const winner = home > away ? 'home' : home < away ? 'away' : 'draw';
    emit({
      mode: m === 'exact' ? 'EXACT' : 'WINNER',
      home,
      away,
      winner,
    });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const homeScore = finished ? match.result?.home ?? 0 : home;
  const awayScore = finished ? match.result?.away ?? 0 : away;

  return (
    <GlassCard style={styles.card}>
      <View style={styles.timeRow}>
        <Text style={[styles.time, { fontFamily: medium }]}>
          {match.day}
          {match.time ? ` · ${match.time}` : ''}
        </Text>
        {finished && (
          <View style={styles.finishedPill}>
            <Text style={[styles.finishedTxt, { fontFamily: bold }]}>انتهت</Text>
          </View>
        )}
      </View>

      <View style={[styles.teams, row]}>
        <View style={styles.teamSide}>
          <TeamBadge name={match.home.name} logo={match.home.logo ?? undefined} size={46} color="transparent" />
          <Text style={[styles.teamName, { fontFamily: bold }]} numberOfLines={1}>
            {match.home.name}
          </Text>
        </View>

        <View style={styles.scoreArea}>
          {readOnly ? (
            <View style={[styles.scoreLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.bigScore, { fontFamily: extra }]}>{homeScore}</Text>
              <Text style={[styles.scoreDash, { fontFamily: extra }]}>-</Text>
              <Text style={[styles.bigScore, { fontFamily: extra }]}>{awayScore}</Text>
            </View>
          ) : (
            <View style={{ alignItems: 'center', gap: 6 }}>
              <Text style={[styles.predictLabel, { fontFamily: medium }]}>توقع النتيجة</Text>
              <View style={[styles.stepperRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Stepper value={home} onChange={setHomeScore} />
                <Text style={[styles.scoreDash, { fontFamily: extra }]}>-</Text>
                <Stepper value={away} onChange={setAwayScore} />
              </View>
            </View>
          )}
        </View>

        <View style={styles.teamSide}>
          <TeamBadge name={match.away.name} logo={match.away.logo ?? undefined} size={46} color="transparent" />
          <Text style={[styles.teamName, { fontFamily: bold }]} numberOfLines={1}>
            {match.away.name}
          </Text>
        </View>
      </View>

      {locked && (
        <Text style={[styles.lockedNote, { fontFamily: medium }]}>
          🔒 تفتح التوقعات بعد انتهاء الجولة الحالية
        </Text>
      )}

      {!readOnly && (
        <View style={[styles.modes, row]}>
          <ModeButton
            label="فائز أو تعادل (2 XP)"
            icon={Star}
            active={mode === 'winner'}
            onPress={() => pickMode('winner')}
          />
          <ModeButton
            label="نتيجة دقيقة (5 XP)"
            icon={Target}
            active={mode === 'exact'}
            onPress={() => pickMode('exact')}
          />
        </View>
      )}
    </GlassCard>
  );
}

function ModeButton({
  label,
  icon: Icon,
  active,
  onPress,
}: {
  label: string;
  icon: typeof Star;
  active: boolean;
  onPress: () => void;
}) {
  const { bold } = usePGFonts();
  return (
    <PressableScale
      onPress={onPress}
      activeScale={0.96}
      style={[styles.modeBtn, active ? styles.modeBtnActive : styles.modeBtnIdle]}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
    >
      {active && (
        <LinearGradient
          colors={['rgba(124,58,237,0.4)', 'rgba(159,90,251,0.18)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Icon size={13} color={active ? PG.purpleSoft : PG.textMuted} />
      <Text
        style={[styles.modeLabel, { fontFamily: bold, color: active ? PG.text : PG.textSecondary }]}
        numberOfLines={1}
      >
        {label}
      </Text>
    </PressableScale>
  );
}

const styles = StyleSheet.create({
  card: { padding: 14, gap: 14 },
  timeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  time: { color: PG.textMuted, fontSize: 12 },
  finishedPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(34,197,94,0.16)',
  },
  finishedTxt: { color: PG.win, fontSize: 10 },

  teams: { alignItems: 'center', gap: 8 },
  teamSide: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: PG.text, fontSize: 12, textAlign: 'center' },

  scoreArea: { minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  scoreLine: { alignItems: 'center', gap: 10 },
  bigScore: { color: PG.text, fontSize: 30, minWidth: 26, textAlign: 'center' },
  scoreDash: { color: PG.textMuted, fontSize: 22 },

  predictLabel: { color: PG.textMuted, fontSize: 11 },
  stepperRow: { alignItems: 'center', gap: 10 },
  spinner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingLeft: 12,
    paddingRight: 6,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.28)',
  },
  spinnerDisabled: { borderColor: PG.borderSoft, backgroundColor: 'rgba(255,255,255,0.03)' },
  spinnerNum: { color: PG.text, fontSize: 22, minWidth: 20, textAlign: 'center' },
  spinnerBtns: { alignItems: 'center' },
  spinnerBtn: { paddingVertical: 1, paddingHorizontal: 2 },
  spinnerDivider: { width: 14, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },

  lockedNote: { color: PG.textMuted, fontSize: 12, textAlign: 'center' },

  modes: { gap: 10 },
  modeBtn: {
    flex: 1,
    flexDirection: 'row',
    paddingVertical: 11,
    paddingHorizontal: 8,
    borderRadius: PG_RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    overflow: 'hidden',
    borderWidth: 1,
  },
  modeBtnIdle: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: PG.borderSoft },
  modeBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderColor: PG.purpleLight,
    ...PG_GLOW_PURPLE,
  },
  modeLabel: { fontSize: 12 },
});
