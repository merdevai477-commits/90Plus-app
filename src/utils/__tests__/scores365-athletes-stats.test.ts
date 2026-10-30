import { normalizeAthletesStatsBoards } from '../scores365-athletes-stats';

describe('normalizeAthletesStatsBoards', () => {
  it('passes through a legacy array of boards', () => {
    const boards = [{ id: 1, name: 'Goals', rows: [] }];
    expect(normalizeAthletesStatsBoards(boards)).toBe(boards);
  });

  it('unwraps the current { tables, filters } envelope', () => {
    const tables = [
      { id: 7, name: 'Goals', rows: [{ position: 1, entity: { id: 65760, name: 'Haaland' } }] },
    ];
    expect(normalizeAthletesStatsBoards({ tables, filters: [{ id: 1 }] })).toEqual(tables);
  });

  it('returns [] for null, undefined, empty object, and non-objects', () => {
    expect(normalizeAthletesStatsBoards(null)).toEqual([]);
    expect(normalizeAthletesStatsBoards(undefined)).toEqual([]);
    expect(normalizeAthletesStatsBoards({})).toEqual([]);
    expect(normalizeAthletesStatsBoards('x')).toEqual([]);
  });
});
