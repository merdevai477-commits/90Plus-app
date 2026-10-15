import React from 'react';
import { View, StyleSheet, TouchableOpacity, ActivityIndicator, Animated } from 'react-native';
import { Text } from './MatchText';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const HEADER_BG = '#0c051a';
const BELL = '#810af2';

type MatchDetailsTopBarProps = {
  title: string;
  backLabel: string;
  notificationsLabel: string;
  onBack: () => void;
  onNotifications: () => void;
  /** When true, show filled bell (subscribed to this match's push). */
  isSubscribed?: boolean;
  /** Disable toggle while request in flight or match finished. */
  notificationsDisabled?: boolean;
  notificationsLoading?: boolean;
  /** Shown in place of the title as `collapseProgress` goes 0 → 1 (e.g. compact score). */
  compactContent?: React.ReactNode;
  /** Full-width strip pinned to the bar's bottom edge, faded in with `collapseProgress`. */
  compactFooter?: React.ReactNode;
  collapseProgress?: Animated.AnimatedInterpolation<number> | Animated.Value;
};

export function MatchDetailsTopBar({
  title,
  backLabel,
  notificationsLabel,
  onBack,
  onNotifications,
  isSubscribed = false,
  notificationsDisabled = false,
  notificationsLoading = false,
  compactContent,
  compactFooter,
  collapseProgress,
}: MatchDetailsTopBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();
  const titleOpacity = collapseProgress && compactContent ? Animated.subtract(1, collapseProgress) : 1;

  return (
    <View style={[styles.bar, { paddingTop: Math.max(insets.top, 12) }]}>
      <View style={styles.row}>
        <TouchableOpacity
          style={styles.iconHit}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel={backLabel}
        >
          <Ionicons name="arrow-back" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={styles.center}>
          <Animated.View style={[styles.centerLayer, { opacity: titleOpacity }]}>
            <Text style={styles.title} numberOfLines={1}>
              {title}
            </Text>
          </Animated.View>
          {compactContent && collapseProgress ? (
            <Animated.View
              pointerEvents="none"
              style={[styles.centerLayer, StyleSheet.absoluteFill, { opacity: collapseProgress }]}
            >
              {compactContent}
            </Animated.View>
          ) : null}
        </View>
        <TouchableOpacity
          style={styles.iconHit}
          onPress={onNotifications}
          disabled={notificationsDisabled || notificationsLoading}
          accessibilityRole="button"
          accessibilityLabel={notificationsLabel}
          accessibilityState={{ selected: isSubscribed, disabled: notificationsDisabled }}
        >
          {notificationsLoading ? (
            <ActivityIndicator size="small" color={BELL} />
          ) : (
            <Ionicons
              name={isSubscribed ? 'notifications' : 'notifications-outline'}
              size={26}
              color={notificationsDisabled ? 'rgba(129,10,242,0.45)' : BELL}
            />
          )}
        </TouchableOpacity>
      </View>
      {compactFooter && collapseProgress ? (
        <Animated.View pointerEvents="none" style={[styles.footer, { opacity: collapseProgress }]}>
          {compactFooter}
        </Animated.View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 24,
    paddingBottom: 10,
    zIndex: 3,
  },
  row: {
    height: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  iconHit: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  center: {
    flex: 1,
    height: 38,
  },
  centerLayer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
