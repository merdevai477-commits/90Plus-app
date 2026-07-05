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
import { Minus, Plus } from 'lucide-react-native';
import React, { useState } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { Crest, GlassCard, PressableScale } from './atoms';
import type { PredictionMatch } from './data';
import { PG, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

type Mode = 'winner' | 'exact' | null;

export interface MatchPredictionCardProps {
  match: PredictionMatch;
  isRTL: boolean;
  locked?: boolean;
  finished?: boolean;
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
  return (
    <View style={styles.stepper}>
      <PressableScale
        disabled={disabled}
        onPress={() => bump(1)}
        style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="زيادة"
      >
        <Plus size={16} color={disabled ? PG.textMuted : PG.purpleSoft} />
      </PressableScale>
      <Text style={[styles.score, { fontFamily: extra }]}>{value}</Text>
      <PressableScale
        disabled={disabled}
        onPress={() => bump(-1)}
        style={[styles.stepBtn, disabled && styles.stepBtnDisabled]}
        accessibilityRole="button"
        accessibilityLabel="إنقاص"
      >
        <Minus size={16} color={disabled ? PG.textMuted : PG.purpleSoft} />
      </PressableScale>
    </View>
  );
}

export function MatchPredictionCard({ match, isRTL, locked, finished }: MatchPredictionCardProps) {
  const { medium, bold, extra } = usePGFonts();
  const [home, setHome] = useState(finished ? match.result?.home ?? 0 : 0);
  const [away, setAway] = useState(finished ? match.result?.away ?? 0 : 0);
  const [mode, setMode] = useState<Mode>(null);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const readOnly = locked || finished;

  const pickMode = (m: Mode) => {
    setMode(m);
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
          <Crest team={match.home} size={46} />
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
            <View style={[styles.stepperRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Stepper value={home} onChange={setHome} />
              <Text style={[styles.scoreDash, { fontFamily: extra }]}>-</Text>
              <Stepper value={away} onChange={setAway} />
            </View>
          )}
        </View>

        <View style={styles.teamSide}>
          <Crest team={match.away} size={46} />
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
            label="فائز أو تعادل"
            points="نقطة"
            active={mode === 'winner'}
            onPress={() => pickMode('winner')}
          />
          <ModeButton
            label="نتيجة دقيقة"
            points="3 نقاط"
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
  points,
  active,
  onPress,
}: {
  label: string;
  points: string;
  active: boolean;
  onPress: () => void;
}) {
  const { medium, bold } = usePGFonts();
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
          colors={['rgba(124,58,237,0.35)', 'rgba(159,90,251,0.15)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      <Text style={[styles.modeLabel, { fontFamily: bold, color: active ? PG.text : PG.textSecondary }]}>
        {label}
      </Text>
      <Text style={[styles.modePoints, { fontFamily: medium, color: active ? PG.purpleSoft : PG.textMuted }]}>
        {points}
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

  stepperRow: { alignItems: 'center', gap: 8 },
  stepper: { alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 30,
    height: 30,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.20)',
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.35)',
  },
  stepBtnDisabled: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: PG.borderSoft },
  score: { color: PG.text, fontSize: 26, minWidth: 30, textAlign: 'center' },

  lockedNote: { color: PG.textMuted, fontSize: 12, textAlign: 'center' },

  modes: { gap: 10 },
  modeBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: PG_RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    overflow: 'hidden',
    borderWidth: 1,
  },
  modeBtnIdle: { backgroundColor: 'rgba(255,255,255,0.04)', borderColor: PG.borderSoft },
  modeBtnActive: {
    backgroundColor: 'rgba(124,58,237,0.12)',
    borderColor: PG.purpleLight,
    ...PG_GLOW_PURPLE,
  },
  modeLabel: { fontSize: 13 },
  modePoints: { fontSize: 11 },
});
