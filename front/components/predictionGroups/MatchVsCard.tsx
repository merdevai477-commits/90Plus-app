/**
 * Compact VS match card with Predict Now CTA.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { PredictionMatch } from './data';
import { PG, PG_GRADIENTS, PG_RADII, usePGFonts } from './theme';

export function MatchVsCard({
  match,
  isRTL,
  saved,
  locked,
  onPredict,
}: {
  match: PredictionMatch;
  isRTL: boolean;
  saved?: boolean;
  locked?: boolean;
  onPredict: () => void;
}) {
  const { extra, medium, bold } = usePGFonts();
  const { t } = useTranslation();
  const pg = t.predictionGroups.predictions;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const disabled = saved || locked;

  const team = (side: 'home' | 'away') => {
    const tm = match[side];
    return (
      <View style={styles.team}>
        <TeamBadge name={tm.name} logo={tm.logo ?? undefined} size={48} color="transparent" />
        <Text style={[styles.teamName, { fontFamily: medium }]} numberOfLines={2}>
          {tm.name}
        </Text>
      </View>
    );
  };

  return (
    <View style={styles.card}>
      <View style={[styles.row, row]}>
        {team('home')}
        <View style={styles.mid}>
          <Text style={[styles.vs, { fontFamily: extra }]}>VS</Text>
          <Text style={[styles.time, { fontFamily: medium }]}>{match.time}</Text>
          <Pressable
            disabled={disabled}
            onPress={onPredict}
            style={({ pressed }) => [pressed && { opacity: 0.9 }, disabled && { opacity: 0.7 }]}
          >
            <LinearGradient colors={[...PG_GRADIENTS.purple]} style={styles.cta}>
              <Text style={[styles.ctaTxt, { fontFamily: bold }]}>
                {saved ? pg.predicted : pg.predictNow}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
        {team('away')}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 10,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.border,
  },
  row: { alignItems: 'center' },
  team: { flex: 1, alignItems: 'center', gap: 6 },
  teamName: { color: PG.text, fontSize: 12, textAlign: 'center' },
  mid: { width: 118, alignItems: 'center', gap: 6 },
  vs: { color: PG.primaryLight, fontSize: 16, letterSpacing: 1 },
  time: { color: PG.textMuted, fontSize: 11 },
  cta: {
    minWidth: 108,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  ctaTxt: { color: '#fff', fontSize: 12 },
});
