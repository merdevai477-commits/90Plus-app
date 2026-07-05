/**
 * ملك التوقعات — Prediction Groups
 *
 * Opened from the Rank tab ("ملك التوقعات" card). A private prediction group:
 * members join by invite code, predict a round of 10 matches (winner = 1pt,
 * exact score = 3pts) and compete on the group leaderboard.
 *
 * This container hosts three "screens" behind animated tabs (الرئيسية / الترتيب
 * / التوقعات / الإحصائيات). All visuals live in reusable components under
 * `components/predictionGroups/`; animations run on the UI thread (Reanimated 4
 * worklets). UI-only data for now (see components/predictionGroups/data.ts).
 */

import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, ChevronRight, MoreVertical } from 'lucide-react-native';
import React, { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../contexts/ToastContext';
import { useTranslation } from '../src/i18n';
import { useScreenFont } from '../utils/fontSetup';
import { AnimatedTabs } from '../components/predictionGroups/AnimatedTabs';
import { GROUP } from '../components/predictionGroups/data';
import { GroupHeaderCard } from '../components/predictionGroups/GroupHeaderCard';
import {
  HomeSection,
  LeaderboardSection,
  PredictionsSection,
  StatsSection,
} from '../components/predictionGroups/sections';
import { PG, PG_GRADIENTS, usePGFonts } from '../components/predictionGroups/theme';

const MAIN_TABS = [
  { key: 'home', label: 'الرئيسية' },
  { key: 'standings', label: 'الترتيب' },
  { key: 'predictions', label: 'التوقعات' },
  { key: 'stats', label: 'الإحصائيات' },
];

export default function PredictionGroupsScreen() {
  useScreenFont();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL } = useTranslation();
  const toast = useToast();
  const { extra } = usePGFonts();

  const [tab, setTab] = useState('home');
  const [copied, setCopied] = useState(false);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const BackIcon = isRTL ? ChevronRight : ChevronLeft;

  const handleCopy = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await Clipboard.setStringAsync(GROUP.code);
      setCopied(true);
      toast.showSuccess('تم النسخ', 'تم نسخ كود الدعوة إلى الحافظة');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* no-op */
    }
  }, [toast]);

  const handleInvite = useCallback(async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
    try {
      await Share.share({
        message: `انضم إلى مجموعة "${GROUP.name}" في ملك التوقعات ⚽️\nكود الدعوة: ${GROUP.code}`,
      });
    } catch {
      /* no-op */
    }
  }, []);

  const contentPadding = { paddingHorizontal: 16, paddingBottom: insets.bottom + 32, gap: 16 };

  return (
    <View style={styles.root}>
      <LinearGradient colors={PG_GRADIENTS.screen} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={PG_GRADIENTS.ambient} style={styles.ambient} pointerEvents="none" />

      <View style={[styles.header, row, { paddingTop: insets.top + 8 }]}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <BackIcon size={24} color="#fff" />
        </Pressable>
        <Text style={[styles.headerTitle, { fontFamily: extra }]} numberOfLines={1}>
          ملك التوقعات
        </Text>
        <Pressable
          hitSlop={10}
          style={({ pressed }) => [styles.iconBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
        >
          <MoreVertical size={22} color="#fff" />
        </Pressable>
      </View>

      <View style={styles.tabsWrap}>
        <AnimatedTabs tabs={MAIN_TABS} activeKey={tab} onChange={setTab} isRTL={isRTL} />
      </View>

      {tab === 'standings' ? (
        <LeaderboardSection isRTL={isRTL} contentPaddingBottom={insets.bottom + 32} />
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={contentPadding}>
          {tab === 'home' && (
            <>
              <GroupHeaderCard
                name={GROUP.name}
                membersCount={GROUP.membersCount}
                createdAt={GROUP.createdAt}
                code={GROUP.code}
                copied={copied}
                onCopy={handleCopy}
                onInvite={handleInvite}
                isRTL={isRTL}
              />
              <HomeSection isRTL={isRTL} onSeeAll={() => setTab('standings')} />
            </>
          )}
          {tab === 'predictions' && <PredictionsSection isRTL={isRTL} />}
          {tab === 'stats' && <StatsSection isRTL={isRTL} />}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PG.bg },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },

  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 10,
    gap: 8,
  },
  iconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { color: PG.text, fontSize: 19, flex: 1, textAlign: 'center' },

  tabsWrap: { paddingHorizontal: 16, paddingBottom: 12 },
});
