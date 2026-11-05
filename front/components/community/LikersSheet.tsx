import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { X } from 'lucide-react-native';

import { communityApi, type CommunityAuthor } from '../../services/community.api';
import { useCommunityToken } from '../../hooks/community/useCommunityFeed';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { CommunityAvatar } from './CommunityAvatar';
import { C } from './theme';

interface Props {
  postId: string;
  visible: boolean;
  onClose: () => void;
  onProfile: (username: string) => void;
}

export function LikersSheet({ postId, visible, onClose, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const getToken = useCommunityToken();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const font = getAppFont(600, language);
  const fontReg = getAppFont(400, language);
  const [items, setItems] = useState<CommunityAuthor[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (next: string | null, append: boolean) => {
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const page = await communityApi.postLikes(getToken, postId, next);
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch {
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getToken, postId],
  );

  useEffect(() => {
    if (!visible) return;
    setItems([]);
    setCursor(null);
    void load(null, false);
  }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.header, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.title, { fontFamily: font }]}>{s.likedBy}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <X size={20} color={C.muted} />
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 28 }} color={C.accentSoft} />
        ) : !items.length ? (
          <Text style={[styles.empty, { fontFamily: fontReg }]}>{s.noLikes}</Text>
        ) : (
          <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 420 }}>
            {items.map((user) => {
              const name = user.displayName || user.username;
              return (
                <Pressable
                  key={user.id}
                  onPress={() => {
                    onClose();
                    onProfile(user.username);
                  }}
                  style={[styles.row, { flexDirection: isAr ? 'row-reverse' : 'row' }]}
                >
                  <CommunityAvatar uri={user.avatar} name={name} size={40} ring={false} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { fontFamily: font, textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
                      {name}
                    </Text>
                    <Text style={[styles.handle, { fontFamily: fontReg, textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
                      @{user.username}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {cursor ? (
              <Pressable onPress={() => void load(cursor, true)} style={styles.more} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator color={C.accentSoft} />
                ) : (
                  <Text style={[styles.moreText, { fontFamily: font }]}>{s.loadMore}</Text>
                )}
              </Pressable>
            ) : null}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#12081F',
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
    borderColor: 'rgba(183,154,248,0.25)',
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  title: {
    color: C.textStrong,
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    color: C.muted,
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 14,
  },
  row: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  name: {
    color: C.textStrong,
    fontSize: 15,
    fontWeight: '600',
  },
  handle: {
    color: C.muted,
    fontSize: 12,
    marginTop: 2,
  },
  more: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  moreText: {
    color: C.accentSoft,
    fontSize: 14,
    fontWeight: '600',
  },
});
