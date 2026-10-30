import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from '@clerk/clerk-expo';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import {
  PredictionApiError,
  PredictionsService,
  type KingHistoryItem,
} from '../../services/predictions.service';

export type KingPickType = 'home' | 'draw' | 'away';

export interface KingPick {
  type?: KingPickType;
  home: number | null;
  away: number | null;
  correct: boolean | null;
}

export interface KingPickMeta {
  homeTeam: string;
  awayTeam: string;
  homeTeamLogo?: string;
  awayTeamLogo?: string;
  matchDate: string;
  leagueName?: string;
}

type LocalPick = KingPick & { meta: KingPickMeta; seq: number };

type ServerRow = {
  prediction?: { type?: KingPickType };
  predictedHomeScore?: number | null;
  predictedAwayScore?: number | null;
  isCorrect?: boolean | null;
};

interface KingPicksState {
  server: Record<string, KingPick>;
  /** Saves the user made on this device that a server read has not echoed back yet. */
  local: Record<string, LocalPick>;
  /** Bumps on every save the server accepts, so lists fed by other endpoints can refetch. */
  confirmed: number;
  /** Clerk user the persisted picks belong to. */
  userId: string | null;
  /** Picks restored from disk that no server read has vouched for yet. */
  fromDisk: Record<string, true>;
  /** bindUser has run; restored picks of another account are then dropped. */
  bound: boolean;
  /** Bumps when a PREDICTION_RESULT push arrives so history and boards refetch (D9). */
  results: number;
  noteResult: () => void;
  /**
   * `requestedIds` are the matches the read asked about; a restored pick the
   * server no longer returns for one of them is dropped (D5).
   */
  hydrate: (predictionsMap: Record<string, unknown>, requestedIds?: Array<string | number>) => void;
  clear: () => void;
  /** Sign-out or a different account wipes the picks; the same user keeps them (D6). */
  bindUser: (userId: string | null) => void;
  /** Applies the pick right away and returns a token for settling it. */
  begin: (matchId: string, pick: KingPick, meta: KingPickMeta) => number;
  confirm: (matchId: string, seq: number) => void;
  revert: (matchId: string, seq: number) => void;
}

let nextSeq = 0;

function samePick(a: KingPick, b: KingPick): boolean {
  return a.type === b.type && a.home === b.home && a.away === b.away;
}

function rowToPick(row: ServerRow): KingPick {
  return {
    type: row.prediction?.type,
    home: row.predictedHomeScore ?? null,
    away: row.predictedAwayScore ?? null,
    correct: row.isCorrect ?? null,
  };
}

function stripLocal(pick: LocalPick): KingPick {
  const { meta: _meta, seq: _seq, ...saved } = pick;
  return saved;
}

