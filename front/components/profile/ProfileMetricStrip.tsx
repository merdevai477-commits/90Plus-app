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
          <MetricCell item={item} compact={isPerf} social={!isPerf} />
        </React.Fragment>
      ))}
    </View>
  );

  if (variant === 'performance') {
    return <View style={[styles.card, styles.performanceCard]}>{inner}</View>;
  }

  return <View style={[styles.card, styles.socialCard]}>{inner}</View>;
});

function MetricCell({
  item,
  compact,
  social,
}: {
  item: ProfileMetricItem;
  compact: boolean;
  social: boolean;
}) {
  const body = (
    <View style={[styles.cell, compact && styles.perfCell, social && styles.socialCell]}>
      <View style={[styles.iconBox, social && styles.socialIconBox]}>
        <Image
          source={item.icon}
          style={[styles.icon, social && styles.socialIcon]}
          contentFit="contain"
        />
      </View>
      <View style={styles.copy}>
        <Text
          style={[styles.value, social && styles.socialValue]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.15}
        >
          {formatProfileStat(item.value)}
        </Text>
        <Text
          style={[styles.label, compact && styles.perfLabel, social && styles.socialLabel]}
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
    marginHorizontal: 20,
    borderRadius: 20,
    paddingVertical: 12,
    paddingHorizontal: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ProfileTheme.colors.profileCard,
  },
  socialCard: {
    marginTop: 14,
    height: 90,
  },
  performanceCard: {
    marginTop: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    width: '100%',
  },
  perfRow: {
    gap: 0,
    justifyContent: 'space-between',
  },
  divider: {
    width: 1,
    height: 44,
    backgroundColor: ProfileTheme.colors.divider,
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
  socialCell: {
    width: 116,
    gap: 1,
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
  socialIconBox: {
    width: 23,
    height: 22,
  },
  icon: {
    width: 28,
    height: 28,
  },
  socialIcon: {
    width: 22,
    height: 22,
    tintColor: ProfileTheme.colors.profilePrimary,
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
    fontWeight: '700',
    textAlign: 'center',
  },
  socialValue: {
    fontSize: 23,
  },
  label: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
  socialLabel: {
    color: ProfileTheme.colors.textPrimary,
    fontSize: 14,
    fontWeight: '400',
  },
  perfLabel: {
    fontSize: 9,
    lineHeight: 12,
    minHeight: 24,
  },
});
