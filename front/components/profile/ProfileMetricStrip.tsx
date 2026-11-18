import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { formatProfileStat } from './formatProfileStat';

export interface ProfileMetricItem {
  key: string;
  icon: ImageSourcePropType;
  value: number | string;
  label: string;
  onPress?: () => void;
}

interface ProfileMetricStripProps {
  items: ProfileMetricItem[];
  variant?: 'social' | 'performance';
}

const FONT_BOLD = 'Inter_700Bold';
const FONT_MEDIUM = 'Inter_500Medium';

const ProfileMetricStrip = memo(function ProfileMetricStrip({
  items,
  variant = 'social',
}: ProfileMetricStripProps) {
  const isPerf = variant === 'performance';
  const inner = (
    <View style={[styles.row, isPerf && styles.perfRow]}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 && <View style={[styles.divider, isPerf && styles.perfDivider]} />}
          <MetricCell item={item} compact={isPerf} />
        </React.Fragment>
      ))}
    </View>
  );

  if (variant === 'performance') {
    return (
      <View style={[styles.card, styles.performanceCard]}>
        {inner}
      </View>
    );
  }

  return <View style={[styles.card, styles.socialCard]}>{inner}</View>;
});

function MetricCell({ item, compact }: { item: ProfileMetricItem; compact: boolean }) {
  const body = (
    <View style={[styles.cell, compact && styles.perfCell]}>
      <View style={styles.iconBox}>
        <Image source={item.icon} style={styles.icon} contentFit="contain" />
      </View>
      <View style={styles.copy}>
        <Text
          style={styles.value}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.15}
        >
          {formatProfileStat(item.value)}
        </Text>
        <Text
          style={[styles.label, compact && styles.perfLabel]}
          numberOfLines={compact ? 2 : 1}
          maxFontSizeMultiplier={1.15}
        >
          {item.label}
        </Text>
      </View>
    </View>
  );

  if (!item.onPress) {
    return compact ? <View style={styles.perfHit}>{body}</View> : body;
  }

  return (
    <TouchableOpacity
      style={compact ? styles.perfHit : undefined}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        item.onPress?.();
      }}
      activeOpacity={0.75}
    >
      {body}
    </TouchableOpacity>
  );
}

export default ProfileMetricStrip;

const styles = StyleSheet.create({
  card: {
    marginHorizontal: 22,
    borderRadius: 16,
    paddingVertical: 13,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ProfileTheme.colors.profileCard,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
  },
  socialCard: {
    marginTop: -72,
  },
  performanceCard: {
    marginTop: 12,
    paddingHorizontal: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    width: '100%',
  },
  perfRow: {
    gap: 0,
    justifyContent: 'space-between',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 47,
    backgroundColor: ProfileTheme.colors.profileCardBorder,
  },
  perfDivider: {
    height: 52,
    marginHorizontal: 2,
  },
  cell: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  perfCell: {
    width: '100%',
    minWidth: 0,
    paddingHorizontal: 2,
  },
  perfHit: {
    flex: 1,
    minWidth: 0,
  },
  iconBox: {
    width: 28,
    height: 28,
    overflow: 'hidden',
  },
  icon: {
    width: 28,
    height: 28,
  },
  copy: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: '100%',
  },
  value: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 16,
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 9,
    fontFamily: FONT_MEDIUM,
    fontWeight: '500',
    textAlign: 'center',
  },
  perfLabel: {
    fontSize: 9,
    lineHeight: 12,
    minHeight: 24,
  },
});