export const useKingPicksStore = create<KingPicksState>()(persist((set) => ({
  server: {},
  local: {},
  confirmed: 0,
  userId: null,
  fromDisk: {},
  bound: false,
  results: 0,

  noteResult: () => set((state) => ({ results: state.results + 1 })),

  hydrate: (predictionsMap, requestedIds = []) =>
    set((state) => {
      const incoming: Record<string, KingPick> = {};
      for (const [id, raw] of Object.entries(predictionsMap ?? {})) {
        incoming[String(id)] = rowToPick(raw as ServerRow);
      }
      const asked = new Set(requestedIds.map(String));
      const fromDisk = { ...state.fromDisk };
      for (const id of [...asked, ...Object.keys(incoming)]) delete fromDisk[id];

      // A cached/stale GET can predate a save; keep the local pick until the
      // server returns the same values.
      const local: Record<string, LocalPick> = {};
      for (const [id, pick] of Object.entries(state.local)) {
        const key = String(id);
        const fromServer = incoming[key];
        if (!fromServer || !samePick(fromServer, pick)) local[key] = pick;
      }

      const server: Record<string, KingPick> = { ...incoming };

      // Re-apply in-flight locals the payload omitted (empty/stale cache race).
      for (const [id, pick] of Object.entries(local)) {
        if (!server[id]) server[id] = stripLocal(pick);
      }

      // Pending picks already confirmed into `server` must not vanish when a
      // later hydrate arrives empty (common after iOS blur→focus reloads).
      for (const [id, pick] of Object.entries(state.server)) {
        const key = String(id);
        if (server[key]) continue;
        // A restored pick the server was just asked about and did not return is gone.
        if (state.fromDisk[key] && asked.has(key)) continue;
        if (pick.correct == null || state.fromDisk[key]) server[key] = pick;
      }

      return { server, local, fromDisk };
    }),

  clear: () => set({ server: {}, local: {}, fromDisk: {} }),

  bindUser: (userId) =>
    set((state) => {
      if (state.userId === userId) return state.bound ? state : { bound: true };
      return { userId, bound: true, server: {}, local: {}, fromDisk: {} };
    }),

  begin: (matchId, pick, meta) => {
    const seq = ++nextSeq;
    const id = String(matchId);
    set((state) => ({ local: { ...state.local, [id]: { ...pick, meta, seq } } }));
    return seq;
  },

  // The local pick stays until hydrate sees it, so lists that refetch after
  // this bump never drop the row in between.
  confirm: (matchId, seq) =>
    set((state) => {
      const id = String(matchId);
      const pick = state.local[id];
      if (!pick || pick.seq !== seq) return state;
      return {
        server: { ...state.server, [id]: stripLocal(pick) },
        confirmed: state.confirmed + 1,
      };
    }),

  revert: (matchId, seq) =>
    set((state) => {
      const id = String(matchId);
      if (state.local[id]?.seq !== seq) return state;
      const { [id]: _failed, ...local } = state.local;
      return { local };
    }),
}), {
  name: 'king-picks',
  storage: createJSONStorage(() => AsyncStorage),
  // In-flight saves are not persisted: one the app was killed during would show forever.
  partialize: (state) => ({ server: state.server, userId: state.userId }),
  merge: (persisted, current) => {
    const saved = (persisted ?? {}) as Partial<Pick<KingPicksState, 'server' | 'userId'>>;
    const savedUser = saved.userId ?? null;
    // Restoring can finish after bindUser: never hand one account's picks to another (or to nobody).
    if (!savedUser || (current.bound && savedUser !== current.userId)) return current;
    const restored = saved.server ?? {};
    const fromDisk: Record<string, true> = {};
    for (const id of Object.keys(restored)) if (!current.server[id]) fromDisk[id] = true;
    return { ...current, server: { ...restored, ...current.server }, userId: savedUser, fromDisk };
  },
}));

/** Keeps the picks tied to the signed-in Clerk user. */
export function useBindKingPicksUser(): void {
  const { isLoaded, userId } = useAuth();
  useEffect(() => {
    if (isLoaded) useKingPicksStore.getState().bindUser(userId ?? null);
  }, [isLoaded, userId]);
}

/** Only a 4xx proves the server refused the save; anything else may have been stored (D3). */
export function isDefiniteRejection(err: unknown): boolean {
  return err instanceof PredictionApiError && err.status >= 400 && err.status < 500;
}

/**
 * After a save failed without a definite answer, ask the server whether it
 * stored the pick. Confirms or reverts accordingly; leaves the pick pending
 * when the server cannot be reached either.
 */
export async function settleUncertainSave(
  token: string,
  matchId: string,
  seq: number,
): Promise<'confirmed' | 'reverted' | 'unknown'> {
  const store = useKingPicksStore.getState();
  const pick = store.local[matchId];
  if (!pick || pick.seq !== seq) return 'unknown';
  let map: Record<string, unknown>;
  try {
    map = await PredictionsService.getPredictionsForMatches(token, [matchId]);
  } catch {
    return 'unknown';
  }
  const row = map[matchId];
  if (row && samePick(rowToPick(row as ServerRow), pick)) {
    useKingPicksStore.getState().confirm(matchId, seq);
    return 'confirmed';
  }
  useKingPicksStore.getState().revert(matchId, seq);
  return 'reverted';
}

export function isExactPick(pick: Pick<KingPick, 'home' | 'away'>): boolean {
  return pick.home != null && pick.away != null;
}

/** Local saves for one mode, shaped like history rows so the list can show them before the server does. */
export function localHistoryItems(
  local: Record<string, LocalPick>,
  exact: boolean,
): KingHistoryItem[] {
  return Object.entries(local).flatMap(([matchId, pick]) => {
    if (isExactPick(pick) !== exact) return [];
    return [{
      id: `local-${matchId}`,
      apiMatchId: Number(matchId),
      predictionType: pick.type ?? 'draw',
      predictedHomeScore: pick.home,
      predictedAwayScore: pick.away,
      homeTeam: pick.meta.homeTeam,
      awayTeam: pick.meta.awayTeam,
      homeTeamLogo: pick.meta.homeTeamLogo ?? null,
      awayTeamLogo: pick.meta.awayTeamLogo ?? null,
      matchDate: pick.meta.matchDate,
      leagueName: pick.meta.leagueName ?? null,
      isCorrect: null,
      finalHomeScore: null,
      finalAwayScore: null,
      matchStatus: null,
    }];
  });
}
