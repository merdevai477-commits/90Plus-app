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

  const refreshMe = useCallback(async () => {
    if (!isSignedIn) {
      setState({ hasGroup: false, group: null, membership: null });
      setLoading(false);
      return;
    }
    try {
      const data = await withToken((t) => PredictionGroupsService.getMe(t));
      if (data) setState(data);
    } catch (err) {
      logger.error('[usePredictionGroup] getMe failed:', err);
    } finally {
      setLoading(false);
    }
  }, [isSignedIn, withToken]);

  const refreshGroupData = useCallback(async () => {
    if (!state?.hasGroup || !state.group) return;
    const groupId = state.group.id;
    try {
      const [membersData, standings, round] = await Promise.all([
        withToken((t) => PredictionGroupsService.getMembers(t, groupId)),
        withToken((t) => PredictionGroupsService.getStandings(t, groupId)),
        withToken((t) => PredictionGroupsService.getCurrentRound(t, groupId)),
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
  }, [state, withToken]);

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
    if (state?.hasGroup) void refreshGroupData();
  }, [state?.hasGroup, state?.group?.id, refreshGroupData]);

  const createGroup = useCallback(
    async (name: string, avatarUrl?: string | null) => {
      const data = await withToken((t) => PredictionGroupsService.createGroup(t, name, avatarUrl));
      if (data) setState(data);
      return data;
    },
    [withToken],
  );

  const joinGroup = useCallback(
    async (opts: { code?: string; inviteId?: string }) => {
      const data = await withToken((t) => PredictionGroupsService.join(t, opts));
      if (data) setState(data);
      return data;
    },
    [withToken],
  );

  const updateGroup = useCallback(
    async (name?: string, avatarUrl?: string | null) => {
      if (!state?.group) return null;
      const data = await withToken((t) =>
        PredictionGroupsService.updateGroup(t, state.group!.id, { name, avatarUrl }),
      );
      if (data) setState(data);
      return data;
    },
    [state?.group, withToken],
  );

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
      await refreshGroupData();
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
      await refreshGroupData();
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
    isOwner: state?.membership?.isOwner ?? false,
    refreshMe,
    refreshGroupData,
    refreshLeaderboard,
    createGroup,
    joinGroup,
    updateGroup,
    savePredictions,
    inviteUser,
    kickMember,
  };
}
