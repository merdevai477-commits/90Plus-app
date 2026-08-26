/**
 * حروب التوقعات — Prediction Groups
 */

import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useToast } from '../contexts/ToastContext';
import { useXp } from '../contexts/XpContext';
import { usePredictionGroup, type GroupNavKey } from '../hooks/usePredictionGroup';
import { useImageUpload } from '../hooks/useImageUpload';
import { prefetchImageUrls } from '../utils/prefetchMatchAssets';
import { with365ImageSize } from '../utils/scores365AthletePhoto';
import { LiquidGlassTabBar } from '../components/navigation/LiquidGlassTabBar';
import { COMPACT_TAB_BAR_HEIGHT } from '../components/navigation/liquidGlassTabBar.constants';
import type { ConfigurableLiquidTabItem } from '../components/navigation/liquidGlassTabBar.types';
import { CupSegmentTabs, type CupTabKey } from '../components/predictionGroups/CupSegmentTabs';
import { DailyProgressCard } from '../components/predictionGroups/DailyProgressCard';
import { GroupConfirmDialog } from '../components/predictionGroups/GroupConfirmDialog';
import { GroupCreateScreen } from '../components/predictionGroups/GroupCreateScreen';
import { GroupEditSheet } from '../components/predictionGroups/GroupEditSheet';
import { GroupInviteShareSheet } from '../components/predictionGroups/GroupInviteShareSheet';
import { GroupInviteSheet } from '../components/predictionGroups/GroupInviteSheet';
import { GroupJoinSheet } from '../components/predictionGroups/GroupJoinSheet';
import { GroupMembersStandings } from '../components/predictionGroups/GroupMembersStandings';
import { GroupOnboarding } from '../components/predictionGroups/GroupOnboarding';
import { GroupsStandingsSection } from '../components/predictionGroups/GroupsStandingsSection';
import { MatchVsCard } from '../components/predictionGroups/MatchVsCard';
import { PredictMatchModal } from '../components/predictionGroups/PredictMatchModal';
import { PredictionsCupHero } from '../components/predictionGroups/PredictionsCupHero';
import {
  GroupTabIcon,
  RankPodiumTabIcon,
} from '../components/predictionGroups/PredictionGroupTabIcons';
import {
  PredictionWarsTopBar,
  WARS_TOP_BAR_HEIGHT,
} from '../components/predictionGroups/PredictionWarsTopBar';
import { PG, PG_GRADIENTS, usePGFonts } from '../components/predictionGroups/theme';
import {
  mapRoundMatchToCard,
  parseGroupCodeFromUrl,
} from '../services/predictionGroups.service';
import type { PredictionMatch, RankedGroup } from '../components/predictionGroups/data';
import { useTranslation } from '../src/i18n';
import { useScreenFont } from '../utils/fontSetup';

const GROUP_NAV_KEYS: GroupNavKey[] = ['group', 'standings'];

