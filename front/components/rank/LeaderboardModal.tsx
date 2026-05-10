import { BlurView } from 'expo-blur';
import React from 'react';
import {
  Image,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';

const ACCENT = '#A855F7';

interface LeaderboardEntry {
  rank: number;
  name: string;
  xp: string;
  avatar: string;
}

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  topInset: number;
}

export default function LeaderboardModal({ visible, onClose, entries, topInset }: LeaderboardModalProps) {
  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[s.modalOverlay, Platform.OS === 'android' && { backgroundColor: 'rgba(0,0,0,0.85)' }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <BlurView
          intensity={Platform.OS === 'ios' ? 30 : 100}
          tint="dark"
          style={StyleSheet.absoluteFill}
        />
        <View style={[s.modalContent, { paddingTop: topInset + 20 }]}>
          <View style={s.modalHeader}>
            <Text style={s.modalTitle}>Top 11 Leaderboard</Text>
            <TouchableOpacity onPress={onClose} style={s.modalCloseBtn}>
              <Text style={s.modalCloseText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.modalScroll}>
            {entries.map((p) => (
              <View key={p.rank} style={s.modalRow}>
                <View style={s.modalRankBox}>
                  <Text style={s.modalRankTxt}>
                    {p.rank === 1 ? '🥇' : p.rank === 2 ? '🥈' : p.rank === 3 ? '🥉' : p.rank}
                  </Text>
                </View>
                <Image source={{ uri: p.avatar }} style={s.modalAvatar} />
                <View style={s.modalInfo}>
                  <Text style={s.modalName}>{p.name}</Text>
                  <Text style={s.modalXpLabel}>Global Rank</Text>
                </View>
                <Text style={s.modalXpVal}>{p.xp}</Text>
              </View>
            ))}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const s = StyleSheet.create({
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)' },
  modalContent: { flex: 1, paddingHorizontal: 20 },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 25 },
  modalTitle: { color: '#fff', fontSize: 24, fontWeight: '900' },
  modalCloseBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center',
  },
  modalCloseText: { color: '#fff', fontSize: 18, fontWeight: '300' },
  modalScroll: { gap: 12 },
  modalRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)', padding: 16, borderRadius: 20,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', gap: 12,
  },
  modalRankBox: { width: 30, alignItems: 'center' },
  modalRankTxt: { color: '#fff', fontSize: 16, fontWeight: '800' },
  modalAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.1)' },
  modalInfo: { flex: 1 },
  modalName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  modalXpLabel: { color: 'rgba(255,255,255,0.4)', fontSize: 10, marginTop: 2 },
  modalXpVal: { color: ACCENT, fontSize: 14, fontWeight: '900' },
});
