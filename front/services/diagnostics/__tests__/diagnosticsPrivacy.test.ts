import { fixtureSignature, sanitizeDiagData, shouldSampleFixture } from '../diagnosticsPrivacy';

describe('sanitizeDiagData', () => {
  it('keeps contract-shaped values and drops objects, free text and URLs', () => {
    const out = sanitizeDiagData({
      source: 'ws',
      latencyMs: 120.5,
      ok: true,
      missingStages: ['store', 'commit'],
      dropped: { low: 2, normal: 0 },
      fixture: { teams: { home: { name: 'Al Ahly' } } },
      note: 'user wrote: هدف!!',
      url: 'https://api.example.com/fixtures?token=abc',
      bareUrl: 'https://api.example.com/fixtures',
      host: 'www.example.com',
      email: 'someone@example.com',
      fn: () => 1,
      bad: Infinity,
    });
    expect(out).toEqual({
      source: 'ws',
      latencyMs: 120.5,
      ok: true,
      missingStages: ['store', 'commit'],
      dropped: { low: 2, normal: 0 },
    });
  });

  it('caps arrays, strings and record sizes', () => {
    const record: Record<string, number> = {};
    for (let i = 0; i < 100; i += 1) record[`k${i}`] = i;
    const out = sanitizeDiagData({
      arr: new Array(20).fill('a'),
      long: 'x'.repeat(200),
      record,
    });
    expect(out.arr).toHaveLength(8);
    expect(out).not.toHaveProperty('long');
    expect(Object.keys(out.record as object)).toHaveLength(64);
  });

  it('drops unsafe keys', () => {
    expect(sanitizeDiagData({ 'bad key!': 1, ok: 2 })).toEqual({ ok: 2 });
    expect(sanitizeDiagData(undefined)).toEqual({});
  });
});

describe('fixtureSignature', () => {
  it('contains only status, minute, extra time and score', () => {
    expect(fixtureSignature({ status: '2H', elapsed: 67, extra: null, home: 1, away: 0 })).toBe('2H|67|null|1-0');
    expect(fixtureSignature({})).toBe('NA|null|null|null-null');
    expect(fixtureSignature({ status: 'F T<script>', elapsed: 90.7, extra: 4, home: 2, away: 2 })).toBe(
      'FTscript|90|4|2-2',
    );
  });
});

describe('shouldSampleFixture', () => {
  it('is deterministic per session and honours the rate', () => {
    const ids = Array.from({ length: 2000 }, (_, i) => 1_000_000 + i);
    const first = ids.map((id) => shouldSampleFixture(id, 0.25, 'session-a'));
    expect(ids.map((id) => shouldSampleFixture(id, 0.25, 'session-a'))).toEqual(first);
    const share = first.filter(Boolean).length / ids.length;
    expect(share).toBeGreaterThan(0.2);
    expect(share).toBeLessThan(0.3);
    expect(shouldSampleFixture(1, 1, 's')).toBe(true);
    expect(shouldSampleFixture(1, 0, 's')).toBe(false);
  });
});
