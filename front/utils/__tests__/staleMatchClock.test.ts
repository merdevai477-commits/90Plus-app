import { isStaleInPlayClock } from '../staleMatchClock';

describe('isStaleInPlayClock', () => {
  it('treats 90+15 second half as finished', () => {
    expect(
      isStaleInPlayClock({ statusShort: '2H', elapsed: 90, extra: 15 }),
    ).toBe(true);
  });

  it('keeps a normal 90+4 second half live', () => {
    expect(
      isStaleInPlayClock({ statusShort: '2H', elapsed: 90, extra: 4 }),
    ).toBe(false);
  });

  it('treats elapsed 105 as finished', () => {
    expect(isStaleInPlayClock({ statusShort: '2H', elapsed: 105 })).toBe(true);
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

  it('treats a 2H clock 125 minutes after kickoff as finished when already at 90+', () => {
    const kickoffIso = new Date(Date.now() - 130 * 60 * 1000).toISOString();
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
