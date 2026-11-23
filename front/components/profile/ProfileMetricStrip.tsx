import React, { memo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ImageSourcePropType,
  useWindowDimensions,
} from 'react-native';
import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useProfileTheme } from '../../hooks/useProfileTheme';
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

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Social metrics keep a fixed visual order (same in AR/EN):
 * Followers | Following | Likes
 */
const ProfileMetricStrip = memo(function ProfileMetricStrip({
  items,
  variant = 'social',
}: ProfileMetricStripProps) {
  const { colors: C } = useProfileTheme();
  const { width } = useWindowDimensions();
  const isPerf = variant === 'performance';
  const marginH = Math.min(20, Math.max(12, Math.round(width * 0.045)));
  const scale = clamp(width / 390, 0.88, 1.05);
  const valueSize = Math.round((isPerf ? 16 : 18) * scale);
  const labelSize = Math.round((isPerf ? 9 : 12) * scale);

  const inner = (
    <View style={[styles.row, isPerf && styles.perfRow]}>
      {items.map((item, index) => (
        <React.Fragment key={item.key}>
          {index > 0 && (
            <View
              style={[
                styles.divider,
                isPerf && styles.perfDivider,
                { backgroundColor: C.divider },
              ]}
            />
          )}
          <MetricCell
            item={item}
            compact={isPerf}
            social={!isPerf}
            colors={C}
            valueSize={valueSize}
            labelSize={labelSize}
          />
        </React.Fragment>
      ))}
    </View>
  );

  if (variant === 'performance') {
    return (
      <View
        style={[
          styles.card,
          styles.performanceCard,
          {
            backgroundColor: C.profileCard,
            borderColor: C.profileCardBorder,
            marginHorizontal: marginH,
          },
        ]}
      >
        {inner}
      </View>
    );
  }

  return (
    <View
      style={[
        styles.card,
        styles.socialCard,
        {
          backgroundColor: C.profileCard,
          borderColor: C.embossBorder,
          shadowColor: C.embossShadow,
          marginHorizontal: marginH,
        },
      ]}
    >
      {inner}
    </View>
  );
});

function MetricCell({
  item,
  compact,
  social,
  colors: C,
  valueSize,
  labelSize,
}: {
  item: ProfileMetricItem;
  compact: boolean;
  social: boolean;
  colors: ReturnType<typeof useProfileTheme>['colors'];
  valueSize: number;
  labelSize: number;
}) {
  const body = (
    <View style={[styles.cell, compact && styles.perfCell, social && styles.socialCell]}>
      <View style={[styles.iconBox, social && styles.socialIconBox]}>
        <Image
          source={item.icon}
          style={[styles.icon, social && styles.socialIcon, social && { tintColor: C.profilePrimary }]}
          contentFit="contain"
        />
      </View>
      <View style={styles.copy}>
        <Text
          style={[
            styles.value,
            {
              color: C.textPrimary,
              fontSize: valueSize,
              lineHeight: valueSize + 2,
            },
          ]}
          numberOfLines={1}
          adjustsFontSizeToFit
          minimumFontScale={0.7}
          maxFontSizeMultiplier={1.1}
          allowFontScaling={false}
        >
          {formatProfileStat(item.value)}
        </Text>
        <Text
          style={[
            styles.label,
            compact && styles.perfLabel,
            {
              color: social ? C.textPrimary : C.profileMuted,
              fontSize: labelSize,
              lineHeight: labelSize + 3,
            },
          ]}
          numberOfLines={1}
          maxFontSizeMultiplier={1.1}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
        >
          {item.label}
        </Text>
      </View>
    </View>
  );

  if (!item.onPress) {
    return <View style={styles.hit}>{body}</View>;
  }

  return (
    <TouchableOpacity
      style={styles.hit}
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        item.onPress?.();
      }}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`${item.value} ${item.label}`}
    >
      {body}
    </TouchableOpacity>
  );
}

export default ProfileMetricStrip;

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    paddingVertical: 10,
    paddingHorizontal: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: ProfileTheme.colors.profileCard,
  },
  socialCard: {
    marginTop: 10,
    minHeight: 76,
    borderWidth: 1,
    borderColor: 'rgba(106,43,217,0.12)',
    shadowColor: '#1E0844',
    shadowOpacity: 0.12,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 4,
  },
  performanceCard: {
    marginTop: 12,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
  },
  row: {
    // Locked LTR: Followers | Following | Likes (AR + EN).
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
  },
  perfRow: {
    gap: 0,
    justifyContent: 'space-between',
  },
  divider: {
    width: StyleSheet.hairlineWidth,
    height: 40,
    backgroundColor: ProfileTheme.colors.divider,
    flexShrink: 0,
  },
  perfDivider: {
    height: 52,
    marginHorizontal: 2,
  },
  hit: {
    flex: 1,
    minWidth: 0,
  },
  cell: {
    width: '100%',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  socialCell: {
    gap: 3,
  },
  perfCell: {
    paddingHorizontal: 2,
  },
  iconBox: {
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socialIconBox: {
    width: 20,
    height: 20,
  },
  icon: {
    width: 28,
    height: 28,
  },
  socialIcon: {
    width: 18,
    height: 18,
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
    fontWeight: '700',
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
  },
  label: {
    color: ProfileTheme.colors.profileMuted,
    fontWeight: '500',
    textAlign: 'center',
  },
  perfLabel: {
    minHeight: 20,
  },
});
