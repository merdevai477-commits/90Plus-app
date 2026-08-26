/**
 * In-page segmented tabs: Matches | Standings — Figma 477:2766.
 */

import { Image } from 'expo-image';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { useTranslation } from '../../src/i18n';
import { usePGFonts } from './theme';

const ICON_FOOTBALL = require('../../assets/images/prediction-groups/icon-football.svg');
const ICON_LEADERBOARD = require('../../assets/images/prediction-groups/icon-leaderboard.svg');

export type CupTabKey = 'matches' | 'standings';

export function CupSegmentTabs({
  isRTL,
  active,
  matchesLabel,
  standingsLabel,
  onChange,
}: {
  isRTL: boolean;
  active: CupTabKey;
  matchesLabel: string;
  standingsLabel: string;
  onChange: (key: CupTabKey) => void;
}) {
  const { bold, medium } = usePGFonts();
  const { direction } = useTranslation();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  return (
    <View style={[styles.shell, row]}>
      <Pressable
        onPress={() => onChange('matches')}
        style={[styles.item, active === 'matches' && styles.itemActive]}
      >
        <View style={[styles.itemInner, row]}>
          <Text
            style={[
              styles.label,
              {
                fontFamily: bold,
                color: active === 'matches' ? '#9C75F5' : '#6C6C6C',
                fontSize: active === 'matches' ? 17 : 14,
                writingDirection: direction,
              },
            ]}
          >
            {matchesLabel}
          </Text>
          <Image
            source={ICON_FOOTBALL}
            style={[styles.icon, active !== 'matches' && styles.iconMuted]}
            contentFit="contain"
            transition={0}
          />
        </View>
      </Pressable>
      <Pressable
        onPress={() => onChange('standings')}
        style={[styles.item, active === 'standings' && styles.itemActive]}
      >
        <View style={[styles.itemInner, row]}>
          <Text
            style={[
              styles.label,
              {
                fontFamily: active === 'standings' ? bold : medium,
                color: active === 'standings' ? '#9C75F5' : '#6C6C6C',
                fontSize: active === 'standings' ? 17 : 14,
                writingDirection: direction,
              },
            ]}
          >
            {standingsLabel}
          </Text>
          <Image
            source={ICON_LEADERBOARD}
            style={[styles.iconSm, active !== 'standings' && styles.iconMuted]}
            contentFit="contain"
            transition={0}
          />
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 16,
    marginTop: 14,
    height: 54,
    borderRadius: 16,
    backgroundColor: 'rgba(17,3,49,0.2)',
    overflow: 'hidden',
  },
  item: { flex: 1, justifyContent: 'center' },
  itemActive: {
    backgroundColor: 'rgba(17,3,49,0.32)',
    borderRadius: 16,
  },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 5,
    minHeight: 54,
  },
  label: { textAlign: 'center' },
  icon: { width: 24, height: 24 },
  iconSm: { width: 18, height: 18 },
  iconMuted: { opacity: 0.45 },
});
