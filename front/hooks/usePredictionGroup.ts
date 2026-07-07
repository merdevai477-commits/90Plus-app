import { useAuth } from '@clerk/clerk-expo';
import { useCallback, useEffect, useRef, useState } from 'react';

import {
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

  const getTokenRef = useRef(getToken);
  const isSignedInRef = useRef(isSignedIn);
  const stateRef = useRef(state);
  const refreshMeInFlight = useRef(false);
  const refreshGroupInFlight = useRef(false);
  const lastRefreshMeAt = useRef(0);

  getTokenRef.current = getToken;
  isSignedInRef.current = isSignedIn;
  stateRef.current = state;

  const withToken = useCallback(async <T,>(fn: (token: string) => Promise<T>): Promise<T | null> => {
    const token = await getTokenRef.current();
    if (!token) return null;
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
      if (data) applyState(data);
    } catch (err) {
      logger.error('[usePredictionGroup] getMe failed:', err);
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

  const refreshGroupData = useCallback(async (groupId?: string) => {
    const id = groupId ?? stateRef.current?.group?.id;
    if (!id || refreshGroupInFlight.current) return;

    refreshGroupInFlight.current = true;
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
    } finally {
      refreshGroupInFlight.current = false;
    }
  }, [withToken]);

  const refreshLeaderboard = useCallback(
    async (period: 'all' | 'week' | 'month' = 'all') => {
      try {
        const rows = await withToken((t) => PredictionGroupsService.getLeaderboard(t, period));
        if (rows) {
          const mineId = stateRef.current?.group?.id;
          setGlobalGroups(rows.map((r) => ({ ...r, isMine: r.id === mineId })));
        }
      } catch (err) {
        logger.error('[usePredictionGroup] leaderboard failed:', err);
      }
    },
    [withToken],
  );

  useEffect(() => {
    void refreshMe();
  }, [refreshMe]);

  useEffect(() => {
    if (state?.hasGroup && state.group?.id) {
      void refreshGroupData(state.group.id);
    }
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
      const groupId = stateRef.current?.group?.id;
      if (!groupId) return null;
      const data = await withToken((t) =>
        PredictionGroupsService.updateGroup(t, groupId, { name, avatarUrl }),
      );
      if (data) applyState(data);
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
      if (!groupId) return;
      await withToken((t) => PredictionGroupsService.savePredictions(t, groupId, predictions));
      await refreshGroupData(groupId);
    },
    [withToken, refreshGroupData],
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
      await refreshGroupData(groupId);
    },
    [withToken, refreshGroupData],
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
    refreshMeIfStale,
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
