/**
 * Daily motivational card — shows the viewer's standing in today's ranking
 * (leading / points to next rank / start predicting).
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Crown, Flame, Target } from 'lucide-react-native';
import React, { useMemo } from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { GroupDailyInsight } from '../../services/predictionGroups.service';
import { buildGroupMotivationText } from '../../utils/groupInsights';
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

export function GroupMotivationCard({
  insight,
  isRTL,
}: {
  insight: GroupDailyInsight | null | undefined;
  isRTL: boolean;
}) {
  const { medium, bold, extra } = usePGFonts();
  const { t } = useTranslation();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const textAlign = isRTL ? 'right' : 'left';

  const message = useMemo(
    () => buildGroupMotivationText(insight, t.predictionGroups.motivation),
    [insight, t.predictionGroups.motivation],
  );

  const leading = Boolean(insight?.isLeading);
  const ranked = insight?.rank != null;

  const Icon = leading ? Crown : ranked ? Flame : Target;
  const accent = leading ? PG.gold : PG.primaryLight;
  const gradient: [string, string] = leading
    ? ['rgba(245,185,66,0.16)', 'rgba(245,185,66,0.03)']
    : ['rgba(124,58,237,0.16)', 'rgba(124,58,237,0.03)'];

  return (
    <View style={styles.wrap}>
      <LiquidGlassSurface borderRadius={PG_RADII.lg} subtleShadow style={styles.card}>
        <LinearGradient
          colors={gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFillObject}
          pointerEvents="none"
        />
        <View style={[styles.inner, row]}>
          <View style={[styles.iconWrap, { borderColor: `${accent}55`, backgroundColor: `${accent}22` }]}>
            <Icon size={20} color={accent} />
          </View>
          <View style={styles.textCol}>
            <Text style={[styles.title, { fontFamily: extra, textAlign }]}>{t.predictionGroups.motivation.title}</Text>
            <Text style={[styles.message, { fontFamily: medium, textAlign }]}>{message}</Text>
          </View>
          {ranked ? (
            <View style={styles.rankBadge}>
              <Text style={[styles.rankNum, { fontFamily: bold, color: accent }]}>#{insight?.rank}</Text>
            </View>
          ) : null}
        </View>
      </LiquidGlassSurface>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 16, paddingTop: 12 },
  card: { overflow: 'hidden' },
  inner: {
    alignItems: 'center',
    gap: PG_SPACING.md,
    paddingHorizontal: PG_SPACING.md,
    paddingVertical: PG_SPACING.md,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  textCol: { flex: 1, gap: 2 },
  title: { color: PG.text, fontSize: PG_TYPE.body },
  message: { color: PG.textSecondary, fontSize: PG_TYPE.caption, lineHeight: 18 },
  rankBadge: {
    minWidth: 40,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: PG_RADII.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  rankNum: { fontSize: 16 },
});
