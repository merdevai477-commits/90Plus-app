/** Entity records supplied to the quiz AI — sourced from TeamInfo + CachedTeam. */

export type QuizEntityCategory = 'player' | 'club' | 'stadium';

export interface QuizDatasetPlayer {
  id: string;
  name: string;
  apiPlayerId: number;
  position: string;
  jerseyNumber?: number;
  teamId: number;
  teamName: string;
  country?: string;
  nationality?: string;
  age?: number;
  birthdate?: string;
  achievements?: string[];
  statistics?: Record<string, string | number>;
}

export interface QuizDatasetClub {
  id: string;
  name: string;
  apiTeamId: number;
  country?: string;
  founded?: number;
  logoUrl?: string;
}

export interface QuizDatasetStadium {
  id: string;
  name: string;
  city?: string;
  capacity?: number;
  teamName: string;
  apiTeamId: number;
  imageUrl?: string;
}

export interface QuizEntityDataset {
  players: QuizDatasetPlayer[];
  clubs: QuizDatasetClub[];
  stadiums: QuizDatasetStadium[];
}

export interface QuizEntitySlice {
  players: QuizDatasetPlayer[];
  clubs: QuizDatasetClub[];
  stadiums: QuizDatasetStadium[];
}

export type QuizDatasetBuildResult =
  | { ok: true; dataset: QuizEntityDataset }
  | { ok: false; reason: 'INSUFFICIENT_DATA'; counts: { players: number; clubs: number; stadiums: number } };

export interface QuizPackValidationContext {
  correctAnswerEntityIds: Set<string>;
  distractorEntityIds: Set<string>;
}
