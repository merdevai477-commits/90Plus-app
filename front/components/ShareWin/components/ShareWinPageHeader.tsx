/**
 * Share & Win top chrome — professional back island on the left,
 * title dead-center (plain text, not an island).
 */

import React, { memo, useMemo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

import { GlassRim, GlassSheen } from '../../navigation/glass';
import { getAppFont } from '../../../utils/fontSetup';
import { useTranslation } from '../../../src/i18n';
import { useShareWinStyles } from '../styles';

interface ShareWinPageHeaderProps {
  title: string;
  subtitle?: string | null;
  onBack: () => void;
  backLabel: string;
  testID?: string;
}

const ISLAND = 42;

const ShareWinPageHeader = memo(function ShareWinPageHeader({
  title,
  subtitle,
  onBack,
  backLabel,
  testID = 'share-win-back',
}: ShareWinPageHeaderProps) {
  const insets = useSafeAreaInsets();
  const { metrics, theme } = useShareWinStyles();
  const { language } = useTranslation();
  const { s, f } = metrics;
  const size = s(ISLAND);
  const radius = size / 2;
  const fill = theme.isDark
    ? (['rgba(28,16,56,0.92)', 'rgba(18,10,40,0.96)'] as const)
    : (['rgba(255,255,255,0.96)', 'rgba(243,237,255,0.98)'] as const);
  const rimTint = theme.isDark ? 'rgba(168,85,247,0.45)' : 'rgba(106,43,217,0.38)';
  const iconColor = theme.isDark ? '#FFFFFF' : theme.primary;

  const styles = useMemo(
    () =>
      StyleSheet.create({
        bar: {
          width: '100%',
          minHeight: s(66),
          paddingTop: insets.top + s(8),
          paddingBottom: s(10),
          paddingHorizontal: Math.max(insets.left, insets.right, s(16)),
          backgroundColor: theme.screen,
          zIndex: 40,
          justifyContent: 'center',
        },
        row: {
          minHeight: size,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        sideSlot: {
          width: size,
          height: size,
          zIndex: 2,
        },
        backPressable: {
          width: size,
          height: size,
        },
        backIsland: {
          width: size,
          height: size,
          borderRadius: radius,
          alignItems: 'center',
          justifyContent: 'center',
          overflow: 'hidden',
          shadowColor: '#7C4DFF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: theme.isDark ? 0.45 : 0.22,
          shadowRadius: 12,
          elevation: 6,
        },
        backClip: {
          borderRadius: radius,
          overflow: 'hidden',
        },
        titleCenter: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: size + s(12),
          zIndex: 1,
          gap: s(2),
        },
        title: {
          fontFamily: getAppFont(700, language),
          fontSize: f(subtitle ? 18 : 22),
          color: theme.ink,
          textAlign: 'center',
        },
        subtitle: {
          fontFamily: getAppFont(500, language),
          fontSize: f(12),
          color: theme.muted,
          textAlign: 'center',
        },
        pressed: {
          transform: [{ scale: 0.92 }],
          opacity: 0.9,
        },
      }),
    [f, insets.left, insets.right, insets.top, language, radius, s, size, subtitle, theme],
  );

  return (
    <View style={styles.bar}>
      <View style={styles.row}>
        <View style={styles.sideSlot}>
          <Pressable
            onPress={onBack}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={backLabel}
            testID={testID}
            style={({ pressed }) => [styles.backPressable, pressed && styles.pressed]}
          >
            <View style={styles.backIsland}>
              {Platform.OS === 'ios' ? (
                <BlurView
                  intensity={theme.isDark ? 28 : 40}
                  tint={theme.isDark ? 'dark' : 'light'}
                  style={[StyleSheet.absoluteFill, styles.backClip]}
                />
              ) : null}
              <View style={[StyleSheet.absoluteFill, styles.backClip]}>
                <LinearGradient
                  colors={fill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={StyleSheet.absoluteFill}
                />
              </View>
              <GlassSheen radius={radius} intensity={theme.isDark ? 0.9 : 0.55} />
              <GlassRim radius={radius} tint={rimTint} />
              <ChevronLeft size={s(22)} color={iconColor} strokeWidth={2.6} />
            </View>
          </Pressable>
        </View>

        <View style={styles.titleCenter} pointerEvents="none">
          <Text style={styles.title} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            <Text style={styles.subtitle} numberOfLines={1}>
              {subtitle}
            </Text>
          ) : null}
        </View>

        {/* Balance the left island so the title stays optically centered. */}
        <View style={styles.sideSlot} pointerEvents="none" />
      </View>
    </View>
  );
});

export default ShareWinPageHeader;
