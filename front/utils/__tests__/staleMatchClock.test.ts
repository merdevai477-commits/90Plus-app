import { isStaleInPlayClock } from '../staleMatchClock';

describe('isStaleInPlayClock', () => {
  it('treats 90+20 second half as finished', () => {
    expect(
      isStaleInPlayClock({ statusShort: '2H', elapsed: 90, extra: 20 }),
    ).toBe(true);
  });

  it('keeps long real stoppage (90+4, 90+15) live', () => {
    expect(isStaleInPlayClock({ statusShort: '2H', elapsed: 90, extra: 4 })).toBe(false);
    expect(isStaleInPlayClock({ statusShort: '2H', elapsed: 90, extra: 15 })).toBe(false);
    expect(isStaleInPlayClock({ statusShort: '2H', elapsed: 105 })).toBe(false);
  });

  it('treats elapsed 110 as finished', () => {
    expect(isStaleInPlayClock({ statusShort: '2H', elapsed: 110 })).toBe(true);
  });

  it('keeps a long first-half stoppage live', () => {
    expect(isStaleInPlayClock({ statusShort: '1H', elapsed: 45, extra: 12 })).toBe(false);
    expect(isStaleInPlayClock({ statusShort: '1H', elapsed: 58 })).toBe(false);
    expect(isStaleInPlayClock({ statusShort: '1H', elapsed: 66 })).toBe(true);
  });

  it('does not finish a delayed 1H kickoff just because the listed start is old', () => {
    const kickoffIso = new Date(Date.now() - 80 * 60 * 1000).toISOString();
    expect(
      isStaleInPlayClock({
        statusShort: '1H',
        elapsed: 12,
        kickoffIso,
      }),
    ).toBe(false);
  });

  it('keeps 90+8 live 135 minutes after a delayed kickoff', () => {
    const kickoffIso = new Date(Date.now() - 135 * 60 * 1000).toISOString();
    expect(
      isStaleInPlayClock({ statusShort: '2H', elapsed: 90, extra: 8, kickoffIso }),
    ).toBe(false);
  });

  it('treats a 2H clock 170 minutes after kickoff as finished when already at 90+', () => {
    const kickoffIso = new Date(Date.now() - 175 * 60 * 1000).toISOString();
    expect(
      isStaleInPlayClock({
        statusShort: '2H',
        elapsed: 90,
        extra: 4,
        kickoffIso,
      }),
    ).toBe(true);
  });
});
