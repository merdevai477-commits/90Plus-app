import { create } from 'zustand';

import type { KingHistoryItem } from '../../services/predictions.service';

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
  hydrate: (predictionsMap: Record<string, unknown>) => void;
  clear: () => void;
  /** Applies the pick right away and returns a token for settling it. */
  begin: (matchId: string, pick: KingPick, meta: KingPickMeta) => number;
  confirm: (matchId: string, seq: number) => void;
  revert: (matchId: string, seq: number) => void;
}

let nextSeq = 0;

function samePick(a: KingPick, b: KingPick): boolean {
  return a.type === b.type && a.home === b.home && a.away === b.away;
}

export const useKingPicksStore = create<KingPicksState>((set) => ({
  server: {},
  local: {},
  confirmed: 0,

  hydrate: (predictionsMap) =>
    set((state) => {
      const server: Record<string, KingPick> = {};
      for (const [id, raw] of Object.entries(predictionsMap ?? {})) {
        const row = raw as ServerRow;
        server[id] = {
          type: row.prediction?.type,
          home: row.predictedHomeScore ?? null,
          away: row.predictedAwayScore ?? null,
          correct: row.isCorrect ?? null,
        };
      }
      // A cached server read can predate a save; keep the local pick until the
      // server returns the same values.
      const local: Record<string, LocalPick> = {};
      for (const [id, pick] of Object.entries(state.local)) {
        const fromServer = server[id];
        if (!fromServer || !samePick(fromServer, pick)) local[id] = pick;
      }
      return { server, local };
    }),

  clear: () => set({ server: {}, local: {} }),

  begin: (matchId, pick, meta) => {
    const seq = ++nextSeq;
    set((state) => ({ local: { ...state.local, [matchId]: { ...pick, meta, seq } } }));
    return seq;
  },

  // The local pick stays until hydrate sees it, so lists that refetch after
  // this bump never drop the row in between.
  confirm: (matchId, seq) =>
    set((state) => {
      const pick = state.local[matchId];
      if (!pick || pick.seq !== seq) return state;
      const { meta: _meta, seq: _seq, ...saved } = pick;
      return {
        server: { ...state.server, [matchId]: saved },
        confirmed: state.confirmed + 1,
      };
    }),

  revert: (matchId, seq) =>
    set((state) => {
      if (state.local[matchId]?.seq !== seq) return state;
      const { [matchId]: _failed, ...local } = state.local;
      return { local };
    }),
}));

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
