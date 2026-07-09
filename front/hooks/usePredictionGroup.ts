import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
  GroupDailyInsight,
  GroupMemberRow,
  GroupRoundMatch,
  MyGroupState,
  PredictionGroupsService,
  RankedGroupRow,
} from '../services/predictionGroups.service';
import { logger } from '../utils/logger';

const EMPTY_GROUP_STATE: MyGroupState = {
  hasGroup: false,
  group: null,
  membership: null,
  groupBan: null,
};

export type GroupNavKey = 'group' | 'round' | 'standings';

export function usePredictionGroup() {
  const { getToken, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [roundLoading, setRoundLoading] = useState(false);
  const [state, setState] = useState<MyGroupState | null>(null);
  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [roundMatches, setRoundMatches] = useState<GroupRoundMatch[]>([]);
  const [roundMeta, setRoundMeta] = useState<{ id: string; date: string; status: string; number?: number | null } | null>(null);
  const [globalGroups, setGlobalGroups] = useState<RankedGroupRow[]>([]);
  const [groupStats, setGroupStats] = useState<{
    totalPredictions: number;
    correctPredictions: number;
    wrongPredictions: number;
  } | null>(null);
  const [dailyInsight, setDailyInsight] = useState<GroupDailyInsight | null>(null);

  const getTokenRef = useRef(getToken);
  const isSignedInRef = useRef(isSignedIn);
  const stateRef = useRef(state);
  const roundMatchesRef = useRef(roundMatches);
  const refreshMeInFlight = useRef(false);
  const refreshGroupInFlight = useRef(false);
  const lastRefreshMeAt = useRef(0);

  getTokenRef.current = getToken;
  isSignedInRef.current = isSignedIn;
  stateRef.current = state;
  roundMatchesRef.current = roundMatches;

  const withToken = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T> => {
    const token = await getTokenRef.current();
    if (!token) throw new Error('NOT_AUTHENTICATED');
    return fn(token);
  }, []);

  const applyState = useCallback((data: MyGroupState) => {
    stateRef.current = data;
    setState(data);
    if (!data.hasGroup) {
      setMembers([]);
      setRoundMatches([]);
      setRoundMeta(null);
      setGroupStats(null);
      setDailyInsight(null);
    }
  }, []);

  const refreshMe = useCallback(async (bustCache = false) => {
    if (refreshMeInFlight.current) return;
    refreshMeInFlight.current = true;
    lastRefreshMeAt.current = Date.now();

    if (!isSignedInRef.current) {
      applyState(EMPTY_GROUP_STATE);
      setLoading(false);
      refreshMeInFlight.current = false;
      return;
    }

    try {
      const data = await withToken((t) => PredictionGroupsService.getMe(t, bustCache));
      applyState(data);
    } catch (err) {
      logger.error('[usePredictionGroup] getMe failed:', err);
      throw err;
    } finally {
      setLoading(false);
      refreshMeInFlight.current = false;
    }
  }, [applyState, withToken]);

  const refreshMeIfStale = useCallback(
    async (minIntervalMs = 2000) => {
      if (Date.now() - lastRefreshMeAt.current < minIntervalMs) return;
      await refreshMe();
    },
    [refreshMe],
  );

  const refreshGroupData = useCallback(async (
    groupId?: string,
    opts?: { roundOnly?: boolean; standingsOnly?: boolean; force?: boolean },
  ) => {
    const id = groupId ?? stateRef.current?.group?.id;
    if (!id) return;
    if (refreshGroupInFlight.current && !opts?.force) return;

    refreshGroupInFlight.current = true;
    if (opts?.roundOnly) setRoundLoading(true);

    try {
      if (opts?.roundOnly) {
        const round = await withToken((t) => PredictionGroupsService.getCurrentRound(t, id, true));
        setRoundMatches(round.matches);
        setRoundMeta(round.round);
        return;
      }

      if (opts?.standingsOnly) {
        const standings = await withToken((t) => PredictionGroupsService.getStandings(t, id));
        setMembers(standings.members);
        setGroupStats(standings.groupStats);
        setDailyInsight(standings.insight ?? null);
        return;
      }

      const [standings, round] = await Promise.all([
        withToken((t) => PredictionGroupsService.getStandings(t, id)),
        withToken((t) => PredictionGroupsService.getCurrentRound(t, id, true)),
      ]);
      setMembers(standings.members);
      setGroupStats(standings.groupStats);
      setDailyInsight(standings.insight ?? null);
      setRoundMatches(round.matches);
      setRoundMeta(round.round);
    } catch (err) {
      logger.error('[usePredictionGroup] refreshGroupData failed:', err);
      throw err;
    } finally {
      if (opts?.roundOnly) setRoundLoading(false);
      refreshGroupInFlight.current = false;
    }
  }, [withToken]);

  const refreshLeaderboard = useCallback(
    async (period: 'all' | 'week' | 'month' = 'all') => {
      const rows = await withToken((t) => PredictionGroupsService.getLeaderboard(t, period));
      const mineId = stateRef.current?.group?.id;
      setGlobalGroups(rows.map((r) => ({ ...r, isMine: r.id === mineId })));
    },
    [withToken],
  );

  const refreshActiveTab = useCallback(
    async (tab: GroupNavKey) => {
      const groupId = stateRef.current?.group?.id;
      setRefreshing(true);
      try {
        if (tab === 'group') {
          if (!groupId) return;
          await refreshGroupData(groupId, { standingsOnly: true, force: true });
        } else if (tab === 'round') {
          if (!groupId) return;
          await refreshGroupData(groupId, { roundOnly: true, force: true });
        } else {
          await refreshLeaderboard('all');
        }
      } finally {
        setRefreshing(false);
      }
    },
    [refreshGroupData, refreshLeaderboard],
  );

  useEffect(() => {
    void refreshMe().catch(() => undefined);
  }, [refreshMe]);

  useEffect(() => {
    if (state?.hasGroup && state.group?.id) {
      void refreshGroupData(state.group.id, { standingsOnly: true }).catch(() => undefined);
    }
  }, [state?.hasGroup, state?.group?.id, refreshGroupData]);

  const createGroup = useCallback(
    async (name: string, avatarUrl?: string | null) => {
      const data = await withToken((t) => PredictionGroupsService.createGroup(t, name, avatarUrl));
      applyState(data);
      if (data.hasGroup && data.group) {
        await refreshGroupData(data.group.id);
      }
      return data;
    },
    [applyState, refreshGroupData, withToken],
  );

  const joinGroup = useCallback(
    async (opts: { code?: string; inviteId?: string }) => {
      const data = await withToken((t) => PredictionGroupsService.join(t, opts));
      applyState(data);
      if (data.hasGroup && data.group) {
        await refreshGroupData(data.group.id);
      }
      return data;
    },
    [applyState, refreshGroupData, withToken],
  );

  const updateGroup = useCallback(
    async (name?: string, avatarUrl?: string | null) => {
      const groupId = stateRef.current?.group?.id;
      if (!groupId) return null;
      const data = await withToken((t) =>
        PredictionGroupsService.updateGroup(t, groupId, { name, avatarUrl }),
      );
      applyState(data);
      return data;
    },
    [applyState, withToken],
  );

  const leaveGroup = useCallback(async () => {
    const prevState = stateRef.current;
    applyState({
      hasGroup: false,
      group: null,
      membership: null,
      groupBan: prevState?.groupBan ?? null,
    });

    try {
      const result = await withToken((t) => PredictionGroupsService.leave(t));
      if (result?.state) applyState(result.state);
      return result;
    } catch (err) {
      if (prevState) applyState(prevState);
      throw err;
    }
  }, [applyState, withToken]);

  const deleteGroup = useCallback(async () => {
    const prevState = stateRef.current;
    const groupId = prevState?.group?.id;
    if (!groupId) return null;

    applyState({
      hasGroup: false,
      group: null,
      membership: null,
      groupBan: prevState?.groupBan ?? null,
    });

    try {
      const result = await withToken((t) => PredictionGroupsService.deleteGroup(t, groupId));
      if (result?.state) applyState(result.state);
      return result;
    } catch (err) {
      if (prevState) applyState(prevState);
      throw err;
    }
  }, [applyState, withToken]);

  const savePredictions = useCallback(
    async (
      predictions: Array<{
        apiMatchId: number;
        mode: 'WINNER' | 'EXACT';
        predictedWinner?: 'home' | 'draw' | 'away';
        predictedHomeScore?: number;
        predictedAwayScore?: number;
      }>,
    ) => {
      const groupId = stateRef.current?.group?.id;
      if (!groupId) throw new Error('NOT_IN_GROUP');

      const unsaved = predictions.filter((p) => {
        const match = roundMatchesRef.current.find((m) => m.apiMatchId === p.apiMatchId);
        return !match?.prediction;
      });
      if (unsaved.length === 0) {
        throw new Error('PREDICTION_ALREADY_SET');
      }

      await withToken((t) => PredictionGroupsService.savePredictions(t, groupId, unsaved));

      setRoundMatches((prev) =>
        prev.map((m) => {
          const p = unsaved.find((x) => x.apiMatchId === m.apiMatchId);
          if (!p || m.prediction) return m;
          return {
            ...m,
            prediction: {
              mode: p.mode,
              predictedWinner: p.predictedWinner ?? null,
              predictedHomeScore: p.predictedHomeScore ?? null,
              predictedAwayScore: p.predictedAwayScore ?? null,
              isCorrect: null,
              xpAwarded: 0,
            },
          };
        }),
      );

      await refreshGroupData(groupId, { roundOnly: true, force: true });
    },
    [refreshGroupData, withToken],
  );

  const inviteUser = useCallback(
    async (userId: string) => {
      const groupId = stateRef.current?.group?.id;
      if (!groupId) return;
      await withToken((t) => PredictionGroupsService.inviteUser(t, groupId, userId));
    },
    [withToken],
  );

  const kickMember = useCallback(
    async (userId: string) => {
      const groupId = stateRef.current?.group?.id;
      if (!groupId) return;
      await withToken((t) => PredictionGroupsService.kickMember(t, groupId, userId));
      await refreshGroupData(groupId, { force: true });
    },
    [refreshGroupData, withToken],
  );

  return {
    loading,
    refreshing,
    roundLoading,
    state,
    members,
    roundMatches,
    roundMeta,
    globalGroups,
    groupStats,
    dailyInsight,
    groupBan: state?.groupBan ?? null,
    isOwner: state?.membership?.isOwner ?? false,
    refreshMe,
    refreshMeIfStale,
    refreshGroupData,
    refreshLeaderboard,
    refreshActiveTab,
    createGroup,
    joinGroup,
    updateGroup,
    leaveGroup,
    deleteGroup,
    savePredictions,
    inviteUser,
    kickMember,
  };
}
