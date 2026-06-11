/**
 * LeaderboardModal — Top-11 sheet with liquid-glass cards (matches Rank tab style).
 */

import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
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
import { useTranslation } from '../../src/i18n';
import { arabicPointWord } from '../../src/i18n/formatXp';
import { useLanguageStore } from '../../src/i18n/store';
import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { glassProps } from '../../constants/ui';

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

const TOP3_THEME: Record<
  number,
  { glow: string; border: string; fill: string; gradient: [string, string] }
> = {
  1: {
    glow: '#F5C518',
    border: 'rgba(245,197,24,0.65)',
    fill: 'rgba(245,197,24,0.14)',
    gradient: ['rgba(245,197,24,0.35)', 'rgba(245,197,24,0.05)'],
  },
  2: {
    glow: '#C0C0C0',
    border: 'rgba(192,192,192,0.55)',
    fill: 'rgba(192,192,192,0.12)',
    gradient: ['rgba(192,192,192,0.28)', 'rgba(192,192,192,0.04)'],
  },
  3: {
    glow: '#CD7F32',
    border: 'rgba(205,127,50,0.55)',
    fill: 'rgba(205,127,50,0.12)',
    gradient: ['rgba(205,127,50,0.28)', 'rgba(205,127,50,0.04)'],
  },
};

interface LeaderboardModalProps {
  visible: boolean;
  onClose: () => void;
  entries: LeaderboardEntry[];
  topInset: number;
  currentUserId?: string | null;
  onEntryPress?: (entry: LeaderboardEntry) => void;
}

function GlassSheet({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  const sheetStyle = [s.sheet, style];

  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView {...glassProps.modal} style={sheetStyle}>
        <View style={s.sheetInner}>{children}</View>
      </LiquidGlassView>
    );
  }

  return (
    <BlurView intensity={Platform.OS === 'ios' ? 40 : 90} tint="dark" style={sheetStyle}>
      <View style={s.sheetInner}>{children}</View>
    </BlurView>
  );
}

function GlassRow({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: object;
}) {
  if (isLiquidGlassSupported) {
    return (
      <LiquidGlassView {...glassProps.card} style={[s.rowGlass, style]}>
        {children}
      </LiquidGlassView>
    );
  }

  return (
    <BlurView intensity={14} tint="dark" style={[s.rowGlass, style]}>
      {children}
    </BlurView>
  );
}

