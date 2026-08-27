import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageSourcePropType } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
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
      <View style={styles.iconBox}>
        <Image source={item.icon} style={styles.icon} contentFit="contain" />
      </View>
      <View style={styles.copy}>
        <Text style={styles.value} numberOfLines={1}>
          {formatProfileStat(item.value)}
        </Text>
        <Text style={styles.label} numberOfLines={1}>
          {item.label}
        </Text>
      </View>
    </View>
  );

  if (!item.onPress) return body;

  return (
    <TouchableOpacity
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
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialCard: {
    backgroundColor: '#0E071C',
    borderWidth: 0.5,
    borderColor: '#250A3F',
    marginTop: -72,
  },
  performanceCard: {
    marginTop: 12,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 23,
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 47,
    backgroundColor: '#250A3F',
  },
  cell: {
    width: 56,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
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
    gap: 4,
  },
  value: {
    color: '#FFFFFF',
    fontSize: 18,
    fontFamily: FONT_BOLD,
    fontWeight: '700',
    textAlign: 'center',
  },
  label: {
    color: '#B7B7B7',
    fontSize: 9,
    fontFamily: FONT_MEDIUM,
    fontWeight: '500',
    textAlign: 'center',
  },
});
