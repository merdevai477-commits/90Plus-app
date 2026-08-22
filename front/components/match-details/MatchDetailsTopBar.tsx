import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
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
}: MatchDetailsTopBarProps): React.ReactElement {
  const insets = useSafeAreaInsets();

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
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
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
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    backgroundColor: HEADER_BG,
    paddingHorizontal: 24,
    paddingBottom: 10,
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
  title: {
    flex: 1,
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    textAlign: 'center',
  },
});
