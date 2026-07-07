/**
 * ملك التوقعات — Prediction Groups
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { usePredictionGroup } from '../hooks/usePredictionGroup';
import { LiquidGlassTabBar } from '../components/navigation/LiquidGlassTabBar';
import { COMPACT_TAB_BAR_HEIGHT } from '../components/navigation/liquidGlassTabBar.constants';
import type { ConfigurableLiquidTabItem } from '../components/navigation/liquidGlassTabBar.types';
import {
  GROUP_FIXED_HEADER_HEIGHT,
  GroupFixedTopBar,
} from '../components/predictionGroups/GroupFixedTopBar';
import {
  GroupScreenHeader,
  type GroupScreenHeaderHandle,
} from '../components/predictionGroups/GroupScreenHeader';
import { GroupJoinSheet } from '../components/predictionGroups/GroupJoinSheet';
import { GroupOnboarding } from '../components/predictionGroups/GroupOnboarding';
import { HomeLeaderboardCard } from '../components/predictionGroups/HomeLeaderboardCard';
import {
  GroupTabIcon,
  RankPodiumTabIcon,
  RoundsTabIcon,
} from '../components/predictionGroups/PredictionGroupTabIcons';
import {
  GroupsStandingsSection,
  PredictionsSection,
} from '../components/predictionGroups/sections';
import { PG, PG_GRADIENTS, usePGFonts } from '../components/predictionGroups/theme';
import { parseGroupCodeFromUrl } from '../services/predictionGroups.service';
import { useTranslation } from '../src/i18n';
import { useScreenFont } from '../utils/fontSetup';

type GroupNavKey = 'group' | 'round' | 'standings';

const GROUP_NAV_KEYS: GroupNavKey[] = ['group', 'round', 'standings'];

const PREDICTION_GROUP_TABS: ConfigurableLiquidTabItem[] = [
  { id: 'group', label: 'جروب', accent: PG.primaryLight, icon: GroupTabIcon, bubbleWidth: 58 },
  { id: 'round', label: 'الجولة', accent: PG.gold, icon: RoundsTabIcon, bubbleWidth: 64 },
  { id: 'standings', label: 'الترتيب', accent: PG.primaryLight, icon: RankPodiumTabIcon, bubbleWidth: 62 },
];

export default function PredictionGroupsScreen() {
  useScreenFont();
  usePGFonts();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL, t } = useTranslation();
  const params = useLocalSearchParams<{ joinCode?: string; inviteId?: string }>();

  const pg = usePredictionGroup();
  const [tab, setTab] = useState<GroupNavKey>('group');
  const headerRef = useRef<GroupScreenHeaderHandle>(null);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);

  useEffect(() => {
    const raw = params.joinCode;
    const code = typeof raw === 'string' ? parseGroupCodeFromUrl(raw) ?? raw.toUpperCase() : null;
    const inviteId = typeof params.inviteId === 'string' ? params.inviteId : null;
    if (code || inviteId) {
      setPendingJoinCode(code);
      setPendingInviteId(inviteId);
      setJoinSheetOpen(true);
    }
  }, [params.joinCode, params.inviteId]);

  useEffect(() => {
    if (tab === 'standings') void pg.refreshLeaderboard('all');
  }, [tab, pg.refreshLeaderboard]);

  const activeTabIndex = useMemo(
    () => Math.max(0, GROUP_NAV_KEYS.indexOf(tab)),
    [tab],
  );

  const handleNavigate = useCallback((index: number) => {
    setTab(GROUP_NAV_KEYS[index] ?? 'group');
  }, []);

  const navClearance = Math.max(insets.bottom, 16) + COMPACT_TAB_BAR_HEIGHT + 20;
  const chromeInset = GROUP_FIXED_HEADER_HEIGHT + 4;

  const groupHeader = useMemo(() => {
    const g = pg.state?.group;
    if (!g) return null;
    return {
      name: g.name,
      code: g.inviteCode,
      membersCount: g.membersCount,
      createdAt: new Date(g.createdAt).toLocaleDateString('ar-EG'),
      tagline: 'مجموعة خاصة',
      isPrivate: g.isPrivate,
      avatarUrl: g.avatarUrl,
      id: g.id,
    };
  }, [pg.state?.group]);

  const memberRows = useMemo(
    () =>
      pg.members.map((m) => ({
        rank: m.rank,
        name: m.name,
        points: m.points,
        isMe: m.isMe,
        isAdmin: m.isAdmin,
        correct: m.correct ?? 0,
        avatar: m.avatar ?? undefined,
        username: m.username,
        userId: m.userId,
      })),
    [pg.members],
  );

  if (pg.loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <LinearGradient colors={PG_GRADIENTS.screen} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={PG.primaryLight} size="large" />
      </View>
    );
  }

  if (!pg.state?.hasGroup) {
    return (
      <View style={styles.root}>
        <LinearGradient colors={PG_GRADIENTS.screen} style={StyleSheet.absoluteFill} />
        <GroupFixedTopBar
          topInset={insets.top}
          isRTL={isRTL}
          brandTitle={t.predictionGroupsInfo.brandTitle}
          onBack={() => router.back()}
        />
        <ScrollView contentContainerStyle={{ paddingTop: insets.top + chromeInset, paddingBottom: navClearance }}>
          <GroupOnboarding
            isRTL={isRTL}
            onCreate={async (name) => {
              await pg.createGroup(name);
            }}
            onJoinByCode={async (code) => {
              setPendingJoinCode(code);
              setJoinSheetOpen(true);
            }}
          />
        </ScrollView>
        <GroupJoinSheet
          visible={joinSheetOpen}
          code={pendingJoinCode}
          inviteId={pendingInviteId}
          onClose={() => setJoinSheetOpen(false)}
          onJoined={() => void pg.refreshMe()}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={PG_GRADIENTS.screen} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={PG_GRADIENTS.ambient} style={styles.ambient} pointerEvents="none" />

      <GroupFixedTopBar
        topInset={insets.top}
        isRTL={isRTL}
        brandTitle={t.predictionGroupsInfo.brandTitle}
        onBack={() => router.back()}
        onBrandPress={() => headerRef.current?.openInfo()}
        onShare={() => {
          void headerRef.current?.share();
        }}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingTop: insets.top + chromeInset, paddingBottom: navClearance },
        ]}
      >
        {groupHeader && (
          <GroupScreenHeader
            ref={headerRef}
            group={groupHeader}
            isRTL={isRTL}
            isAdmin={pg.isOwner}
            showProfile={tab !== 'standings'}
            onSaveGroup={pg.updateGroup}
            onInviteUser={pg.inviteUser}
          />
        )}

        {tab === 'group' && (
          <HomeLeaderboardCard
            isRTL={isRTL}
            members={memberRows}
            groupStats={pg.groupStats}
            isOwner={pg.isOwner}
            onKickMember={pg.kickMember}
          />
        )}
        {tab === 'round' && groupHeader && (
          <View style={styles.tabPad}>
            <PredictionsSection
              isRTL={isRTL}
              groupId={groupHeader.id}
              roundMatches={pg.roundMatches}
              roundMeta={pg.roundMeta}
              onSave={pg.savePredictions}
            />
          </View>
        )}
        {tab === 'standings' && (
          <GroupsStandingsSection
            isRTL={isRTL}
            groups={pg.globalGroups.map((g) => ({
              rank: g.rank,
              name: g.name,
              points: g.points,
              members: g.members,
              avatar: g.avatarUrl,
              isMine: g.isMine,
              id: g.id,
            }))}
            onPeriodChange={pg.refreshLeaderboard}
            myGroupId={pg.state?.group?.id}
          />
        )}
      </ScrollView>

      <LinearGradient
        colors={['transparent', PG.bg]}
        style={[styles.bottomScrim, { height: navClearance }]}
        pointerEvents="none"
      />

      <LiquidGlassTabBar
        tabs={PREDICTION_GROUP_TABS}
        activeIndex={activeTabIndex}
        onNavigate={handleNavigate}
        bottomInset={insets.bottom}
        compact
      />

      <GroupJoinSheet
        visible={joinSheetOpen}
        code={pendingJoinCode}
        inviteId={pendingInviteId}
        onClose={() => setJoinSheetOpen(false)}
        onJoined={() => void pg.refreshMe()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PG.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  ambient: { position: 'absolute', top: 0, left: 0, right: 0, height: 280 },
  scrollContent: { gap: 0 },
  tabPad: { paddingHorizontal: 16, paddingTop: 12 },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50 },
});
