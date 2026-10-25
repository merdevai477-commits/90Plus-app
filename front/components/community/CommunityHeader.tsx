import React, { memo } from 'react';
import { I18nManager, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CI } from './theme';

interface Props {
  title: string;
  subtitle?: string;
  fontFamily: string;
  onBack?: () => void;
  onBell?: () => void;
  onBrandPress?: () => void;
  onTitlePress?: () => void;
  right?: React.ReactNode;
  floating?: boolean;
}

const ACCENT = '#A855F7';
const ROW_H = 40;

/**
 * Floating transparent header — no blur bar. Equal side slots keep the
 * 90 PLUS + title pill optically centred over the feed.
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
  const BackIcon = I18nManager.isRTL ? ChevronRight : ChevronLeft;

  return (
    <View
      style={[styles.bar, floating && styles.floating, { paddingTop: topPad }]}
      pointerEvents="box-none"
    >
      <View style={[styles.side, styles.sideStart]} pointerEvents="box-none">
        {onBack ? (
          <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back" hitSlop={8} style={styles.iconBtn}>
            <BackIcon size={20} color="#FFF" strokeWidth={2.4} />
          </Pressable>
        ) : null}
      </View>

      <Pressable
        onPress={onTitlePress ?? onBrandPress}
        disabled={!onTitlePress && !onBrandPress}
        accessibilityRole="button"
        accessibilityLabel={`90 PLUS ${title}`}
        style={styles.logoPill}
      >
        <Text style={styles.logo90}>90</Text>
        <View style={styles.plusChip}>
          <Text style={styles.logoPlus}>PLUS</Text>
        </View>
        <View style={styles.titleCol}>
          <Text style={[styles.pillTitle, { fontFamily }]} numberOfLines={1}>
            {title}
          </Text>
          {!!subtitle && (
            <Text style={[styles.subtitle, { fontFamily }]} numberOfLines={1}>
              {subtitle}
            </Text>
          )}
        </View>
      </Pressable>

      <View style={[styles.side, styles.sideEnd]} pointerEvents="box-none">
        {right ??
          (onBell ? (
            <Pressable onPress={onBell} accessibilityRole="button" accessibilityLabel="Notifications" hitSlop={8} style={styles.iconBtn}>
              <Image source={CI.notification} style={styles.bell} contentFit="contain" />
            </Pressable>
          ) : null)}
      </View>
    </View>
  );
});

export function useCommunityHeaderOffset(): number {
  const insets = useSafeAreaInsets();
  return Math.max(insets.top, 10) + 10 + ROW_H + 10;
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  floating: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 100,
  },
  side: {
    flex: 1,
  },
  sideStart: {
    alignItems: 'flex-start',
  },
  sideEnd: {
    alignItems: 'flex-end',
  },
  iconBtn: {
    width: ROW_H,
    height: ROW_H,
    borderRadius: 14,
    backgroundColor: 'rgba(168,85,247,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoPill: {
    flexDirection: 'row',
    alignItems: 'center',
    maxWidth: '64%',
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 16,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
    backgroundColor: ACCENT,
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
    marginLeft: 2,
  },
  pillTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    letterSpacing: -0.2,
  },
  subtitle: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 1,
  },
  bell: { width: 20, height: 20 },
});
