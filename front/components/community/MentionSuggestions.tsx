import React, { memo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import type { CommunityAuthor } from '../../services/community.api';
import { CommunityAvatar } from './CommunityAvatar';
import { C, CI } from './theme';

interface Props {
  users: CommunityAuthor[];
  loading: boolean;
  emptyLabel: string;
  fontFamily: string;
  onPick: (user: CommunityAuthor) => void;
}

export const MentionSuggestions = memo(function MentionSuggestions({ users, loading, emptyLabel, fontFamily, onPick }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)} style={styles.box}>
      {loading && !users.length ? (
        <View style={styles.center}>
          <ActivityIndicator color={C.accentSoft} />
        </View>
      ) : !users.length ? (
        <Text style={[styles.empty, { fontFamily }]}>{emptyLabel}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 220 }}>
          {users.map((u) => (
            <Pressable key={u.id} onPress={() => onPick(u)} style={styles.row}>
              <CommunityAvatar uri={u.avatar} name={u.displayName || u.username} size={32} ring={false} />
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={[styles.name, { fontFamily }]} numberOfLines={1}>
                    {u.displayName || u.username}
                  </Text>
                  {u.isVerified && <Image source={CI.verified} style={{ width: 14, height: 14 }} contentFit="contain" />}
                </View>
                <Text style={[styles.handle, { fontFamily }]} numberOfLines={1}>
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
    backgroundColor: C.input,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.inputBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  center: {
    padding: 16,
    alignItems: 'center',
  },
  empty: {
    color: C.muted,
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
    color: C.textStrong,
    fontSize: 14,
    fontWeight: '600',
    flexShrink: 1,
  },
  handle: {
    color: C.muted,
    fontSize: 12,
  },
});
