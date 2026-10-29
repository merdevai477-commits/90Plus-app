/**
 * King server-side rules: Cairo day (C1), lock verdict (B1, B4, B5, Q6), canonical id (A12).
 */

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: {} }));

import {
  cairoDayKey,
  cairoDayRange,
  canonicalFixtureKey,
  lockVerdict,
  type ServerFixture,
} from '../king-prediction-rules';

const now = new Date('2026-10-30T12:00:00Z');
const fx = (over: Partial<ServerFixture> = {}): ServerFixture => ({
  kickoff: new Date('2026-10-30T18:00:00Z'),
  status: 'NS',
  canonicalKey: '365:4800001',
  ...over,
});

describe('cairoDayKey / cairoDayRange (C1)', () => {
  it('limit resets at Cairo midnight not server midnight', () => {
    // 22:30Z on Oct 23 is 01:30 Oct 24 in Cairo (UTC+3 before the DST change).
    expect(cairoDayKey(new Date('2026-10-23T22:30:00Z'))).toBe('2026-10-24');
    expect(cairoDayKey(new Date('2026-10-23T20:59:59Z'))).toBe('2026-10-23');
  });

  it('day range is [00:00, next 00:00) Cairo and survives the DST change', () => {
    const before = cairoDayRange('2026-10-24');
    expect(before.start.toISOString()).toBe('2026-10-23T21:00:00.000Z');
    expect(before.end.toISOString()).toBe('2026-10-24T21:00:00.000Z');
    const after = cairoDayRange('2026-11-01');
    expect(after.start.toISOString()).toBe('2026-10-31T22:00:00.000Z');
    expect(after.end.toISOString()).toBe('2026-11-01T22:00:00.000Z');
  });

  it('month boundary', () => {
    expect(cairoDayRange('2026-10-31').end.toISOString()).toBe('2026-10-31T22:00:00.000Z');
  });
});

describe('lockVerdict', () => {
  it('open before kickoff for a scheduled fixture', () => {
    expect(lockVerdict(fx(), { isNew: true }, now)).toBe('OPEN');
  });

  it('rejects create after server kickoff even if client matchDate empty (B1)', () => {
    expect(lockVerdict(fx({ kickoff: new Date('2026-10-30T11:00:00Z') }), { isNew: true }, now)).toBe(
      'MATCH_STARTED',
    );
  });

  it('rejects update after kickoff, incl. mode switch (B4, Q4, Q6)', () => {
    expect(lockVerdict(fx({ kickoff: now }), { isNew: false }, now)).toBe('MATCH_STARTED');
  });

  it('unknown or finished apiMatchId returns not eligible for new rows (B5)', () => {
    expect(lockVerdict(null, { isNew: true }, now)).toBe('MATCH_NOT_ELIGIBLE');
    expect(lockVerdict(fx({ status: 'FT' }), { isNew: true }, now)).toBe('MATCH_NOT_ELIGIBLE');
    expect(lockVerdict(fx({ status: 'PST' }), { isNew: true }, now)).toBe('MATCH_NOT_ELIGIBLE');
  });

  it('existing row on a non-open fixture is locked, missing kickoff is unknown', () => {
    expect(lockVerdict(fx({ status: 'LIVE' }), { isNew: false }, now)).toBe('MATCH_STARTED');
    expect(lockVerdict(fx({ kickoff: null }), { isNew: false }, now)).toBe('KICKOFF_UNKNOWN');
    expect(lockVerdict(null, { isNew: false }, now)).toBe('KICKOFF_UNKNOWN');
  });
});

describe('canonicalFixtureKey (A12)', () => {
  it('native 365 id and its API-Football twin map to the same key', () => {
    expect(canonicalFixtureKey(4800001)).toBe('365:4800001');
    expect(canonicalFixtureKey(1234567, { _scores365GameId: 4800001 })).toBe('365:4800001');
  });

  it('unmapped API-Football id keeps its own key', () => {
    expect(canonicalFixtureKey(1234567, {})).toBe('af:1234567');
  });
});
