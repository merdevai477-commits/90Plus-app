/**
 * Compact VS match card with Predict Now CTA — Figma 477:2766.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { PredictionMatch } from './data';
import { usePGFonts } from './theme';

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
  const { bold, medium } = usePGFonts();
  const { t, direction } = useTranslation();
  const pg = t.predictionGroups.predictions;
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const disabled = saved || locked;

  const team = (side: 'home' | 'away', size: number) => {
    const tm = match[side];
    return (
      <View style={[styles.team, { width: side === 'home' ? 60 : 49 }]}>
        <TeamBadge name={tm.name} logo={tm.logo ?? undefined} size={size} color="transparent" />
        <Text
          style={[
            styles.teamName,
            { fontFamily: bold, fontSize: side === 'home' ? 13 : 14, writingDirection: direction },
          ]}
          numberOfLines={2}
        >
          {tm.name}
        </Text>
      </View>
    );
  };

  return (
    <LinearGradient
      colors={['#0C051A', '#07040D']}
      start={{ x: 0.5, y: 0 }}
      end={{ x: 0.5, y: 1 }}
      style={styles.card}
    >
      <View style={[styles.row, row]}>
        {team('home', 40)}
        <View style={styles.mid}>
          <Text style={[styles.vs, { fontFamily: bold }]}>VS</Text>
          <Text style={[styles.time, { fontFamily: medium }]}>{match.time}</Text>
          <Pressable
            disabled={disabled}
            onPress={onPredict}
            style={({ pressed }) => [pressed && { opacity: 0.9 }, disabled && { opacity: 0.7 }]}
          >
            <LinearGradient
              colors={['rgba(53,6,98,0.56)', 'rgba(26,4,47,0.56)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.cta}
            >
              <Text style={[styles.ctaTxt, { fontFamily: bold, writingDirection: direction }]}>
                {saved ? pg.predicted : pg.predictNow}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>
        {team('away', 43)}
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 16,
    marginTop: 16,
    height: 133,
    paddingHorizontal: 34,
    borderRadius: 25,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(83,25,138,0.65)',
    justifyContent: 'center',
  },
  row: { alignItems: 'center', justifyContent: 'space-between' },
  team: { alignItems: 'center', gap: 9 },
  teamName: { color: '#fff', textAlign: 'center' },
  mid: { width: 105, alignItems: 'center', gap: 9, height: 133, justifyContent: 'center' },
  vs: { color: '#A855F7', fontSize: 21 },
  time: { color: '#777', fontSize: 13 },
  cta: {
    width: 105,
    height: 33,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#580E9E',
  },
  ctaTxt: { color: '#D6AEFC', fontSize: 10 },
});
