import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { X } from 'lucide-react-native';

import { ReelsService } from '../../src/services/authService';
import { useTranslation } from '../../src/i18n';
import { getAppFont } from '../../utils/fontSetup';
import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';

type Liker = {
  id: string;
  username: string;
  displayName: string | null;
  avatar: string | null;
  isVerified?: boolean;
};

type Props = {
  reelId: string | null;
  visible: boolean;
  onClose: () => void;
  onProfile: (username: string) => void;
};

export function ReelLikersSheet({ reelId, visible, onClose, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const { t, language } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const isAr = language === 'ar';
  const font = getAppFont(600, language);
  const fontReg = getAppFont(400, language);

  const sheetBg = isDark ? '#120a22' : '#ffffff';
  const ink = isDark ? 'rgba(255,255,255,0.92)' : '#24104e';
  const muted = isDark ? 'rgba(255,255,255,0.55)' : '#6b7387';
  const accent = isDark ? '#a78bfa' : '#6a2bd9';
  const border = isDark ? 'rgba(167,139,250,0.22)' : '#e8e0f5';
  const overlay = 'rgba(0,0,0,0.55)';

  const [items, setItems] = useState<Liker[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const load = useCallback(
    async (next: string | null, append: boolean) => {
      if (!reelId) return;
      if (append) setLoadingMore(true);
      else setLoading(true);
      try {
        const token = await getToken();
        if (!token) {
          if (!append) setItems([]);
          return;
        }
        const page = await ReelsService.getReelLikes(token, reelId, 30, next);
        setItems((prev) => (append ? [...prev, ...page.items] : page.items));
        setCursor(page.nextCursor);
      } catch {
        if (!append) setItems([]);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [getToken, reelId],
  );

  useEffect(() => {
    if (!visible || !reelId) return;
    setItems([]);
    setCursor(null);
    void load(null, false);
  }, [visible, reelId, load]);

  const title = t.reels.likedBy || t.community?.likedBy || (isAr ? 'الإعجابات' : 'Likes');
  const empty = t.reels.noLikes || t.community?.noLikes || (isAr ? 'لسه مفيش إعجابات' : 'No likes yet');
  const moreLabel = t.reels.loadMoreLikes || t.community?.loadMore || (isAr ? 'عرض المزيد' : 'Load more');

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: overlay }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            paddingBottom: Math.max(insets.bottom, 16),
            backgroundColor: sheetBg,
            borderColor: border,
          },
        ]}
      >
        <View style={[styles.header, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.title, { fontFamily: font, color: ink }]}>{title}</Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <X size={20} color={muted} />
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 28 }} color={accent} />
        ) : !items.length ? (
          <Text style={[styles.empty, { fontFamily: fontReg, color: muted }]}>{empty}</Text>
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
                  {user.avatar ? (
                    <Image source={{ uri: user.avatar }} style={styles.avatar} />
                  ) : (
                    <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: accent }]}>
                      <Text style={styles.avatarLetter}>{name.slice(0, 1).toUpperCase()}</Text>
                    </View>
                  )}
                  <View style={{ flex: 1 }}>
                    <Text
                      style={[
                        styles.name,
                        { fontFamily: font, textAlign: isAr ? 'right' : 'left', color: ink },
                      ]}
                      numberOfLines={1}
                    >
                      {name}
                    </Text>
                    <Text
                      style={[
                        styles.handle,
                        { fontFamily: fontReg, textAlign: isAr ? 'right' : 'left', color: muted },
                      ]}
                      numberOfLines={1}
                    >
                      @{user.username}
                    </Text>
                  </View>
                </Pressable>
              );
            })}
            {cursor ? (
              <Pressable onPress={() => void load(cursor, true)} style={styles.more} disabled={loadingMore}>
                {loadingMore ? (
                  <ActivityIndicator color={accent} />
                ) : (
                  <Text style={[styles.moreText, { fontFamily: font, color: accent }]}>{moreLabel}</Text>
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
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingTop: 8,
    paddingHorizontal: 16,
    borderTopWidth: 1,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
  },
  empty: {
    textAlign: 'center',
    paddingVertical: 28,
    fontSize: 14,
  },
  row: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
  },
  avatarFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  name: {
    fontSize: 15,
    fontWeight: '600',
  },
  handle: {
    fontSize: 12,
    marginTop: 2,
  },
  more: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  moreText: {
    fontSize: 14,
    fontWeight: '600',
  },
});
