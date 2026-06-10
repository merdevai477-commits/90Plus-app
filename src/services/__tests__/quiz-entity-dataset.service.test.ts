import {
  isDatasetSufficient,
  selectDailyEntitySlice,
} from '../quiz-entity-dataset.service';
import type { QuizEntityDataset } from '../../types/quiz-entity.types';
import {
  QUIZ_DATASET_MIN_CLUBS,
  QUIZ_DATASET_MIN_PLAYERS,
  QUIZ_DATASET_MIN_STADIUMS,
} from '../../constants/quiz.constants';

function mockDataset(overrides?: Partial<QuizEntityDataset>): QuizEntityDataset {
  const players = Array.from({ length: QUIZ_DATASET_MIN_PLAYERS }, (_, i) => ({
    id: `player:${1000 + i}`,
    name: `Player ${i}`,
    apiPlayerId: 1000 + i,
    position: i % 2 === 0 ? 'Attacker' : 'Midfielder',
    teamId: 40 + (i % 3),
    teamName: `Team ${i % 3}`,
    country: 'England',
  }));

  const clubs = Array.from({ length: QUIZ_DATASET_MIN_CLUBS }, (_, i) => ({
    id: `team:${500 + i}`,
    name: `Club ${i}`,
    apiTeamId: 500 + i,
    country: 'England',
    logoUrl: `https://example.com/logo${i}.png`,
  }));

  const stadiums = Array.from({ length: QUIZ_DATASET_MIN_STADIUMS }, (_, i) => ({
    id: `venue:${500 + i}`,
    name: `Stadium ${i}`,
    teamName: `Club ${i}`,
    apiTeamId: 500 + i,
    imageUrl: `https://example.com/venue${i}.png`,
  }));

  return {
    players,
    clubs,
    stadiums,
    ...overrides,
  };
}

describe('quiz-entity-dataset.service', () => {
  test('isDatasetSufficient passes at minimum thresholds', () => {
    expect(isDatasetSufficient(mockDataset())).toBe(true);
  });

  test('isDatasetSufficient fails when players below minimum', () => {
    const ds = mockDataset();
    ds.players = ds.players.slice(0, QUIZ_DATASET_MIN_PLAYERS - 1);
    expect(isDatasetSufficient(ds)).toBe(false);
  });

  test('selectDailyEntitySlice is deterministic for same packDate and language', () => {
    const ds = mockDataset();
    const a = selectDailyEntitySlice(ds, '2026-06-10', 'en', 0);
    const b = selectDailyEntitySlice(ds, '2026-06-10', 'en', 0);
    expect(a.players.map((p) => p.id)).toEqual(b.players.map((p) => p.id));
    expect(a.clubs.map((c) => c.id)).toEqual(b.clubs.map((c) => c.id));
  });

  test('selectDailyEntitySlice rotates on attempt offset', () => {
    const ds = mockDataset({
      players: Array.from({ length: 40 }, (_, i) => ({
        id: `player:${2000 + i}`,
        name: `Player ${i}`,
        apiPlayerId: 2000 + i,
        position: 'Attacker',
        teamId: 40,
        teamName: 'Liverpool',
      })),
    });
    const a = selectDailyEntitySlice(ds, '2026-06-10', 'en', 0);
    const b = selectDailyEntitySlice(ds, '2026-06-10', 'en', 1);
    expect(a.players.map((p) => p.id).join(',')).not.toEqual(b.players.map((p) => p.id).join(','));
  });
});
