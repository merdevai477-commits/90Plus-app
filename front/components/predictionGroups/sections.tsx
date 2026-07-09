/**
 * Prediction groups — round predictions section + standings re-export.
 */

import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Calendar, Gem, Target } from 'lucide-react-native';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import type { GroupRoundMatch } from '../../services/predictionGroups.service';
import { mapRoundMatchToCard } from '../../services/predictionGroups.service';
import { GlassCard } from './atoms';
import { MatchPredictionCard } from './MatchPredictionCard';
import { PG, PG_GRADIENTS, PG_RADII, PG_SPACING, usePGFonts } from './theme';

export { GroupsStandingsSection } from './GroupsStandingsSection';

function PointsSystemCard({ isRTL }: { isRTL: boolean }) {
  const { medium, bold } = usePGFonts();
  const { t } = useTranslation();
  const pg = t.predictionGroups.predictions;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  return (
    <GlassCard style={styles.pointsCard}>
      <Text style={[styles.pointsCardTitle, { fontFamily: bold, textAlign: isRTL ? 'right' : 'left' }]}>
        {pg.pointsTitle}
      </Text>
      <View style={[styles.pointsCols, row]}>
        <View style={[styles.pointsCol, row]}>
          <View style={[styles.pointsIcon, { backgroundColor: 'rgba(124,58,237,0.2)' }]}>
            <Target size={18} color={PG.purpleSoft} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pointsColTitle, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
              {pg.winnerOrDraw}
            </Text>
            <Text style={[styles.pointsColValue, { fontFamily: bold, textAlign: isRTL ? 'right' : 'left', color: PG.purpleSoft }]}>
              2 XP
            </Text>
          </View>
        </View>
        <View style={styles.pointsDivider} />
        <View style={[styles.pointsCol, row]}>
          <View style={[styles.pointsIcon, { backgroundColor: 'rgba(245,185,66,0.18)' }]}>
            <Gem size={18} color={PG.gold} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.pointsColTitle, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
              {pg.exactScore}
            </Text>
            <Text style={[styles.pointsColValue, { fontFamily: bold, textAlign: isRTL ? 'right' : 'left', color: PG.gold }]}>
              5 XP
            </Text>
          </View>
        </View>
      </View>
    </GlassCard>
  );
}

function RoundMatchesSkeleton({ isRTL }: { isRTL: boolean }) {
  const { medium } = usePGFonts();
  const { t } = useTranslation();
  const align = isRTL ? 'right' : 'left';
  return (
    <View style={styles.loadingWrap}>
      <ActivityIndicator color={PG.primaryLight} size="large" />
      <Text style={[styles.loadingText, { fontFamily: medium, textAlign: align }]}>
        {t.predictionGroups.screen.roundLoading}
      </Text>
    </View>
  );
}

