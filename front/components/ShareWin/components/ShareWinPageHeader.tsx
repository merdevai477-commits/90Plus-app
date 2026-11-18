/**
 * Share & Win top chrome — back on the left, title island dead-center.
 * Used by the main Share & Win screen and the monthly leaderboard.
 */

import React, { memo, useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ChevronLeft } from 'lucide-react-native';

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
          minHeight: s(44),
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        },
        sideSlot: {
          width: s(44),
          height: s(44),
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 2,
        },
        backIsland: {
          width: s(40),
          height: s(40),
          borderRadius: s(14),
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: theme.isDark ? theme.cardAlt : theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#6A2BD9',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.isDark ? 0.25 : 0.1,
          shadowRadius: 6,
          elevation: 3,
        },
        titleIsland: {
          maxWidth: '72%',
          minHeight: s(40),
          borderRadius: s(16),
          paddingHorizontal: s(16),
          paddingVertical: s(6),
          alignItems: 'center',
          justifyContent: 'center',
          gap: s(2),
          backgroundColor: theme.isDark ? theme.cardAlt : theme.card,
          borderWidth: 1,
          borderColor: theme.border,
          shadowColor: '#6A2BD9',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: theme.isDark ? 0.28 : 0.12,
          shadowRadius: 8,
          elevation: 4,
        },
        titleCenter: {
          ...StyleSheet.absoluteFillObject,
          alignItems: 'center',
          justifyContent: 'center',
          paddingHorizontal: s(52),
          zIndex: 1,
        },
        title: {
          fontFamily: getAppFont(700, language),
          fontSize: f(subtitle ? 16 : 18),
          color: theme.ink,
          textAlign: 'center',
        },
        subtitle: {
          fontFamily: getAppFont(500, language),
          fontSize: f(11),
          color: theme.muted,
          textAlign: 'center',
        },
      }),
    [f, insets.left, insets.right, insets.top, language, s, subtitle, theme],
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
            style={({ pressed }) => [styles.backIsland, pressed && { opacity: 0.75 }]}
          >
            <ChevronLeft size={s(22)} color={theme.headerIcon} strokeWidth={2.5} />
          </Pressable>
        </View>

        <View style={styles.titleCenter} pointerEvents="none">
          <View style={styles.titleIsland}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
            {subtitle ? (
              <Text style={styles.subtitle} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Mirror the back slot so the island stays optically centered. */}
        <View style={styles.sideSlot} pointerEvents="none" />
      </View>
    </View>
  );
});

export default ShareWinPageHeader;
