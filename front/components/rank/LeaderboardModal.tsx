/**
 * LeaderboardModal — Top-11 sheet with horizontal rows and PNG medals.
 */

import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import React from 'react';
import {
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { RankMedalIcon } from '../common/RankMedalIcon';
import { useTranslation } from '../../src/i18n';

const ACCENT = '#A855F7';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName: string;
  username: string;
  avatar: string | null;
  xp: number;
  isPlaceholder?: boolean;
}

const LOCAL_PLACEHOLDER: ImageSourcePropType = require('../../assets/images/plear 90Plus.png');

const TOP3_ROW_STYLE: Record<number, object> = {
  1: { borderColor: 'rgba(245,197,24,0.35)', backgroundColor: 'rgba(245,197,24,0.06)' },
  2: { borderColor: 'rgba(192,192,192,0.35)', backgroundColor: 'rgba(192,192,192,0.06)' },
  3: { borderColor: 'rgba(205,127,50,0.35)', backgroundColor: 'rgba(205,127,50,0.06)' },
};

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  topInset: number;
  onEntryPress?: (entry: LeaderboardEntry) => void;
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  visible,
  onClose,
  entries,
  topInset,
  onEntryPress,
}) => {
  const { t } = useTranslation();

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
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
          <View style={s.modalHeader}>
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

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
            {entries.map((entry) => (
              <Pressable
                key={`${entry.rank}-${entry.id}`}
                style={({ pressed }) => [
                  s.modalRow,
                  TOP3_ROW_STYLE[entry.rank],
                  entry.isPlaceholder && s.modalRowPlaceholder,
                  pressed && !entry.isPlaceholder && { opacity: 0.88 },
                ]}
                onPress={() => {
                  if (!entry.isPlaceholder && entry.username) {
                    onEntryPress?.(entry);
                  }
                }}
                disabled={entry.isPlaceholder || !entry.username}
              >
                <View style={s.rankCol}>
                  <RankMedalIcon rank={entry.rank} size={entry.rank <= 3 ? 32 : 28} />
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
                  <Text style={s.modalXpLabel}>{t.rank.xpThisPeriod}</Text>
                </View>

                <View style={s.xpCol}>
                  <Text style={s.modalXpVal}>{entry.xp}</Text>
                  <Text style={s.modalXpSuffix}>{t.rank.xpSuffix}</Text>
                </View>
              </Pressable>
            ))}
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
  modalContent: { flex: 1, paddingHorizontal: 16 },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  modalScroll: { gap: 10 },
  modalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 72,
    backgroundColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  modalRowPlaceholder: { opacity: 0.45 },
  rankCol: { width: 36, alignItems: 'center', justifyContent: 'center' },
  modalAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  modalInfo: { flex: 1, minWidth: 0 },
  modalName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalXpLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    marginTop: 3,
  },
  xpCol: { width: 72, alignItems: 'flex-end' },
  modalXpVal: { color: ACCENT, fontSize: 16, fontWeight: '900' },
  modalXpSuffix: { color: 'rgba(168,85,247,0.7)', fontSize: 10, fontWeight: '700', marginTop: 1 },
});
