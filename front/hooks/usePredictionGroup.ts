import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useState } from 'react';

import {
  GroupMemberRow,
  GroupRoundMatch,
  MyGroupState,
  PredictionGroupsService,
  RankedGroupRow,
} from '../services/predictionGroups.service';
import { logger } from '../utils/logger';

export function usePredictionGroup() {
  const { getToken, isSignedIn } = useAuth();
  const [loading, setLoading] = useState(true);
  const [state, setState] = useState<MyGroupState | null>(null);
  const [members, setMembers] = useState<GroupMemberRow[]>([]);
  const [roundMatches, setRoundMatches] = useState<GroupRoundMatch[]>([]);
  const [roundMeta, setRoundMeta] = useState<{ id: string; date: string; status: string } | null>(null);
  const [globalGroups, setGlobalGroups] = useState<RankedGroupRow[]>([]);
  const [groupStats, setGroupStats] = useState<{
    totalPredictions: number;
    correctPredictions: number;
    wrongPredictions: number;
  } | null>(null);

  const withToken = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T | null> => {
    const token = await getToken();
    if (!token) return null;
    return fn(token);
  }, [getToken]);

  const applyState = useCallback((data: MyGroupState) => {
    setState(data);
    if (!data.hasGroup) {
      setMembers([]);
      setRoundMatches([]);
      setRoundMeta(null);
      setGroupStats(null);
    }
  }, []);

  const refreshMe = useCallback(async (bustCache = false) => {
    if (!isSignedIn) {
      setState({ hasGroup: false, group: null, membership: null, groupBan: null });
      setLoading(false);
      return;
    }
    try {
      const data = await withToken((t) => PredictionGroupsService.getMe(t, bustCache));
      if (data) applyState(data);
    } catch (err) {
      logger.error('[usePredictionGroup] getMe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [applyState, isSignedIn, withToken]);

  const refreshGroupData = useCallback(async (groupId?: string) => {
    const id = groupId ?? state?.group?.id;
    if (!id) return;
    try {
      const [membersData, standings, round] = await Promise.all([
        withToken((t) => PredictionGroupsService.getMembers(t, id)),
        withToken((t) => PredictionGroupsService.getStandings(t, id)),
        withToken((t) => PredictionGroupsService.getCurrentRound(t, id)),
      ]);
      if (membersData) setMembers(membersData);
      if (standings) {
        setMembers(standings.members);
        setGroupStats(standings.groupStats);
      }
      if (round) {
        setRoundMatches(round.matches);
        setRoundMeta(round.round);
      }
    } catch (err) {
      logger.error('[usePredictionGroup] refreshGroupData failed:', err);
    }
  }, [state?.group?.id, withToken]);

  const refreshLeaderboard = useCallback(
    async (period: 'all' | 'week' | 'month' = 'all') => {
      try {
        const rows = await withToken((t) => PredictionGroupsService.getLeaderboard(t, period));
        if (rows) {
          const mineId = state?.group?.id;
          setGlobalGroups(rows.map((r) => ({ ...r, isMine: r.id === mineId })));
        }
      } catch (err) {
        logger.error('[usePredictionGroup] leaderboard failed:', err);
      }
    },
    [state?.group?.id, withToken],
  );

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (state?.hasGroup && state.group) void refreshGroupData(state.group.id);
  }, [state?.hasGroup, state?.group?.id, refreshGroupData]);

  const createGroup = useCallback(
    async (name: string, avatarUrl?: string | null) => {
      const data = await withToken((t) => PredictionGroupsService.createGroup(t, name, avatarUrl));
      if (data) {
        applyState(data);
        if (data.hasGroup && data.group) {
          void refreshGroupData(data.group.id);
        }
      }
      return data;
    },
    [applyState, refreshGroupData, withToken],
  );

  const joinGroup = useCallback(
    async (opts: { code?: string; inviteId?: string }) => {
      const data = await withToken((t) => PredictionGroupsService.join(t, opts));
      if (data) {
        applyState(data);
        if (data.hasGroup && data.group) {
          void refreshGroupData(data.group.id);
        }
      }
      return data;
    },
    [applyState, refreshGroupData, withToken],
  );

  const updateGroup = useCallback(
    async (name?: string, avatarUrl?: string | null) => {
      if (!state?.group) return null;
      const data = await withToken((t) =>
        PredictionGroupsService.updateGroup(t, state.group!.id, { name, avatarUrl }),
      );
      if (data) applyState(data);
      return data;
    },
    [applyState, state?.group, withToken],
  );

  const leaveGroup = useCallback(async () => {
    const result = await withToken((t) => PredictionGroupsService.leave(t));
    if (result?.state) applyState(result.state);
    return result;
  }, [applyState, withToken]);

  const deleteGroup = useCallback(async () => {
    if (!state?.group) return null;
    const result = await withToken((t) => PredictionGroupsService.deleteGroup(t, state.group!.id));
    if (result?.state) applyState(result.state);
    return result;
  }, [applyState, state?.group, withToken]);

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
      if (!state?.group) return;
      await withToken((t) => PredictionGroupsService.savePredictions(t, state.group!.id, predictions));
      await refreshGroupData(state.group.id);
    },
    [state?.group, withToken, refreshGroupData],
  );

  const inviteUser = useCallback(
    async (userId: string) => {
      if (!state?.group) return;
      await withToken((t) => PredictionGroupsService.inviteUser(t, state.group!.id, userId));
    },
    [state?.group, withToken],
  );

  const kickMember = useCallback(
    async (userId: string) => {
      if (!state?.group) return;
      await withToken((t) => PredictionGroupsService.kickMember(t, state.group!.id, userId));
      await refreshGroupData(state.group.id);
    },
    [state?.group, withToken, refreshGroupData],
  );

  return {
    loading,
    state,
    members,
    roundMatches,
    roundMeta,
    globalGroups,
    groupStats,
    groupBan: state?.groupBan ?? null,
    isOwner: state?.membership?.isOwner ?? false,
    refreshMe,
    refreshGroupData,
    refreshLeaderboard,
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