export default function PredictionGroupsScreen() {
  useScreenFont();
  usePGFonts();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { isRTL, t } = useTranslation();
  const toast = useToast();
  const { xp, refresh: refreshXp } = useXp();
  const { upload } = useImageUpload();
  const pgScreen = t.predictionGroups.screen;
  const params = useLocalSearchParams<{ joinCode?: string; inviteId?: string }>();

  const {
    loading,
    refreshing,
    roundLoading,
    state,
    members,
    roundMatches,
    globalGroups,
    groupBan,
    isOwner,
    refreshMe,
    refreshMeIfStale,
    refreshGroupData,
    refreshActiveTab,
    refreshLeaderboard,
    createGroup,
    joinGroup,
    updateGroup,
    leaveGroup,
    deleteGroup,
    savePredictions,
    inviteUser,
  } = usePredictionGroup();

  const predictionGroupTabs = useMemo<ConfigurableLiquidTabItem[]>(
    () => [
      {
        id: 'group',
        label: t.predictionGroups.tabs.group,
        accent: PG.primaryLight,
        icon: GroupTabIcon,
        bubbleWidth: 92,
      },
      {
        id: 'standings',
        label: t.predictionGroups.tabs.standings,
        accent: PG.primaryLight,
        icon: RankPodiumTabIcon,
        bubbleWidth: 96,
      },
    ],
    [t.predictionGroups.tabs],
  );

  const [navTab, setNavTab] = useState<GroupNavKey>('group');
  const [tab, setTab] = useState<CupTabKey>('matches');
  const [createOpen, setCreateOpen] = useState(false);
  const [createBusy, setCreateBusy] = useState(false);
  const [inviteShareOpen, setInviteShareOpen] = useState(false);
  const [userInviteOpen, setUserInviteOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [joinSheetOpen, setJoinSheetOpen] = useState(false);
  const [pendingJoinCode, setPendingJoinCode] = useState<string | null>(null);
  const [pendingInviteId, setPendingInviteId] = useState<string | null>(null);
  const [predictMatch, setPredictMatch] = useState<PredictionMatch | null>(null);
  const [predictBusy, setPredictBusy] = useState(false);

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
    if (navTab !== 'group' || !state?.group?.id) return;
    if (tab === 'matches') {
      void refreshGroupData(state.group.id, { roundOnly: true });
    } else {
      void refreshGroupData(state.group.id, { standingsOnly: true });
    }
  }, [navTab, tab, state?.group?.id, refreshGroupData]);

  useEffect(() => {
    if (navTab !== 'standings') return;
    void refreshLeaderboard('all').catch(() => undefined);
  }, [navTab, refreshLeaderboard]);

  useFocusEffect(
    useCallback(() => {
      void refreshMeIfStale(2000);
      void refreshXp();
    }, [refreshMeIfStale, refreshXp]),
  );

  /** Header XP = signed-in user's app XP balance (not group-only score). */
  const headerXp = xp ?? 0;

  const warsTitle = useMemo(() => {
    if (navTab === 'standings' || tab === 'standings') {
      return t.predictionGroups.tabs.standings;
    }
    return t.predictionGroups.tabs.matches;
  }, [navTab, tab, t.predictionGroups.tabs.matches, t.predictionGroups.tabs.standings]);

  const handleRefresh = useCallback(async () => {
    try {
      if (navTab === 'standings' || !state?.hasGroup) {
        await refreshActiveTab(navTab === 'standings' ? 'standings' : 'hub');
        return;
      }
      await refreshActiveTab(tab === 'matches' ? 'matches' : 'members');
    } catch {
      toast.showError(pgScreen.refreshFailed, pgScreen.loadFailed);
    }
  }, [navTab, pgScreen.loadFailed, pgScreen.refreshFailed, refreshActiveTab, state?.hasGroup, tab, toast]);

  const activeTabIndex = useMemo(
    () => Math.max(0, GROUP_NAV_KEYS.indexOf(navTab)),
    [navTab],
  );

  const handleNavigate = useCallback((index: number) => {
    setNavTab(GROUP_NAV_KEYS[index] ?? 'group');
  }, []);

  const group = state?.group;
  const isHub = !state?.hasGroup || !group;
  const chromeInset = isHub ? 0 : WARS_TOP_BAR_HEIGHT + 8;
  const showCompactNav = Boolean(state?.hasGroup && group);
  const navClearance = showCompactNav
    ? Math.max(insets.bottom, 16) + COMPACT_TAB_BAR_HEIGHT + 20
    : insets.bottom + 28;

  const memberRows = useMemo(
    () =>
      members.map((m) => ({
        rank: m.rank,
        name: m.name,
        points: m.dailyPoints ?? m.points,
        totalPoints: m.totalPoints ?? m.points,
        isMe: m.isMe,
        isAdmin: m.isAdmin,
        correct: m.correct ?? 0,
        avatar: m.avatar ?? undefined,
        username: m.username,
        userId: m.userId,
      })),
    [members],
  );

  const memberUserIds = useMemo(() => members.map((m) => m.userId), [members]);

  const matchCards = useMemo(() => roundMatches.map(mapRoundMatchToCard), [roundMatches]);

  useEffect(() => {
    if (matchCards.length === 0) return;
    const urls = matchCards.flatMap((m) => [
      with365ImageSize(m.home.logo, 256),
      with365ImageSize(m.away.logo, 256),
      m.home.logo,
      m.away.logo,
    ]);
    prefetchImageUrls(urls, 40);
  }, [matchCards]);

  const remaining = useMemo(
    () => roundMatches.filter((m) => !m.prediction).length,
    [roundMatches],
  );

  const rankedGroups = useMemo<RankedGroup[]>(
    () =>
      globalGroups.map((g) => ({
        rank: g.rank,
        name: g.name,
        points: g.points,
        correctPredictions: g.correctPredictions,
        members: g.members,
        avatar: g.avatarUrl,
        isMine: g.isMine,
        id: g.id,
        hasScores: g.hasScores,
      })),
    [globalGroups],
  );

  const handleCreate = useCallback(
    async (name: string, localImageUri: string | null, inviteeIds: string[] = []) => {
      setCreateBusy(true);
      try {
        const data = await createGroup(name);
        const groupId = data.group?.id;
        if (localImageUri && groupId) {
          const uploaded = await upload(localImageUri, {
            endpoint: '/upload/group-avatar',
            fieldName: 'file',
            additionalData: { groupId },
          });
          if (uploaded.success && uploaded.url) {
            await updateGroup(undefined, uploaded.url);
          }
        }
        if (inviteeIds.length > 0) {
          const failures: string[] = [];
          for (const userId of inviteeIds) {
            try {
              await inviteUser(userId);
            } catch {
              failures.push(userId);
            }
          }
          if (failures.length > 0) {
            toast.showError(
              t.predictionGroups.createForm.inviteFailed,
              t.predictionGroups.createForm.inviteFailed,
            );
          }
        }
        setCreateOpen(false);
        setInviteShareOpen(true);
      } finally {
        setCreateBusy(false);
      }
    },
    [createGroup, inviteUser, t.predictionGroups.createForm.inviteFailed, toast, updateGroup, upload],
  );

  const handlePredict = useCallback(
    async (payload: {
      mode: 'WINNER' | 'EXACT';
      predictedWinner: 'home' | 'draw' | 'away';
      predictedHomeScore?: number;
      predictedAwayScore?: number;
    }) => {
      const apiMatchId = predictMatch?.apiMatchId ?? Number(predictMatch?.id);
      if (!apiMatchId) return;
      setPredictBusy(true);
      try {
        await savePredictions([
          {
            apiMatchId,
            mode: payload.mode,
            predictedWinner: payload.predictedWinner,
            predictedHomeScore: payload.predictedHomeScore,
            predictedAwayScore: payload.predictedAwayScore,
          },
        ]);
        setPredictMatch(null);
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : '';
        toast.showError(
          t.predictionGroups.toast.saveFailedTitle,
          /PREDICTION_ALREADY_SET|already|تعديل/i.test(msg)
            ? t.predictionGroups.toast.alreadySaved
            : msg || pgScreen.loadFailed,
        );
      } finally {
        setPredictBusy(false);
      }
    },
    [pgScreen.loadFailed, predictMatch, savePredictions, t.predictionGroups.toast, toast],
  );

  if (loading) {
    return (
      <View style={[styles.root, styles.centered]}>
        <LinearGradient colors={PG_GRADIENTS.screen} style={StyleSheet.absoluteFill} />
        <ActivityIndicator color={PG.primaryLight} size="large" />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={PG_GRADIENTS.screen} style={StyleSheet.absoluteFill} />
      {isHub ? null : (
        <PredictionWarsTopBar
          topInset={insets.top}
          title={warsTitle}
          xp={headerXp}
          onBack={() => router.back()}
        />
      )}

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => void handleRefresh()}
            tintColor={PG.primaryLight}
            colors={[PG.primaryLight]}
          />
        }
        contentContainerStyle={{
          paddingTop: isHub ? 0 : insets.top + chromeInset,
          paddingBottom: navClearance,
        }}
      >
        {navTab === 'standings' ? (
          <GroupsStandingsSection
            isRTL={isRTL}
            groups={rankedGroups}
            myGroupId={group?.id}
            onPeriodChange={(period) => {
              void refreshLeaderboard(period).catch(() => undefined);
            }}
          />
        ) : isHub ? (
          <GroupOnboarding
            isRTL={isRTL}
            topInset={insets.top}
            onBack={() => router.back()}
            groupBan={groupBan}
            suggestions={globalGroups}
            onCreatePress={() => setCreateOpen(true)}
            onJoinByCode={async (code) => {
              await joinGroup({ code });
            }}
          />
        ) : (
          <>
            <PredictionsCupHero
              isRTL={isRTL}
              name={group.name}
              avatarUrl={group.avatarUrl}
              membersCount={group.membersCount}
              matchesCount={roundMatches.length}
              inviteCode={group.inviteCode}
              isOwner={isOwner}
              onInvite={() => setInviteShareOpen(true)}
              onSettings={isOwner ? () => setEditOpen(true) : undefined}
              onLeave={() => setLeaveOpen(true)}
            />
            <DailyProgressCard isRTL={isRTL} remaining={remaining} total={roundMatches.length} />
            <CupSegmentTabs
              isRTL={isRTL}
              active={tab}
              matchesLabel={t.predictionGroups.tabs.matches}
              standingsLabel={t.predictionGroups.tabs.standings}
              onChange={setTab}
            />
            {tab === 'matches' ? (
              roundLoading && roundMatches.length === 0 ? (
                <ActivityIndicator color={PG.primaryLight} style={{ marginTop: 28 }} />
              ) : matchCards.length === 0 ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTxt}>{pgScreen.noMatches}</Text>
                </View>
              ) : (
                matchCards.map((m) => {
                  const row = roundMatches.find((r) => r.apiMatchId === m.apiMatchId);
                  const saved = Boolean(row?.prediction);
                  const status = row?.status ?? '';
                  const locked = saved || (status !== 'NS' && status !== 'TBD' && status !== '');
                  return (
                    <MatchVsCard
                      key={m.id}
                      match={m}
                      isRTL={isRTL}
                      saved={saved}
                      locked={locked}
                      status={status}
                      onPredict={() => setPredictMatch(m)}
                    />
                  );
                })
              )
            ) : (
              <GroupMembersStandings isRTL={isRTL} members={memberRows} />
            )}
          </>
        )}
      </ScrollView>

      {showCompactNav ? (
        <>
          <LinearGradient
            colors={['transparent', PG.bg]}
            style={[styles.bottomScrim, { height: navClearance }]}
            pointerEvents="none"
          />
          <LiquidGlassTabBar
            tabs={predictionGroupTabs}
            activeIndex={activeTabIndex}
            onNavigate={handleNavigate}
            bottomInset={insets.bottom}
            compact
          />
        </>
      ) : null}

      <GroupCreateScreen
        visible={createOpen}
        isRTL={isRTL}
        busy={createBusy}
        onClose={() => setCreateOpen(false)}
        onCreate={handleCreate}
      />

      <GroupInviteShareSheet
        visible={inviteShareOpen && Boolean(group)}
        groupName={group?.name ?? ''}
        inviteCode={group?.inviteCode ?? ''}
        onClose={() => setInviteShareOpen(false)}
        onInviteUsers={() => {
          setInviteShareOpen(false);
          setUserInviteOpen(true);
        }}
      />

      {group ? (
        <GroupInviteSheet
          visible={userInviteOpen}
          onClose={() => setUserInviteOpen(false)}
          groupName={group.name}
          inviteCode={group.inviteCode}
          isRTL={isRTL}
          onInviteUser={inviteUser}
          excludeUserIds={memberUserIds}
        />
      ) : null}

      {group ? (
        <GroupEditSheet
          visible={editOpen}
          onClose={() => setEditOpen(false)}
          groupId={group.id}
          groupName={group.name}
          groupImage={group.avatarUrl}
          isRTL={isRTL}
          isAdmin={isOwner}
          onSave={async (name, imageUri) => {
            await updateGroup(name, imageUri);
          }}
          onLeaveGroup={leaveGroup}
          onDeleteGroup={deleteGroup}
        />
      ) : null}

      <GroupConfirmDialog
        visible={leaveOpen}
        isRTL={isRTL}
        title={t.predictionGroups.header.leaveTitle}
        message={t.predictionGroups.header.leaveMessage}
        confirmLabel={t.predictionGroups.common.leave}
        destructive
        onCancel={() => setLeaveOpen(false)}
        onConfirm={() => {
          setLeaveOpen(false);
          void leaveGroup();
        }}
      />

      <PredictMatchModal
        visible={Boolean(predictMatch)}
        isRTL={isRTL}
        match={predictMatch}
        busy={predictBusy}
        onClose={() => setPredictMatch(null)}
        onConfirm={handlePredict}
      />

      <GroupJoinSheet
        visible={joinSheetOpen}
        code={pendingJoinCode}
        inviteId={pendingInviteId}
        onClose={() => setJoinSheetOpen(false)}
        onJoin={joinGroup}
        onJoined={() => void refreshMe()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: PG.bg },
  centered: { alignItems: 'center', justifyContent: 'center' },
  empty: { paddingVertical: 32, alignItems: 'center' },
  emptyTxt: { color: PG.textMuted, fontSize: 14 },
  bottomScrim: { position: 'absolute', left: 0, right: 0, bottom: 0, zIndex: 50 },
});
