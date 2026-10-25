import React, { memo } from 'react';
import { Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlassView, isLiquidGlassSupported } from '../../utils/liquidGlassSafe';
import { C, CI } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  fontFamily: string;
  onBack?: () => void;
  onBell?: () => void;
  onBrandPress?: () => void;
  onTitlePress?: () => void;
  right?: React.ReactNode;
  /** When true, header floats over content (matches / rank style). */
  floating?: boolean;
}

const GlassSurface = isLiquidGlassSupported ? LiquidGlassView : BlurView;

/**
 * Matches / Rank style floating header: liquid-glass island with the 90 PLUS
 * brand pill, screen title, and actions.
 */
export const CommunityHeader = memo(function CommunityHeader({
  title,
  subtitle,
  fontFamily,
  onBack,
  onBell,
  onBrandPress,
  onTitlePress,
  right,
  floating = true,
}: Props) {
  const insets = useSafeAreaInsets();
  const topPad = Math.max(insets.top, 10) + 10;

  const glassProps = isLiquidGlassSupported
    ? ({ effect: 'clear', tint: 'rgba(5,1,13,0.1)' } as const)
    : ({ intensity: Platform.OS === 'ios' ? 28 : 60, tint: 'dark' as const });

  return (
    <GlassSurface
      {...(glassProps as any)}
      style={[
        styles.wrap,
        floating && styles.floating,
        { paddingTop: topPad },
        !isLiquidGlassSupported && styles.wrapFallback,
      ]}
    >
      <View style={styles.bar}>
        <View style={styles.left}>
          {onBack ? (
            <Pressable onPress={onBack} hitSlop={10} accessibilityRole="button" accessibilityLabel="Back" style={styles.backBtn}>
              <Image source={CI.back} style={styles.back} contentFit="contain" />
            </Pressable>
          ) : null}
          <Pressable
            onPress={onBrandPress}
            disabled={!onBrandPress}
            accessibilityRole="button"
            accessibilityLabel="90 PLUS"
            style={styles.logoPill}
          >
            <Text style={styles.logo90}>90</Text>
            <View style={styles.plusChip}>
              <Text style={styles.logoPlus}>PLUS</Text>
            </View>
          </Pressable>
          <Pressable onPress={onTitlePress} disabled={!onTitlePress} style={styles.titleCol}>
            <Text style={[styles.title, { fontFamily }]} numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.85}>
              {title}
            </Text>
            {!!subtitle && (
              <Text style={[styles.subtitle, { fontFamily }]} numberOfLines={1}>
                {subtitle}
              </Text>
            )}
          </Pressable>
        </View>

        <View style={styles.right}>
          {right ??
            (onBell && (
              <Pressable onPress={onBell} hitSlop={10} accessibilityRole="button" accessibilityLabel="Notifications" style={styles.bellBtn}>
                <Image source={CI.notification} style={styles.bell} contentFit="contain" />
              </Pressable>
            ))}
        </View>
      </View>
    </GlassSurface>
  );
});

/** Height below the status bar — use as content paddingTop when floating. */
export function useCommunityHeaderOffset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 10) + 60;
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  wrapFallback: {
    backgroundColor: 'rgba(9,7,16,0.88)',
  },
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  bar: {
    minHeight: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  left: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  backBtn: {
    marginRight: -2,
  },
  back: { width: 34, height: 34 },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 5,
  },
  logo90: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '900',
    letterSpacing: 0.3,
  },
  plusChip: {
    backgroundColor: C.accent,
    borderRadius: 5,
    paddingHorizontal: 5,
    paddingVertical: 2,
  },
  logoPlus: {
    color: '#fff',
    fontSize: 8,
    fontWeight: '900',
    letterSpacing: 0.8,
  },
  titleCol: {
    flexShrink: 1,
  },
  title: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: -0.3,
  },
  subtitle: {
    color: C.muted,
    fontSize: 11,
    marginTop: 1,
  },
  bellBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  bell: { width: 22, height: 22 },
});
