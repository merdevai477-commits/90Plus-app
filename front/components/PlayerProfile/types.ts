import type { Player365LastMatch } from '../../services/apiFootball';

export type PlayerProfileTab = 'stats' | 'overview';

export interface PlayerSeasonSummary {
  matches: number | null;
  goals: number | null;
  assists: number | null;
  minutes: number | null;
  shotsOnTarget: number | null;
  chancesCreated: number | null;
  yellowCards: number | null;
  redCards: number | null;
}

export interface PlayerDetailedStats {
  passAccuracy: number | null;
  shotsOnTarget: number | null;
  shots: number | null;
  yellowCards: number | null;
  chancesCreated: number | null;
  dribbles: number | null;
}

export interface PlayerPer90Stats {
  goals: number | null;
  assists: number | null;
  shots: number | null;
  keyPasses: number | null;
  dribbles: number | null;
  xG: number | null;
}

export interface PlayerTransferRow {
  key: string;
  clubName: string;
  clubLogo: string | null;
  date: string | null;
  price: string | null;
  title: string | null;
  active: boolean;
}

export interface PlayerProfileViewModel {
  name: string;
  photoCandidates: string[];
  photoKey: string;
  jerseyNumber: number | null;
  nationality: string | null;
  clubName: string | null;
  clubLogo: string | null;
  position: string | null;
  height: string | null;
  age: number | null;
  seasonLabel: string | null;
  seasons: { key: string; label: string }[];
  selectedSeasonKey: string | null;
  season: PlayerSeasonSummary | null;
  detailed: PlayerDetailedStats | null;
  averageRating: number | null;
  per90: PlayerPer90Stats | null;
  lastMatches: Player365LastMatch[];
  transfers: PlayerTransferRow[];
}