export function PredictionsSection({
  isRTL,
  groupId,
  roundMatches,
  roundMeta,
  roundLoading,
  onSave,
}: {
  isRTL: boolean;
  groupId: string;
  roundMatches: GroupRoundMatch[];
  roundMeta?: { id: string; date: string; status: string; number?: number | null } | null;
  roundLoading?: boolean;
  onSave: (
    predictions: Array<{
      apiMatchId: number;
      mode: 'WINNER' | 'EXACT';
      predictedWinner?: 'home' | 'draw' | 'away';
      predictedHomeScore?: number;
      predictedAwayScore?: number;
    }>,
  ) => Promise<void>;
}) {
  const { medium, bold, extra } = usePGFonts();
  const { t } = useTranslation();
  const pg = t.predictionGroups;
  const toast = useToast();
  const [drafts, setDrafts] = useState<
    Record<number, { mode: 'WINNER' | 'EXACT'; home: number; away: number; winner: 'home' | 'draw' | 'away' | null }>
  >({});
  const [saving, setSaving] = useState(false);
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  const savedMatchIds = useMemo(
    () => new Set(roundMatches.filter((m) => m.prediction).map((m) => m.apiMatchId)),
    [roundMatches],
  );

  useEffect(() => {
    if (!roundMatches.length) return;
    const seeded: typeof drafts = {};
    for (const m of roundMatches) {
      if (!m.prediction) continue;
      const p = m.prediction;
      seeded[m.apiMatchId] = {
        mode: p.mode,
        home: p.predictedHomeScore ?? 0,
        away: p.predictedAwayScore ?? 0,
        winner: (p.predictedWinner as 'home' | 'draw' | 'away' | null) ?? null,
      };
    }
    if (Object.keys(seeded).length > 0) {
      setDrafts((prev) => ({ ...prev, ...seeded }));
    }
  }, [roundMatches]);

  const data = useMemo(() => roundMatches.map(mapRoundMatchToCard), [roundMatches]);

  const roundMetaDisplay = useMemo(() => {
    const n = roundMeta?.number != null ? Number(roundMeta.number) : null;
    return {
      title: n ? pg.predictions.roundTitle.replace('{n}', String(n)) : pg.predictions.roundTitleDefault,
      sub: pg.predictions.roundSubLive,
    };
  }, [pg.predictions, roundMeta?.number]);

  const handleDraft = useCallback(
    (
      apiMatchId: number,
      patch: Partial<{ mode: 'WINNER' | 'EXACT'; home: number; away: number; winner: 'home' | 'draw' | 'away' | null }>,
    ) => {
      if (savedMatchIds.has(apiMatchId) || saving) return;
      setDrafts((prev) => ({
        ...prev,
        [apiMatchId]: {
          mode: patch.mode ?? prev[apiMatchId]?.mode ?? 'WINNER',
          home: patch.home ?? prev[apiMatchId]?.home ?? 0,
          away: patch.away ?? prev[apiMatchId]?.away ?? 0,
          winner: patch.winner !== undefined ? patch.winner : (prev[apiMatchId]?.winner ?? null),
        },
      }));
    },
    [savedMatchIds, saving],
  );

  const hasUnsavedPicks = useMemo(
    () =>
      Object.entries(drafts).some(([id, d]) => {
        if (savedMatchIds.has(Number(id))) return false;
        return d.mode === 'EXACT' || d.winner != null;
      }),
    [drafts, savedMatchIds],
  );

  const isAlreadySavedError = (msg: string) =>
    /تعديل|change|already|PREDICTION_ALREADY_SET/i.test(msg);

  const onSavePress = useCallback(async () => {
    const predictions = Object.entries(drafts)
      .filter(([id, d]) => !savedMatchIds.has(Number(id)) && (d.mode === 'EXACT' || d.winner != null))
      .map(([id, d]) => {
        const apiMatchId = Number(id);
        if (d.mode === 'EXACT') {
          let predictedWinner: 'home' | 'draw' | 'away' = 'draw';
          if (d.home > d.away) predictedWinner = 'home';
          else if (d.away > d.home) predictedWinner = 'away';
          return {
            apiMatchId,
            mode: 'EXACT' as const,
            predictedHomeScore: d.home,
            predictedAwayScore: d.away,
            predictedWinner,
          };
        }
        return {
          apiMatchId,
          mode: 'WINNER' as const,
          predictedWinner: d.winner as 'home' | 'draw' | 'away',
        };
      });

    if (predictions.length === 0) {
      toast.showError(pg.toast.noPredictionsTitle, pg.toast.noPredictionsBody);
      return;
    }

    setSaving(true);
    try {
      await onSave(predictions);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      toast.showSuccess(pg.toast.savedTitle, pg.toast.savedBody);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : '';
      toast.showError(pg.toast.saveFailedTitle, isAlreadySavedError(msg) ? pg.toast.alreadySaved : msg || pg.screen.loadFailed);
    } finally {
      setSaving(false);
    }
  }, [drafts, onSave, pg.screen.loadFailed, pg.toast, savedMatchIds, toast]);

  if (roundLoading && roundMatches.length === 0) {
    return <RoundMatchesSkeleton isRTL={isRTL} />;
  }

  return (
    <View style={{ gap: PG_SPACING.lg }}>
      <PointsSystemCard isRTL={isRTL} />

      <View style={styles.roundCard}>
        <LinearGradient
          colors={PG_GRADIENTS.roundWash}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.roundHead, row]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.roundTitle, { fontFamily: extra, textAlign: align }]}>
              {roundMetaDisplay.title}
            </Text>
            <Text style={[styles.roundSub, { fontFamily: medium, textAlign: align }]}>
              {roundMetaDisplay.sub}
            </Text>
          </View>
          <View style={styles.calBox}>
            <Calendar size={20} color={PG.purpleSoft} />
          </View>
        </View>
      </View>

      {roundMatches.length === 0 ? (
        <View style={styles.emptyWrap}>
          <Text style={[styles.emptyText, { fontFamily: medium, textAlign: align }]}>
            {pg.screen.noMatches}
          </Text>
        </View>
      ) : (
        data.map((m) => {
          const apiMatchId = m.apiMatchId!;
          const matchRow = roundMatches.find((r) => r.apiMatchId === apiMatchId);
          const status = matchRow?.status ?? '';
          const prediction = matchRow?.prediction;
          const saved = Boolean(prediction);
          const locked = saved || (status !== 'NS' && status !== 'TBD' && status !== '');
          const finished = status === 'FT' || status === 'AET' || status === 'PEN';
          return (
            <MatchPredictionCard
              key={m.id}
              match={m}
              isRTL={isRTL}
              locked={locked}
              saved={saved}
              finished={finished}
              apiMatchId={apiMatchId}
              initialPrediction={prediction}
              onDraftChange={!saved && !saving ? (patch) => handleDraft(apiMatchId, patch) : undefined}
            />
          );
        })
      )}

      {hasUnsavedPicks && (
        <Pressable
          onPress={() => void onSavePress()}
          disabled={saving}
          style={({ pressed }) => [pressed && { opacity: 0.92 }, saving && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityState={{ disabled: saving }}
        >
          <LinearGradient
            colors={PG_GRADIENTS.purple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveBtn}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={[styles.saveTxt, { fontFamily: bold }]}>{pg.predictions.save}</Text>
            )}
          </LinearGradient>
        </Pressable>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  loadingWrap: {
    paddingVertical: 48,
    alignItems: 'center',
    gap: 12,
  },
  loadingText: {
    color: PG.textMuted,
    fontSize: 13,
  },
  emptyWrap: {
    paddingVertical: 32,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  emptyText: {
    color: PG.textMuted,
    fontSize: 14,
    lineHeight: 20,
  },
  roundCard: {
    borderRadius: PG_RADII.lg,
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.3)',
    padding: 16,
    overflow: 'hidden',
    gap: 12,
  },
  roundHead: { alignItems: 'center', gap: 12 },
  roundTitle: { color: PG.text, fontSize: 18 },
  roundSub: { color: PG.textSecondary, fontSize: 12, marginTop: 3 },
  calBox: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)',
  },
  pointsCard: { padding: 14, gap: 12 },
  pointsCardTitle: { color: PG.text, fontSize: 14 },
  pointsCols: { alignItems: 'center', gap: 12 },
  pointsCol: { flex: 1, alignItems: 'center', gap: 8 },
  pointsIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pointsColTitle: { color: PG.textSecondary, fontSize: 11 },
  pointsColValue: { fontSize: 13, marginTop: 1 },
  pointsDivider: { width: 1, alignSelf: 'stretch', backgroundColor: 'rgba(255,255,255,0.08)' },
  saveBtn: {
    borderRadius: PG_RADII.lg,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 52,
    shadowColor: PG.purple,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 8,
  },
  saveTxt: { color: '#fff', fontSize: 15 },
});
