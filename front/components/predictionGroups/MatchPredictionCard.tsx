/**
 * MatchPredictionCard — group round match prediction.
 *
 *  - Tap team logo → winner prediction (WINNER / 2 XP)
 *  - Adjust score steppers → exact score (EXACT / 5 XP)
 *  - Draw button below score area → any draw (WINNER / 2 XP) — 0-0, 1-1, 2-2, etc.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import React, { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { CrowdOddsStrip } from '../common/CrowdOddsStrip';
import TeamBadge from '../common/TeamBadge';
import { GlassCard, PressableScale } from './atoms';
import type { PredictionMatch } from './data';
import { PG, PG_GLOW_PURPLE, PG_RADII, usePGFonts } from './theme';

type Mode = 'winner' | 'exact' | null;
type Winner = 'home' | 'draw' | 'away' | null;

function parseWinner(w: string | null | undefined): Winner {
  const v = w?.toLowerCase();
  if (v === 'home' || v === 'draw' || v === 'away') return v;
  return null;
}

function winnerFromPrediction(pred: NonNullable<MatchPredictionCardProps['initialPrediction']>): Winner {
  const parsed = parseWinner(pred.predictedWinner);
  if (parsed) return parsed;
  if (pred.mode !== 'EXACT') return null;
  const h = pred.predictedHomeScore ?? 0;
  const a = pred.predictedAwayScore ?? 0;
  if (h > a) return 'home';
  if (a > h) return 'away';
  if (h === a) return 'draw';
  return null;
}

export interface MatchPredictionCardProps {
  match: PredictionMatch & { status?: string };
  isRTL: boolean;
  locked?: boolean;
  saved?: boolean;
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
    winner?: Winner;
  }) => void;
}

function Stepper({
  value,
  onChange,
  disabled,
  active,
  masked,
  increaseLabel,
  decreaseLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  disabled?: boolean;
  active?: boolean;
  masked?: boolean;
  increaseLabel: string;
  decreaseLabel: string;
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
    <View style={[styles.spinner, disabled && styles.spinnerDisabled, active && styles.spinnerActive]}>
      <Text style={[styles.spinnerNum, masked && styles.spinnerMasked, { fontFamily: extra }]}>
        {masked ? '—' : value}
      </Text>
      <View style={styles.spinnerBtns}>
        <Pressable
          disabled={disabled}
          onPress={() => bump(1)}
          hitSlop={6}
          style={styles.spinnerBtn}
          accessibilityRole="button"
          accessibilityLabel={increaseLabel}
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
          accessibilityLabel={decreaseLabel}
        >
          <ChevronDown size={14} color={arrow} />
        </Pressable>
      </View>
    </View>
  );
}

export const MatchPredictionCard = memo(function MatchPredictionCard({
  match,
  isRTL,
  locked,
  saved,
  finished,
  initialPrediction,
  onDraftChange,
}: MatchPredictionCardProps) {
  const { t } = useTranslation();
  const pg = t.predictionGroups.predictions;
  const { medium, bold, extra } = usePGFonts();
  const winnerModeInit = initialPrediction?.mode === 'WINNER';
  const [home, setHome] = useState(() => {
    if (finished) return match.result?.home ?? 0;
    if (winnerModeInit) return 0;
    return initialPrediction?.predictedHomeScore ?? 0;
  });
  const [away, setAway] = useState(() => {
    if (finished) return match.result?.away ?? 0;
    if (winnerModeInit) return 0;
    return initialPrediction?.predictedAwayScore ?? 0;
  });
  const [mode, setMode] = useState<Mode>(
    initialPrediction?.mode === 'EXACT' ? 'exact' : initialPrediction ? 'winner' : null,
  );
  const [winner, setWinner] = useState<Winner>(() =>
    initialPrediction ? winnerFromPrediction(initialPrediction) : null,
  );

  useEffect(() => {
    if (initialPrediction) {
      const isWinner = initialPrediction.mode === 'WINNER';
      setMode(isWinner ? 'winner' : 'exact');
      if (isWinner) {
        setHome(0);
        setAway(0);
      } else {
        setHome(initialPrediction.predictedHomeScore ?? 0);
        setAway(initialPrediction.predictedAwayScore ?? 0);
      }
      setWinner(winnerFromPrediction(initialPrediction));
    }
  }, [initialPrediction]);

  const emit = (patch: {
    mode?: 'WINNER' | 'EXACT';
    home?: number;
    away?: number;
    winner?: Winner;
  }) => {
    onDraftChange?.(patch);
  };

  const setHomeScore = (n: number) => {
    if (!isEditable) return;
    setHome(n);
    setMode('exact');
    const w: Winner = n > away ? 'home' : n < away ? 'away' : 'draw';
    setWinner(w);
    emit({ home: n, away, winner: w, mode: 'EXACT' });
  };

  const setAwayScore = (n: number) => {
    if (!isEditable) return;
    setAway(n);
    setMode('exact');
    const w: Winner = home > n ? 'home' : home < n ? 'away' : 'draw';
    setWinner(w);
    emit({ home, away: n, winner: w, mode: 'EXACT' });
  };

  const pickLogoWinner = (side: 'home' | 'away') => {
    if (!isEditable) return;
    setMode('winner');
    setWinner(side);
    emit({ mode: 'WINNER', winner: side });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const pickDraw = () => {
    if (!isEditable) return;
    setMode('winner');
    setWinner('draw');
    emit({ mode: 'WINNER', winner: 'draw' });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  };

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const isEditable = !locked && !finished && !saved;
  const readOnly = !isEditable;
  const exactMode = mode === 'exact';
  const winnerMode = mode === 'winner';
  const homeLogoActive = winnerMode && winner === 'home';
  const awayLogoActive = winnerMode && winner === 'away';
  const drawActive = winnerMode && winner === 'draw';
  const showSavedWinnerPick = Boolean(saved && winnerMode && winner && !finished);
  const showSavedExactScores = Boolean((saved || finished) && exactMode && !finished);
  const showFinishedScores = Boolean(finished);

  const modeHintText = useMemo(() => {
    if (mode === 'exact') return pg.modeExact.replace('{home}', String(home)).replace('{away}', String(away));
    if (winner === 'draw') return pg.modeDrawAny;
    if (winner === 'home') return pg.modeWin.replace('{team}', match.home.name);
    if (winner === 'away') return pg.modeWin.replace('{team}', match.away.name);
    return pg.modeWinnerDefault;
  }, [mode, home, away, winner, match.home.name, match.away.name, pg]);

  const homeScore = finished ? match.result?.home ?? 0 : home;
  const awayScore = finished ? match.result?.away ?? 0 : away;

  const SavedLogoWrap = ({
    children,
    active,
  }: {
    children: React.ReactNode;
    active: boolean;
  }) => (
    <View style={[styles.logoTap, active && styles.logoTapActive]}>
      {active && (
        <LinearGradient
          colors={['rgba(124,58,237,0.45)', 'rgba(159,90,251,0.15)']}
          style={StyleSheet.absoluteFill}
        />
      )}
      {children}
    </View>
  );

  const LogoPick = ({
    side,
    name,
    logo,
    active,
  }: {
    side: 'home' | 'away';
    name: string;
    logo?: string | null;
    active: boolean;
  }) => {
    const badge = (
      <TeamBadge name={name} logo={logo ?? undefined} size={46} color="transparent" />
    );

    if (readOnly) {
      return (
        <SavedLogoWrap active={active}>
          {badge}
        </SavedLogoWrap>
      );
    }

    return (
      <PressableScale
        onPress={() => pickLogoWinner(side)}
        activeScale={0.92}
        style={[styles.logoTap, active && styles.logoTapActive]}
        accessibilityRole="button"
        accessibilityState={{ selected: active }}
        accessibilityLabel={pg.predictWinA11y.replace('{team}', name)}
      >
        {active && (
          <LinearGradient
            colors={['rgba(124,58,237,0.45)', 'rgba(159,90,251,0.15)']}
            style={StyleSheet.absoluteFill}
          />
        )}
        {badge}
      </PressableScale>
    );
  };

  return (
    <GlassCard style={styles.card}>
      <View style={styles.timeRow}>
        <Text style={[styles.time, { fontFamily: medium }]}>
          {match.day}
          {match.time ? ` · ${match.time}` : ''}
        </Text>
        {finished && (
          <View style={styles.finishedPill}>
            <Text style={[styles.finishedTxt, { fontFamily: bold }]}>{pg.finished}</Text>
          </View>
        )}
      </View>

      {match.crowdPrediction && !finished ? (
        <CrowdOddsStrip
          homePercent={match.crowdPrediction.homePercent}
          drawPercent={match.crowdPrediction.drawPercent}
          awayPercent={match.crowdPrediction.awayPercent}
          label={t.matches.crowdPrediction.label}
          compact
          labelColor={PG.purpleSoft}
        />
      ) : null}

      <View style={[styles.teams, row]}>
        <View style={styles.teamSide}>
          <LogoPick side="home" name={match.home.name} logo={match.home.logo} active={homeLogoActive} />
          <Text
            style={[styles.teamName, { fontFamily: bold }, homeLogoActive && styles.teamNameActive]}
            numberOfLines={2}
          >
            {match.home.name}
          </Text>
        </View>

        <View style={styles.scoreArea}>
          {showFinishedScores || showSavedExactScores ? (
            <View style={[styles.scoreLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text
                style={[
                  styles.bigScore,
                  { fontFamily: extra },
                  homeLogoActive && styles.bigScoreActive,
                ]}
              >
                {homeScore}
              </Text>
              <Text style={[styles.scoreDash, { fontFamily: extra }]}>-</Text>
              <Text
                style={[
                  styles.bigScore,
                  { fontFamily: extra },
                  awayLogoActive && styles.bigScoreActive,
                ]}
              >
                {awayScore}
              </Text>
            </View>
          ) : showSavedWinnerPick ? (
            <View style={styles.savedPickCol}>
              <Text style={[styles.savedPickLabel, { fontFamily: medium }]}>{pg.yourPick}</Text>
              <Text style={[styles.savedPickValue, { fontFamily: bold }]} numberOfLines={3}>
                {modeHintText}
              </Text>
              {winner === 'draw' && (
                <View style={[styles.savedDrawPill, drawActive && styles.drawBtnActive]}>
                  <Text style={[styles.savedDrawTxt, { fontFamily: bold }]}>{pg.drawAny}</Text>
                </View>
              )}
            </View>
          ) : readOnly ? (
            <View style={[styles.scoreLine, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
              <Text style={[styles.bigScore, { fontFamily: extra }]}>{homeScore}</Text>
              <Text style={[styles.scoreDash, { fontFamily: extra }]}>-</Text>
              <Text style={[styles.bigScore, { fontFamily: extra }]}>{awayScore}</Text>
            </View>
          ) : (
            <View style={styles.scoreInputCol}>
              <Text style={[styles.predictLabel, { fontFamily: medium }]}>{pg.predictScore}</Text>
              <View style={[styles.stepperRow, { flexDirection: isRTL ? 'row-reverse' : 'row' }]}>
                <Stepper
                  value={home}
                  onChange={setHomeScore}
                  disabled={!isEditable}
                  active={exactMode}
                  masked={winnerMode}
                  increaseLabel={pg.increase}
                  decreaseLabel={pg.decrease}
                />
                <Text style={[styles.scoreDash, { fontFamily: extra }]}>-</Text>
                <Stepper
                  value={away}
                  onChange={setAwayScore}
                  disabled={!isEditable}
                  active={exactMode}
                  masked={winnerMode}
                  increaseLabel={pg.increase}
                  decreaseLabel={pg.decrease}
                />
              </View>
              <PressableScale
                onPress={pickDraw}
                activeScale={0.96}
                style={[styles.drawBtn, drawActive && styles.drawBtnActive]}
                accessibilityRole="button"
                accessibilityState={{ selected: drawActive }}
                accessibilityLabel={pg.drawA11y}
              >
                {drawActive && (
                  <LinearGradient
                    colors={['rgba(124,58,237,0.4)', 'rgba(159,90,251,0.18)']}
                    style={StyleSheet.absoluteFill}
                  />
                )}
                <Text
                  style={[
                    styles.drawLabel,
                    { fontFamily: bold, color: drawActive ? PG.text : PG.textSecondary },
                  ]}
                >
                  {pg.drawAny}
                </Text>
              </PressableScale>
            </View>
          )}
        </View>

        <View style={styles.teamSide}>
          <LogoPick side="away" name={match.away.name} logo={match.away.logo} active={awayLogoActive} />
          <Text style={[styles.teamName, { fontFamily: bold }, awayLogoActive && styles.teamNameActive]} numberOfLines={2}>
            {match.away.name}
          </Text>
        </View>
      </View>

      {!readOnly && mode && (
        <Text style={[styles.modeHint, { fontFamily: medium }]}>{modeHintText}</Text>
      )}

      {(saved || finished) && mode && !showSavedWinnerPick && (
        <Text style={[styles.modeHint, styles.modeHintSaved, { fontFamily: medium }]}>{modeHintText}</Text>
      )}

      {saved && !finished && (
        <Text style={[styles.lockedNote, { fontFamily: medium }]}>{pg.savedLocked}</Text>
      )}

      {locked && !saved && (
        <Text style={[styles.lockedNote, { fontFamily: medium }]}>{pg.lockedFuture}</Text>
      )}
    </GlassCard>
  );
});

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
  teamName: { color: PG.text, fontSize: 12, textAlign: 'center', lineHeight: 17 },

  logoTap: {
    borderRadius: 999,
    padding: 4,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  logoTapActive: {
    borderColor: PG.purpleLight,
    ...PG_GLOW_PURPLE,
  },

  scoreArea: { minWidth: 120, alignItems: 'center', justifyContent: 'center' },
  scoreInputCol: { alignItems: 'center', gap: 8 },
  scoreLine: { alignItems: 'center', gap: 10 },
  bigScore: { color: PG.text, fontSize: 30, minWidth: 26, textAlign: 'center' },
  bigScoreActive: { color: PG.purpleSoft },
  scoreDash: { color: PG.textMuted, fontSize: 22 },

  savedPickCol: { alignItems: 'center', gap: 6, paddingHorizontal: 4, minWidth: 120 },
  savedPickLabel: { color: PG.textMuted, fontSize: 10, letterSpacing: 0.3 },
  savedPickValue: { color: PG.text, fontSize: 13, textAlign: 'center', lineHeight: 18 },
  savedDrawPill: {
    marginTop: 2,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: PG_RADII.md,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  savedDrawTxt: { color: PG.purpleSoft, fontSize: 11 },
  teamNameActive: { color: PG.purpleSoft },

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
  spinnerActive: {
    borderColor: PG.purpleLight,
    backgroundColor: 'rgba(124,58,237,0.12)',
    ...PG_GLOW_PURPLE,
  },
  spinnerDisabled: { borderColor: PG.borderSoft, backgroundColor: 'rgba(255,255,255,0.03)' },
  spinnerNum: { color: PG.text, fontSize: 22, minWidth: 20, textAlign: 'center' },
  spinnerMasked: { color: PG.textMuted, fontSize: 18 },
  spinnerBtns: { alignItems: 'center' },
  spinnerBtn: { paddingVertical: 1, paddingHorizontal: 2 },
  spinnerDivider: { width: 14, height: 1, backgroundColor: 'rgba(255,255,255,0.12)' },

  drawBtn: {
    minWidth: 120,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: PG_RADII.md,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: PG.borderSoft,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  drawBtnActive: {
    borderColor: PG.purpleLight,
    backgroundColor: 'rgba(124,58,237,0.12)',
    ...PG_GLOW_PURPLE,
  },
  drawLabel: { fontSize: 12 },

  modeHint: { color: PG.textMuted, fontSize: 11, textAlign: 'center' },
  modeHintSaved: { color: PG.purpleSoft },

  lockedNote: { color: PG.textMuted, fontSize: 12, textAlign: 'center' },
});
