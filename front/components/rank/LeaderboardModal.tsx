/**
 * LeaderboardModal — Top-11 sheet in the same liquid-glass material as the
 * bottom nav: dark lit glass surface, capsule rows, and the current user lit
 * with the nav's purple bubble.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { X } from 'lucide-react-native';
import React from 'react';
import {
  ImageSourcePropType,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { RankMedalIcon } from '../common/RankMedalIcon';
import {
  GLASS_ACCENT,
  GLASS_SURFACE_BG,
  GlassBubbleFill,
  GlassRim,
  GlassSheen,
} from '../navigation/glass';
import { useTranslation } from '../../src/i18n';
import { arabicPointWord } from '../../src/i18n/formatXp';
import { useLanguageStore } from '../../src/i18n/store';
import { useAppFont } from '@/utils/fontSetup';

export interface LeaderboardEntry {
  rank: number;
  id: string;
  displayName: string;
  username: string;
  avatar: string | null;
  xp: number;
  isPlaceholder?: boolean;
}

const LOCAL_PLACEHOLDER: ImageSourcePropType = require('../../assets/images/plear 90Plus.jpg');

const ROW_HEIGHT = 64;
const ROW_RADIUS = ROW_HEIGHT / 2;
const SHEET_RADIUS = 32;

const PODIUM: Record<number, { color: string; tint: string; rim: string }> = {
  1: { color: '#F5C518', tint: 'rgba(245,197,24,0.22)', rim: 'rgba(245,197,24,0.55)' },
  2: { color: '#D8D8E0', tint: 'rgba(216,216,224,0.16)', rim: 'rgba(216,216,224,0.45)' },
  3: { color: '#E0954A', tint: 'rgba(224,149,74,0.18)', rim: 'rgba(224,149,74,0.5)' },
};

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  topInset: number;
  currentUserId?: string | null;
  onEntryPress?: (entry: LeaderboardEntry) => void;
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  onPress,
  xpSuffix,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  onPress?: () => void;
  xpSuffix: string;
}) {
  const fontBold = useAppFont(700);
  const fontBlack = useAppFont(800);
  const podium = PODIUM[entry.rank];
  const disabled = entry.isPlaceholder || !entry.username;

  const xpColor = isCurrentUser ? '#FFFFFF' : podium?.color ?? GLASS_ACCENT;

  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button">
      {({ pressed }) => (
        <View style={[s.row, entry.isPlaceholder && s.rowPlaceholder, pressed && s.rowPressed]}>
          {isCurrentUser ? (
            <GlassBubbleFill radius={ROW_RADIUS} height={ROW_HEIGHT} />
          ) : (
            <>
              {podium ? (
                <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.rowClip]}>
                  <LinearGradient
                    colors={[podium.tint, 'rgba(0,0,0,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 0.85, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                  />
                </View>
              ) : null}
              <GlassSheen radius={ROW_RADIUS} intensity={0.7} />
              <GlassRim radius={ROW_RADIUS} tint={podium?.rim} />
            </>
          )}

          <View style={s.rankCol}>
            {podium ? (
              <RankMedalIcon rank={entry.rank} size={22} />
            ) : (
              <Text style={[s.rankNum, { fontFamily: fontBlack }, isCurrentUser && s.textOnBubble]}>
                {entry.rank}
              </Text>
            )}
          </View>

          <View
            style={[
              s.avatarWrap,
              podium && { borderColor: podium.color },
              isCurrentUser && s.avatarOnBubble,
            ]}
          >
            <Image
              source={entry.avatar ? { uri: entry.avatar } : LOCAL_PLACEHOLDER}
              placeholder={LOCAL_PLACEHOLDER}
              style={s.avatar}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={150}
            />
          </View>

          <Text style={[s.name, { fontFamily: fontBold }]} numberOfLines={1}>
            {entry.displayName}
          </Text>

          <View style={[s.xpPill, isCurrentUser && s.xpPillOnBubble]}>
            <Text style={[s.xpValue, { fontFamily: fontBlack, color: xpColor }]}>{entry.xp}</Text>
            <Text style={[s.xpSuffix, { color: isCurrentUser ? 'rgba(255,255,255,0.8)' : 'rgba(235,228,255,0.55)' }]}>
              {xpSuffix}
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const LeaderboardModal: React.FC<LeaderboardModalProps> = ({
  visible,
  onClose,
  entries,
  topInset: _topInset,
  currentUserId,
  onEntryPress,
}) => {
  const { t } = useTranslation();
  const language = useLanguageStore((st) => st.language);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const fontTitle = useAppFont(800);
  const sheetHeight = Math.round(windowHeight * 0.88);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
      {...(Platform.OS === 'ios' ? { presentationStyle: 'overFullScreen' as const } : {})}
    >
      <View style={s.root}>
        <Pressable
          style={s.backdrop}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t.common.close}
        />

        <View style={[s.sheet, { height: sheetHeight }]}>
          <View pointerEvents="none" style={[StyleSheet.absoluteFill, s.sheetClip]}>
            <LinearGradient
              colors={['rgba(124,77,255,0.22)', 'rgba(124,77,255,0)']}
              style={s.sheetGlow}
            />
          </View>
          <GlassSheen radius={SHEET_RADIUS} intensity={0.6} />
          <GlassRim radius={SHEET_RADIUS} />

          <View style={s.handle} />

          <View style={s.header}>
            <Text style={[s.title, { fontFamily: fontTitle }]} numberOfLines={1}>
              {t.rank.leaderboardTitle}
            </Text>
            <Pressable
              onPress={onClose}
              accessibilityRole="button"
              accessibilityLabel={t.common.close}
              hitSlop={8}
            >
              {({ pressed }) => (
                <View style={[s.closeBtn, pressed && s.rowPressed]}>
                  <GlassSheen radius={18} />
                  <GlassRim radius={18} />
                  <X size={18} color="#FFFFFF" strokeWidth={2.4} />
                </View>
              )}
            </Pressable>
          </View>

          <ScrollView
            style={s.list}
            contentContainerStyle={[s.listContent, { paddingBottom: Math.max(insets.bottom, 12) + 16 }]}
            showsVerticalScrollIndicator={false}
            bounces
          >
            {entries.map((entry) => (
              <LeaderboardRow
                key={`${entry.rank}-${entry.id}`}
                entry={entry}
                isCurrentUser={entry.id === currentUserId}
                xpSuffix={language === 'ar' ? arabicPointWord(entry.xp) : t.rank.xpSuffix}
                onPress={() => onEntryPress?.(entry)}
              />
            ))}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default LeaderboardModal;

const s = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,2,10,0.7)',
  },
  sheet: {
    width: '100%',
    backgroundColor: GLASS_SURFACE_BG,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    shadowColor: '#7C4DFF',
    shadowOpacity: 0.45,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
  },
  sheetClip: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    overflow: 'hidden',
  },
  sheetGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 180 },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(235,228,255,0.28)',
    marginTop: 10,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 14,
    gap: 12,
  },
  title: { flex: 1, color: '#FFFFFF', fontSize: 22, letterSpacing: 0.2 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  list: { flex: 1 },
  listContent: { paddingHorizontal: 16, gap: 10 },

  row: {
    height: ROW_HEIGHT,
    borderRadius: ROW_RADIUS,
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 8,
    gap: 10,
    backgroundColor: 'rgba(255,255,255,0.035)',
  },
  rowClip: { borderRadius: ROW_RADIUS, overflow: 'hidden' },
  rowPressed: { opacity: 0.85, transform: [{ scale: 0.98 }] },
  rowPlaceholder: { opacity: 0.4 },
  rankCol: { width: 30, alignItems: 'center', justifyContent: 'center' },
  rankNum: { color: 'rgba(235,228,255,0.7)', fontSize: 15 },
  textOnBubble: { color: '#FFFFFF' },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(164,123,255,0.5)',
    padding: 2,
  },
  avatarOnBubble: { borderColor: 'rgba(255,255,255,0.85)' },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  name: { flex: 1, minWidth: 0, color: '#FFFFFF', fontSize: 15 },
  xpPill: {
    minWidth: 64,
    height: 46,
    borderRadius: 23,
    paddingHorizontal: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  xpPillOnBubble: { backgroundColor: 'rgba(255,255,255,0.18)' },
  xpValue: { fontSize: 16, lineHeight: 19 },
  xpSuffix: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase' },
});
