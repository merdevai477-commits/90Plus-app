export type WidgetMatchStatus = 'live' | 'upcoming' | 'finished';

export interface WidgetMatchRow {
  id: string;
  fixtureId: number;
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  homeScore: number | null;
  awayScore: number | null;
  status: WidgetMatchStatus;
  statusLabel: string;
  league: string;
  kickoff?: string;
}

export interface MatchesWidgetPayload {
  updatedAt: number;
  liveCount: number;
  matches: WidgetMatchRow[];
}

export const EMPTY_WIDGET_PAYLOAD: MatchesWidgetPayload = {
  updatedAt: Date.now(),
  liveCount: 0,
  matches: [],
};
