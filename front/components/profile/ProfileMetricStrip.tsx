import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
  const inner = (
    <View style={styles.row}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 && <View style={styles.divider} />}
          <MetricCell item={item} />
        </React.Fragment>
      ))}
    </View>
  );

  if (variant === 'performance') {
    return (
      <LinearGradient
        colors={['#0F081B', '#16092F']}
        start={{ x: 0.5, y: 1 }}
        end={{ x: 0.5, y: 0 }}
        style={[styles.card, styles.performanceCard]}
      >
        {inner}
      </LinearGradient>
    );
  }

  return <View style={[styles.card, styles.socialCard]}>{inner}</View>;
});

function MetricCell({ item }: { item: ProfileMetricItem }) {
  const body = (
    <View style={styles.cell}>
      <Image source={item.icon} style={styles.icon} contentFit="contain" />
      <Text style={styles.value} numberOfLines={1}>
        {formatProfileStat(item.value)}
      </Text>
      <Text style={styles.label} numberOfLines={1}>
        {item.label}
      </Text>
    </View>
  );

  if (!item.onPress) return body;

  return (
    <TouchableOpacity
      style={styles.touch}
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
  },
  socialCard: {
    backgroundColor: ProfileTheme.colors.profileCard,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    marginTop: -72,
  },
  performanceCard: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 47,
    backgroundColor: 'rgba(168,85,247,0.28)',
  },
  touch: {
    flex: 1,
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
  },
  icon: {
    width: 28,
    height: 28,
  },
  value: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
  },
  label: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 9,
    fontWeight: '500',
    textAlign: 'center',
  },
});
