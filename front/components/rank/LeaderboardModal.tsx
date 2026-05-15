/**
 * LeaderboardModal
 *
 * Full Top-11 leaderboard sheet. Receives the resolved entries from the rank
 * screen (real backend data padded with empty slots when needed) and renders
 * them in a properly-layered modal: a separate dismiss layer behind the
 * content prevents accidental closes when tapping inside the list.
 */

import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React from 'react';
import {
  I18nManager,
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName: string;
  username: string;
  /** Remote URL or null. Null falls back to the local placeholder. */
  avatar: string | null;
  xp: number;
  isPlaceholder?: boolean;
}

const LOCAL_PLACEHOLDER: ImageSourcePropType = require('../../assets/images/plear 90Plus.png');

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  topInset: number;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  visible,
  onClose,
  entries,
  topInset,
}) => {
  const { t } = useTranslation();
  const rowDirection = I18nManager.isRTL ? 'row-reverse' : 'row';
  const headerDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
    >
      <View style={s.root}>
        <Pressable
          style={[
            StyleSheet.absoluteFill,
            Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' },
          ]}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
        />
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={[s.modalContent, { paddingTop: topInset + 20 }]}>
          <View style={[s.modalHeader, { flexDirection: headerDirection }]}>
            <Text style={s.modalTitle}>{t.rank.leaderboardTitle}</Text>
            <Pressable
              onPress={onClose}
              style={({ pressed }) => [s.modalCloseBtn, pressed && { opacity: 0.85 }]}
              accessibilityRole="button"
              accessibilityLabel={t.common.close}
            >
              <Text style={s.modalCloseText}>✕</Text>
            </Pressable>
          </View>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.modalScroll}
          >
            {entries.map(entry => {
              const rankLabel: string =
                entry.rank === 1
                  ? '🥇'
                  : entry.rank === 2
                  ? '🥈'
                  : entry.rank === 3
                  ? '🥉'
                  : String(entry.rank);

              return (
                <View
                  key={`${entry.rank}-${entry.id}`}
                  style={[s.modalRow, { flexDirection: rowDirection }]}
                >
                  <View style={s.modalRankBox}>
                    <Text style={s.modalRankTxt}>{rankLabel}</Text>
                  </View>
                  <Image
                    source={entry.avatar ? { uri: entry.avatar } : LOCAL_PLACEHOLDER}
                    placeholder={LOCAL_PLACEHOLDER}
                    style={s.modalAvatar}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                  <View style={s.modalInfo}>
                    <Text style={s.modalName} numberOfLines={1}>
                      {entry.displayName}
                    </Text>
                    <Text style={s.modalXpLabel}>{t.rank.globalRank}</Text>
                  </View>
                  <Text style={s.modalXpVal}>
                    {entry.xp} {t.rank.xpSuffix}
                  </Text>
                </View>
              );
            })}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default LeaderboardModal;

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { flex: 1, paddingHorizontal: 20 },
  modalHeader: {
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 25,
  },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 18, fontWeight: '300' },
  modalScroll: { gap: 12 },
  modalRow: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  modalRankBox: { width: 30, alignItems: 'center' },
  modalRankTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalInfo: { flex: 1 },
  modalName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalXpLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 10,
    marginTop: 2,
  },
  modalXpVal: { color: ACCENT, fontSize: 14, fontWeight: '900' },
});
