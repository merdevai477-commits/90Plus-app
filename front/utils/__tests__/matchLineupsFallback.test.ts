import {
  isAuthoritativeLineupData,
  shouldShowLineupsTab,
} from '../matchLineupsFallback';
import type { Lineup } from '../../services/apiFootball';

function xi(count: number, extra: Partial<Lineup> = {}): Lineup {
  return {
    team: { id: 1, name: 'Home', logo: '' },
    formation: extra.formation ?? '',
    startXI: Array.from({ length: count }, (_, i) => ({
      player: { id: i + 1, name: `P${i}`, number: i + 1, pos: 'M', grid: null },
    })),
    substitutes: [],
    ...extra,
  };
}

describe('shouldShowLineupsTab', () => {
  it('hides the tab when neither 365 nor API-Football published an XI', () => {
    expect(shouldShowLineupsTab(undefined)).toBe(false);
    expect(shouldShowLineupsTab([])).toBe(false);
    expect(shouldShowLineupsTab([xi(2)])).toBe(false);
  });

  it('shows the tab for a 365 or full API lineup', () => {
    expect(shouldShowLineupsTab([{ ...xi(11), _source: 'scores365-experiment' } as Lineup])).toBe(
      true,
    );
    expect(shouldShowLineupsTab([xi(11, { formation: '4-3-3' })])).toBe(true);
    expect(shouldShowLineupsTab([xi(11)])).toBe(true);
  });

  it('matches the authoritative lineup check', () => {
    const empty: Lineup[] = [];
    const full = [xi(11, { formation: '4-4-2' })];
    expect(shouldShowLineupsTab(empty)).toBe(isAuthoritativeLineupData(empty));
    expect(shouldShowLineupsTab(full)).toBe(isAuthoritativeLineupData(full));
  });
});
