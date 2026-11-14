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
  optionIndex: number | null;
  optionLabel: string;
  visible: boolean;
  onClose: () => void;
  onProfile: (username: string) => void;
}

export function PollVotersSheet({ postId, optionIndex, optionLabel, visible, onClose, onProfile }: Props) {
  const insets = useSafeAreaInsets();
  const getToken = useCommunityToken();
  const { t, language } = useTranslation();
  const s = t.community;
  const isAr = language === 'ar';
  const font = getAppFont(600, language);
  const fontReg = getAppFont(400, language);
  const [items, setItems] = useState<CommunityAuthor[]>([]);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (optionIndex == null) return;
    setLoading(true);
    try {
      const page = await communityApi.pollVoters(getToken, postId, optionIndex, null);
      setItems(page.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [getToken, optionIndex, postId]);

  useEffect(() => {
    if (!visible) return;
    setItems([]);
    void load();
  }, [visible, load]);

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <View style={[styles.header, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.title, { fontFamily: font }]} numberOfLines={1}>
            {s.pollVotersTitle.replace('{option}', optionLabel)}
          </Text>
          <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button">
            <X size={20} color={C.muted} />
          </Pressable>
        </View>
        {loading ? (
          <ActivityIndicator style={{ marginVertical: 28 }} color={C.accentSoft} />
        ) : !items.length ? (
          <Text style={[styles.empty, { fontFamily: fontReg }]}>{s.pollNoVoters}</Text>
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
                  <CommunityAvatar uri={user.avatar} name={name} size={40} />
                  <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
                    <Text style={[styles.name, { fontFamily: font }]} numberOfLines={1}>{name}</Text>
                    <Text style={[styles.handle, { fontFamily: fontReg }]} numberOfLines={1}>@{user.username}</Text>
                  </View>
                </Pressable>
              );
            })}
          </ScrollView>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)' },
  sheet: {
    backgroundColor: C.screen,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 16,
    paddingHorizontal: 16,
    maxHeight: '70%',
  },
  header: { alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 12 },
  title: { color: C.text, fontSize: 16, flex: 1 },
  empty: { color: C.muted, textAlign: 'center', marginVertical: 28 },
  row: { alignItems: 'center', gap: 12, paddingVertical: 10 },
  name: { color: C.text, fontSize: 15 },
  handle: { color: C.muted, fontSize: 13 },
});
