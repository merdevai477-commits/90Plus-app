import React, { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import type { CommunityAuthor } from '../../services/community.api';
import { CommunityAvatar } from './CommunityAvatar';
import { useCommunityTheme } from '../../hooks/useCommunityTheme';
import { CI } from './theme';

interface Props {
  users: CommunityAuthor[];
  loading: boolean;
  emptyLabel: string;
  fontFamily: string;
  onPick: (user: CommunityAuthor) => void;
  everyone?: { label: string; hint: string; onPress: () => void } | null;
}

export const MentionSuggestions = memo(function MentionSuggestions({
  users,
  loading,
  emptyLabel,
  fontFamily,
  onPick,
  everyone,
}: Props) {
  const { colors } = useCommunityTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(120)}
      style={[styles.box, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
    >
      {loading && !users.length && !everyone ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.accentSoft} />
        </View>
      ) : !users.length && !everyone ? (
        <Text style={[styles.empty, { fontFamily, color: colors.muted }]}>{emptyLabel}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 220 }}>
          {everyone ? (
            <Pressable onPress={everyone.onPress} style={styles.row}>
              <View style={styles.everyoneBadge}>
                <Text style={[styles.everyoneMark, { fontFamily }]}>@</Text>
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.name, { fontFamily, color: colors.textStrong }]} numberOfLines={1}>
                  {everyone.label}
                </Text>
                <Text style={[styles.handle, { fontFamily, color: colors.muted }]} numberOfLines={1}>
                  {everyone.hint}
                </Text>
              </View>
            </Pressable>
          ) : null}
          {users.map((u) => (
            <Pressable key={u.id} onPress={() => onPick(u)} style={styles.row}>
              <CommunityAvatar uri={u.avatar} name={u.displayName || u.username} size={32} ring={false} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { fontFamily, color: colors.textStrong }]} numberOfLines={1}>
                    {u.displayName || u.username}
                  </Text>
                  {u.isVerified && <Image source={CI.verified} style={{ width: 14, height: 14 }} contentFit="contain" />}
                </View>
                <Text style={[styles.handle, { fontFamily, color: colors.muted }]} numberOfLines={1}>
                  @{u.username}
                </Text>
              </View>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  box: {
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  center: {
    padding: 16,
    alignItems: 'center',
  },
  empty: {
    padding: 14,
    textAlign: 'center',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  name: {
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  handle: {
    fontSize: 12,
  },
  everyoneBadge: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(248,201,74,0.16)',
  },
  everyoneMark: {
    color: '#F8C94A',
    fontSize: 16,
    fontWeight: '700',
  },
});