function LeaderboardRow({
  entry,
  isCurrentUser,
  onPress,
  t,
  language,
  isLast,
}: {
  entry: LeaderboardEntry;
  isCurrentUser: boolean;
  onPress?: () => void;
  t: ReturnType<typeof useTranslation>['t'];
  language: ReturnType<typeof useLanguageStore.getState>['language'];
  isLast: boolean;
}) {
  const top3 = TOP3_THEME[entry.rank];
  const isTop3 = entry.rank <= 3 && !!top3;
  const disabled = entry.isPlaceholder || !entry.username;

  const rowContent = (
    <GlassRow
      style={[
        s.rowInner,
        isTop3 && { backgroundColor: top3.fill, borderColor: top3.border },
        isCurrentUser && !isTop3 && s.rowCurrentUser,
        entry.isPlaceholder && s.rowPlaceholder,
      ]}
    >
      {isTop3 ? (
        <LinearGradient
          colors={top3.gradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      ) : null}

      <View style={[s.avatarWrap, isTop3 && { borderColor: top3.glow }]}>
        <Image
          source={entry.avatar ? { uri: entry.avatar } : LOCAL_PLACEHOLDER}
          placeholder={LOCAL_PLACEHOLDER}
          style={s.avatar}
          contentFit="cover"
          cachePolicy="memory-disk"
          transition={150}
        />
      </View>

      <View style={s.nameCol}>
        <Text style={s.displayName} numberOfLines={2}>
          {entry.displayName}
        </Text>
      </View>

      <View style={[s.xpCol, isTop3 && { borderColor: `${top3.glow}44` }]}>
        <Text
          style={[
            s.xpValue,
            isTop3 && entry.rank === 1 && { color: top3.glow },
            isTop3 && entry.rank !== 1 && s.xpValueTop3Contrast,
          ]}
        >
          {entry.xp}
        </Text>
        <Text style={s.xpSuffix}>
          {language === 'ar' ? arabicPointWord(entry.xp) : t.rank.xpSuffix}
        </Text>
      </View>

      <View style={s.medalCol}>
        <RankMedalIcon rank={entry.rank} size={isTop3 ? 30 : 26} />
      </View>
    </GlassRow>
  );

  const wrapped = (
    <View
      style={[
        s.rowShell,
        !isLast && s.rowShellSpaced,
        isTop3 && {
          shadowColor: top3.glow,
          shadowOpacity: 0.45,
          shadowRadius: 14,
          shadowOffset: { width: 0, height: 4 },
          elevation: 8,
        },
      ]}
    >
      {rowContent}
    </View>
  );

  if (disabled) {
    return wrapped;
  }

  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [pressed && { opacity: 0.9 }]}
      accessibilityRole="button"
    >
      {wrapped}
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
  const language = useLanguageStore((s) => s.language);
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const sheetBottomPad = Math.max(insets.bottom, 12);
  const sheetHeight = Math.round(windowHeight * 0.94);

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

        <GlassSheet style={{ height: sheetHeight, paddingBottom: sheetBottomPad }}>
          <View style={s.handle} />

          <View style={s.header}>
            {isLiquidGlassSupported ? (
              <LiquidGlassView {...glassProps.header} style={s.headerGlass}>
                <Text style={s.title}>{t.rank.leaderboardTitle}</Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t.common.close}
                >
                  <Text style={s.closeTxt}>✕</Text>
                </Pressable>
              </LiquidGlassView>
            ) : (
              <View style={s.headerPlain}>
                <Text style={s.title}>{t.rank.leaderboardTitle}</Text>
                <Pressable
                  onPress={onClose}
                  style={({ pressed }) => [s.closeBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel={t.common.close}
                >
                  <Text style={s.closeTxt}>✕</Text>
                </Pressable>
              </View>
            )}
          </View>

          <View style={s.listWrap}>
            <ScrollView
              showsVerticalScrollIndicator
              indicatorStyle="white"
              nestedScrollEnabled
              bounces
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={s.listContent}
              style={s.list}
            >
              {entries.map((entry, index) => (
                <LeaderboardRow
                  key={`${entry.rank}-${entry.id}`}
                  entry={entry}
                  isCurrentUser={entry.id === currentUserId}
                  isLast={index === entries.length - 1}
                  t={t}
                  language={language}
                  onPress={() => {
                    if (!entry.isPlaceholder && entry.username) {
                      onEntryPress?.(entry);
                    }
                  }}
                />
              ))}
            </ScrollView>
          </View>
        </GlassSheet>
      </View>
    </Modal>
  );
};

export default LeaderboardModal;

const s = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.62)',
  },
  sheet: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(168,85,247,0.28)',
    width: '100%',
  },
  sheetInner: {
    flex: 1,
    flexDirection: 'column',
    minHeight: 0,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.22)',
    marginTop: 10,
    marginBottom: 6,
  },
  header: {
    paddingHorizontal: 16,
    marginBottom: 12,
    flexShrink: 0,
  },
  headerGlass: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  headerPlain: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  title: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '900',
    letterSpacing: 0.2,
    flex: 1,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeTxt: { color: '#fff', fontSize: 16, fontWeight: '400' },
  listWrap: {
    flex: 1,
    minHeight: 0,
  },
  list: {
    flex: 1,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  rowShell: {
    width: '100%',
    borderRadius: 20,
  },
  rowShellSpaced: {
    marginBottom: 8,
  },
  rowGlass: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  rowInner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 10,
    gap: 10,
    minHeight: 64,
  },
  rowCurrentUser: {
    borderColor: 'rgba(168,85,247,0.55)',
    backgroundColor: 'rgba(168,85,247,0.12)',
  },
  rowPlaceholder: { opacity: 0.42 },
  avatarWrap: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(168,85,247,0.45)',
    padding: 2,
    flexShrink: 0,
  },
  avatar: {
    width: '100%',
    height: '100%',
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  nameCol: {
    flex: 1,
    minWidth: 0,
    justifyContent: 'center',
  },
  displayName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '800',
    lineHeight: 20,
  },
  xpCol: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 56,
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    backgroundColor: 'rgba(168,85,247,0.08)',
    flexShrink: 0,
  },
  xpValue: {
    color: ACCENT,
    fontSize: 17,
    fontWeight: '900',
    lineHeight: 20,
  },
  xpValueTop3Contrast: {
    color: '#FFFFFF',
  },
  xpSuffix: {
    color: 'rgba(168,85,247,0.75)',
    fontSize: 10,
    fontWeight: '800',
    marginTop: 1,
    textTransform: 'uppercase',
  },
  medalCol: {
    width: 36,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
