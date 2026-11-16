import { fetchHighlightPage, HighlightlyRequestError, normalizePage } from '../highlightly.client';
import {
  allowanceAllows,
  nextUtcMidnightMs,
  readHighlightAllowance,
  resetHighlightQuotaForTests,
  utcDayKey,
} from '../highlightly.quota';
import {
  canSpendHighlightRequest,
  highlightDateKey,
  linkHighlightToFixture,
  pickGoals,
  pickSummary,
  planNextCheck,
  selectSyncDates,
  type HighlightFixtureCandidate,
  type StoredHighlightClip,
} from '../highlightly.policy';
import { getFixtureHighlights } from '../match-highlights.service';
import { runMatchHighlightsSync } from '../match-highlights-sync.service';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    cachedFixture: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    matchHighlight: {
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
    fixtureHighlightSync: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const mockPrisma = jest.requireMock('../../../lib/prisma').default as {
  cachedFixture: { findUnique: jest.Mock; findMany: jest.Mock };
  matchHighlight: { findMany: jest.Mock; upsert: jest.Mock };
  fixtureHighlightSync: { findUnique: jest.Mock; findMany: jest.Mock; upsert: jest.Mock };
};

jest.mock('../../football-sync-leader.service', () => ({
  withSyncLeaderLease: (
    _scope: string,
    work: (ctx: { signal: AbortSignal; isLost: () => boolean }) => Promise<unknown>,
  ) =>
    work({ signal: new AbortController().signal, isLost: () => false }).then((value) => ({
      acquired: true,
      value,
    })),
}));

const originalFetch = global.fetch;
const originalKey = process.env.HIGHLIGHTLY_API_KEY;
const kickoff = new Date('2026-11-16T16:00:00.000Z');

function fixture(overrides: Partial<HighlightFixtureCandidate> = {}): HighlightFixtureCandidate {
  return {
    fixtureId: 42,
    homeTeamName: 'Al Ahly',
    awayTeamName: 'Zamalek',
    matchDate: kickoff,
    ...overrides,
  };
}

function clip(overrides: Partial<StoredHighlightClip> = {}): StoredHighlightClip {
  return {
    highlightlyId: 1,
    category: 'match-highlights',
    type: 'VERIFIED',
    title: 'Recap',
    description: 'Match recap',
    url: 'https://example.com/recap',
    embedUrl: 'https://example.com/embed',
    imgUrl: 'https://example.com/thumb',
    source: 'youtube',
    ...overrides,
  };
}

describe('highlight linking', () => {
  it('links both team names inside the kickoff window, including a home/away swap', () => {
    const linked = linkHighlightToFixture(
      { homeTeamName: 'Al Ahly SC', awayTeamName: 'Zamalek', matchDate: kickoff },
      [fixture(), fixture({ fixtureId: 7, homeTeamName: 'National Bank of Egypt' })],
    );
    expect(linked).toMatchObject({ fixtureId: 42, ambiguous: false });

    const swapped = linkHighlightToFixture(
      { homeTeamName: 'Zamalek', awayTeamName: 'Al Ahly', matchDate: kickoff },
      [fixture()],
    );
    expect(swapped.fixtureId).toBe(42);
  });

  it('does not attach Al Ahly to a different club or to two possible matches', () => {
    const wrongClub = linkHighlightToFixture(
      { homeTeamName: 'Al Ahly', awayTeamName: 'Zamalek', matchDate: kickoff },
      [fixture({ fixtureId: 7, homeTeamName: 'National Bank of Egypt' })],
    );
    expect(wrongClub).toMatchObject({ fixtureId: null, ambiguous: false });

    const similar = linkHighlightToFixture(
      { homeTeamName: 'Al Ahly', awayTeamName: 'Zamalek', matchDate: kickoff },
      [fixture({ fixtureId: 8, homeTeamName: 'Al Ahly National Bank' })],
    );
    expect(similar.fixtureId).toBeNull();

    const ambiguous = linkHighlightToFixture(
      { homeTeamName: 'Al Ahly', awayTeamName: 'Zamalek', matchDate: kickoff },
      [fixture({ fixtureId: 1 }), fixture({ fixtureId: 2, matchDate: new Date(kickoff.getTime() + 60 * 60 * 1000) })],
    );
    expect(ambiguous).toMatchObject({ fixtureId: null, ambiguous: true });
  });

  it('rejects a kickoff more than six hours away', () => {
    const linked = linkHighlightToFixture(
      {
        homeTeamName: 'Al Ahly',
        awayTeamName: 'Zamalek',
        matchDate: new Date(kickoff.getTime() + 7 * 60 * 60 * 1000),
      },
      [fixture()],
    );
    expect(linked.fixtureId).toBeNull();
  });
});

describe('highlight selection', () => {
  it('prefers a verified summary with an embed and dedupes goal urls', () => {
    const clips = [
      clip({ highlightlyId: 2, type: 'UNVERIFIED', embedUrl: null, url: 'https://example.com/raw' }),
      clip({ highlightlyId: 3, title: 'Official recap' }),
      clip({
        highlightlyId: 4,
        category: 'goal-clip',
        title: 'Goal',
        url: 'https://example.com/goal',
        embedUrl: 'https://example.com/goal-embed',
      }),
      clip({
        highlightlyId: 5,
        category: 'goal-clip',
        title: 'Same goal',
        url: 'https://example.com/goal',
      }),
      clip({
        highlightlyId: 6,
        category: 'press-conference',
        url: 'https://example.com/press',
      }),
    ];

    expect(pickSummary(clips)).toMatchObject({
      title: 'Official recap',
      type: 'VERIFIED',
      embedUrl: 'https://example.com/embed',
      thumbnail: 'https://example.com/thumb',
    });
    expect(pickGoals(clips)).toEqual([
      expect.objectContaining({ title: 'Goal', url: 'https://example.com/goal' }),
    ]);
  });
});

describe('highlight schedule and quota', () => {
  it('backs off after a miss and stops after the post-match window', () => {
    const now = new Date(kickoff.getTime() + 2 * 60 * 60 * 1000);
    const firstMiss = planNextCheck({ foundSummary: false, matchDate: kickoff, attempts: 0, now });
    expect(firstMiss).toMatchObject({ status: 'pending', attempts: 1 });
    expect(firstMiss.nextCheckAt.getTime() - now.getTime()).toBe(30 * 60 * 1000);

    const found = planNextCheck({ foundSummary: true, matchDate: kickoff, attempts: 3, now });
    expect(found).toMatchObject({ status: 'ready', attempts: 3 });

    const expired = planNextCheck({
      foundSummary: false,
      matchDate: kickoff,
      attempts: 4,
      now: new Date(kickoff.getTime() + 50 * 60 * 60 * 1000 + 1),
    });
    expect(expired.status).toBe('unavailable');
  });

  it('spends a request only while budget, reserve, and pause allow it', () => {
    const nowMs = Date.parse('2026-11-16T12:00:00.000Z');
    expect(
      canSpendHighlightRequest({
        used: 79,
        budget: 80,
        upstreamRemaining: 20,
        reserve: 20,
        pausedUntilMs: null,
        nowMs,
      }),
    ).toBe(true);
    expect(
      canSpendHighlightRequest({
        used: 80,
        budget: 80,
        upstreamRemaining: 50,
        reserve: 20,
        pausedUntilMs: null,
        nowMs,
      }),
    ).toBe(false);
    expect(
      canSpendHighlightRequest({
        used: 1,
        budget: 80,
        upstreamRemaining: 19,
        reserve: 20,
        pausedUntilMs: null,
        nowMs,
      }),
    ).toBe(false);
    expect(
      canSpendHighlightRequest({
        used: 1,
        budget: 80,
        upstreamRemaining: 90,
        reserve: 20,
        pausedUntilMs: nowMs + 1000,
        nowMs,
      }),
    ).toBe(false);
  });

  it('ignores yesterday upstream remaining and pauses until the next UTC midnight', async () => {
    const now = new Date('2026-11-16T22:00:00.000Z');
    resetHighlightQuotaForTests({
      day: utcDayKey(now),
      used: 0,
      upstreamRemaining: 0,
      upstreamSampledAtMs: now.getTime() - 26 * 60 * 60 * 1000,
      pausedUntilMs: null,
    });
    const allowance = await readHighlightAllowance(now);
    expect(allowance.upstreamRemaining).toBeNull();
    expect(allowanceAllows(allowance, now)).toBe(true);
    expect(nextUtcMidnightMs(now)).toBe(Date.parse('2026-11-17T00:00:00.000Z'));
  });

  it('puts a priority date ahead of a busier day and keeps two dates', () => {
    const dates = selectSyncDates([
      { fixtureId: 1, matchDate: new Date('2026-11-14T16:00:00.000Z'), due: true, priority: false },
      { fixtureId: 2, matchDate: new Date('2026-11-15T16:00:00.000Z'), due: true, priority: false },
      { fixtureId: 3, matchDate: new Date('2026-11-15T18:00:00.000Z'), due: true, priority: false },
      { fixtureId: 4, matchDate: new Date('2026-11-16T16:00:00.000Z'), due: true, priority: true },
      { fixtureId: 5, matchDate: new Date('2026-11-15T16:00:00.000Z'), due: false, priority: false },
    ]);
    expect(dates).toEqual([
      highlightDateKey(new Date('2026-11-16T16:00:00.000Z')),
      highlightDateKey(new Date('2026-11-15T16:00:00.000Z')),
    ]);
  });
});

describe('Highlightly client', () => {
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('does not retry a 429 and keeps the key out of the url', async () => {
    process.env.HIGHLIGHTLY_API_KEY = 'test-key';
    const fetchMock = jest.fn().mockResolvedValue({
      ok: false,
      status: 429,
      headers: {
        get: (name: string) => (name === 'x-ratelimit-requests-remaining' ? '0' : null),
      },
    });
    global.fetch = fetchMock as typeof fetch;

    await expect(fetchHighlightPage({ date: '2026-11-16' })).rejects.toMatchObject({ status: 429 });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [URL, { headers: Record<string, string> }];
    expect(String(url).startsWith('https://soccer.highlightly.net/highlights?')).toBe(true);
    expect(String(url)).not.toContain('test-key');
    expect(init.headers['x-rapidapi-key']).toBe('test-key');
    expect(init.headers).not.toHaveProperty('x-rapidapi-host');
  });

  it('drops a clip that cannot be tied to two teams', () => {
    const page = normalizePage(
      {
        data: [
          { id: 1, url: 'https://example.com/a', category: 'goal-clip', match: { id: 9, date: kickoff.toISOString() } },
          {
            id: 2,
            url: 'https://example.com/b',
            category: 'Goal-Clip',
            type: 'verified',
            title: 'Goal',
            match: {
              id: 9,
              date: kickoff.toISOString(),
              homeTeam: { name: 'Al Ahly' },
              awayTeam: { name: 'Zamalek' },
            },
          },
        ],
        pagination: { totalCount: 2, offset: 0, limit: 40 },
        plan: { tier: 'BASIC' },
      },
      { offset: 0, limit: 40, upstreamLimit: 100, upstreamRemaining: 90 },
    );
    expect(page.clips).toHaveLength(1);
    expect(page.clips[0]).toMatchObject({ category: 'goal-clip', type: 'VERIFIED', highlightlyId: 2 });
    expect(page.tier).toBe('BASIC');
  });
});

describe('highlight sync and read path', () => {
  const savedBudget = process.env.HIGHLIGHTLY_DAILY_BUDGET;
  const savedReserve = process.env.HIGHLIGHTLY_QUOTA_RESERVE;

  beforeEach(() => {
    mockPrisma.cachedFixture.findUnique.mockReset();
    mockPrisma.cachedFixture.findMany.mockReset();
    mockPrisma.matchHighlight.findMany.mockReset();
    mockPrisma.matchHighlight.upsert.mockReset();
    mockPrisma.fixtureHighlightSync.findUnique.mockReset();
    mockPrisma.fixtureHighlightSync.findMany.mockReset();
    mockPrisma.fixtureHighlightSync.upsert.mockReset();
    resetHighlightQuotaForTests({ day: utcDayKey(new Date()), used: 0 });
    delete process.env.HIGHLIGHTLY_API_KEY;
    delete process.env.HIGHLIGHTLY_DAILY_BUDGET;
    delete process.env.HIGHLIGHTLY_QUOTA_RESERVE;
    global.fetch = originalFetch;
  });

  afterAll(() => {
    if (originalKey == null) delete process.env.HIGHLIGHTLY_API_KEY;
    else process.env.HIGHLIGHTLY_API_KEY = originalKey;
    if (savedBudget == null) delete process.env.HIGHLIGHTLY_DAILY_BUDGET;
    else process.env.HIGHLIGHTLY_DAILY_BUDGET = savedBudget;
    if (savedReserve == null) delete process.env.HIGHLIGHTLY_QUOTA_RESERVE;
    else process.env.HIGHLIGHTLY_QUOTA_RESERVE = savedReserve;
    global.fetch = originalFetch;
  });

  it('does not call Highlightly when the daily budget is spent', async () => {
    process.env.HIGHLIGHTLY_API_KEY = 'test-key';
    process.env.HIGHLIGHTLY_DAILY_BUDGET = '80';
    resetHighlightQuotaForTests({ day: utcDayKey(new Date()), used: 80 });
    const fetchPage = jest.fn();

    const outcome = await runMatchHighlightsSync({ fetchPage, now: new Date() });

    expect(outcome.skipped).toBe('quota');
    expect(fetchPage).not.toHaveBeenCalled();
    expect(mockPrisma.cachedFixture.findMany).not.toHaveBeenCalled();
  });

  it('pauses until the quota resets after a 401 and does not call again', async () => {
    const now = new Date('2026-11-16T12:00:00.000Z');
    process.env.HIGHLIGHTLY_API_KEY = 'test-key';
    resetHighlightQuotaForTests({ day: utcDayKey(now), used: 0, lastTickMs: null });
    mockPrisma.cachedFixture.findMany.mockResolvedValue([
      { fixtureId: 42, homeTeamName: 'Al Ahly', awayTeamName: 'Zamalek', leagueName: 'Egyptian Premier League', leagueCountry: 'Egypt', matchDate: kickoff },
    ]);
    mockPrisma.fixtureHighlightSync.findMany.mockResolvedValue([]);
    const fetchPage = jest.fn().mockRejectedValue(new HighlightlyRequestError(401));

    await runMatchHighlightsSync({ fetchPage, now });
    const later = await runMatchHighlightsSync({
      fetchPage: jest.fn(),
      now: new Date(now.getTime() + 31 * 60 * 1000),
    });

    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(later.skipped).toBe('quota');
  });

  it('stores a linked summary and stops checking that fixture', async () => {
    process.env.HIGHLIGHTLY_API_KEY = 'test-key';
    const highlights = new Map<number, { fixtureId: number | null; category: string }>();
    const syncRows = new Map<number, { status: string; attempts: number }>();
    mockPrisma.cachedFixture.findMany.mockResolvedValue([
      { fixtureId: 42, homeTeamName: 'Barcelona', awayTeamName: 'Real Madrid', leagueName: 'La Liga', leagueCountry: 'Spain', matchDate: kickoff },
    ]);
    mockPrisma.fixtureHighlightSync.findMany.mockResolvedValue([]);
    mockPrisma.matchHighlight.findMany.mockResolvedValue([]);
    mockPrisma.matchHighlight.upsert.mockImplementation(async ({ where, create, update }) => {
      const existing = highlights.get(where.highlightlyId);
      if (!existing) highlights.set(where.highlightlyId, { ...create });
      else Object.assign(existing, update);
      return highlights.get(where.highlightlyId);
    });
    mockPrisma.fixtureHighlightSync.upsert.mockImplementation(async ({ where, create, update }) => {
      const existing = syncRows.get(where.fixtureId);
      if (!existing) syncRows.set(where.fixtureId, { ...create });
      else Object.assign(existing, update);
      return syncRows.get(where.fixtureId);
    });
    const fetchPage = jest.fn().mockResolvedValue({
      clips: [
        {
          highlightlyId: 9,
          highlightlyMatchId: 100,
          category: 'match-highlights',
          type: 'VERIFIED',
          title: 'Barcelona vs Real Madrid',
          description: 'Recap',
          url: 'https://example.com/summary',
          embedUrl: 'https://example.com/embed',
          imgUrl: null,
          source: 'youtube',
          channel: null,
          homeTeamName: 'Barcelona',
          awayTeamName: 'Real Madrid',
          leagueName: 'La Liga',
          matchDate: kickoff,
        },
      ],
      totalCount: 1,
      offset: 0,
      limit: 40,
      tier: 'BASIC',
      upstreamLimit: 100,
      upstreamRemaining: 90,
    });

    const outcome = await runMatchHighlightsSync({ fetchPage, now: new Date('2026-11-16T20:00:00.000Z') });

    expect(outcome.skipped).toBeNull();
    expect(outcome.requests).toBe(1);
    expect(fetchPage).toHaveBeenCalledTimes(1);
    expect(highlights.get(9)?.fixtureId).toBe(42);
    expect(syncRows.get(42)).toMatchObject({ status: 'ready', attempts: 0 });
  });

  it('serves stored clips without calling the network', async () => {
    const fetchMock = jest.fn(() => {
      throw new Error('network');
    });
    global.fetch = fetchMock as typeof fetch;
    const checkedAt = new Date('2026-11-16T21:00:00.000Z');
    mockPrisma.cachedFixture.findUnique.mockResolvedValue({ status: 'FT', matchDate: kickoff });
    mockPrisma.fixtureHighlightSync.findUnique.mockResolvedValue({
      fixtureId: 42,
      status: 'ready',
      attempts: 1,
      nextCheckAt: new Date('2027-11-16T00:00:00.000Z'),
      priority: false,
      lastCheckedAt: checkedAt,
    });
    mockPrisma.matchHighlight.findMany.mockResolvedValue([
      clip({ highlightlyId: 3, title: 'Official recap' }),
      clip({
        highlightlyId: 4,
        category: 'goal-clip',
        title: 'Goal',
        url: 'https://example.com/goal',
        embedUrl: 'https://example.com/goal-embed',
      }),
      clip({
        highlightlyId: 5,
        category: 'goal-clip',
        title: 'Same goal',
        url: 'https://example.com/goal',
      }),
    ]);

    const result = await getFixtureHighlights(42, new Date('2026-11-16T22:00:00.000Z'));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(mockPrisma.fixtureHighlightSync.upsert).not.toHaveBeenCalled();
    expect(result.status).toBe('ready');
    expect(result.checkedAt).toBe(checkedAt.toISOString());
    expect(result.summary).toMatchObject({ title: 'Official recap', thumbnail: 'https://example.com/thumb' });
    expect(result.goals).toHaveLength(1);
  });

  it('marks an overdue finished match as priority without calling the network', async () => {
    const fetchMock = jest.fn();
    global.fetch = fetchMock as typeof fetch;
    const now = new Date('2026-11-16T22:00:00.000Z');
    mockPrisma.cachedFixture.findUnique.mockResolvedValue({
      status: 'FT',
      matchDate: kickoff,
      leagueName: 'La Liga',
      leagueCountry: 'Spain',
      homeTeamName: 'Barcelona',
      awayTeamName: 'Real Madrid',
    });
    mockPrisma.matchHighlight.findMany.mockResolvedValue([]);
    mockPrisma.fixtureHighlightSync.findUnique.mockResolvedValue({
      fixtureId: 42,
      status: 'pending',
      attempts: 1,
      nextCheckAt: new Date(now.getTime() - 60 * 1000),
      priority: false,
      lastCheckedAt: null,
    });

    const result = await getFixtureHighlights(42, now);

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result).toMatchObject({ status: 'pending', summary: null, goals: [] });
    expect(mockPrisma.fixtureHighlightSync.upsert).toHaveBeenCalledWith(
      expect.objectContaining({ update: { priority: true } }),
    );
  });

  it('fetches a second page only while a due match is still uncovered', async () => {
    process.env.HIGHLIGHTLY_API_KEY = 'test-key';
    const now = new Date('2026-11-16T20:00:00.000Z');
    resetHighlightQuotaForTests({ day: utcDayKey(now), used: 0, lastTickMs: null });
    mockPrisma.cachedFixture.findMany.mockResolvedValue([
      { fixtureId: 1, homeTeamName: 'Barcelona', awayTeamName: 'Real Madrid', leagueName: 'La Liga', leagueCountry: 'Spain', matchDate: kickoff },
      { fixtureId: 2, homeTeamName: 'Sevilla', awayTeamName: 'Betis', leagueName: 'La Liga', leagueCountry: 'Spain', matchDate: kickoff },
    ]);
    mockPrisma.fixtureHighlightSync.findMany.mockResolvedValue([]);
    mockPrisma.matchHighlight.findMany.mockResolvedValue([]);
    mockPrisma.matchHighlight.upsert.mockResolvedValue({});
    mockPrisma.fixtureHighlightSync.upsert.mockResolvedValue({});
    const summary = (id: number, home: string, away: string) => ({
      highlightlyId: id,
      highlightlyMatchId: id,
      category: 'match-highlights',
      type: 'VERIFIED',
      title: `${home} vs ${away}`,
      description: null,
      url: `https://example.com/${id}`,
      embedUrl: null,
      imgUrl: null,
      source: 'youtube',
      channel: null,
      homeTeamName: home,
      awayTeamName: away,
      leagueName: 'La Liga',
      matchDate: kickoff,
    });
    const fetchPage = jest
      .fn()
      .mockResolvedValueOnce({
        clips: [summary(1, 'Barcelona', 'Real Madrid')],
        totalCount: 80,
        offset: 0,
        limit: 40,
        tier: 'BASIC',
        upstreamLimit: 100,
        upstreamRemaining: 90,
      })
      .mockResolvedValueOnce({
        clips: [summary(2, 'Sevilla', 'Betis')],
        totalCount: 80,
        offset: 40,
        limit: 40,
        tier: 'BASIC',
        upstreamLimit: 100,
        upstreamRemaining: 89,
      });

    const outcome = await runMatchHighlightsSync({ fetchPage, now });

    expect(outcome.requests).toBe(2);
    expect(fetchPage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        date: highlightDateKey(kickoff),
        homeTeamName: 'Sevilla',
        awayTeamName: 'Betis',
      }),
    );
  });

  it('does not write a sync row when an old match has nothing stored', async () => {
    mockPrisma.cachedFixture.findUnique.mockResolvedValue({
      status: 'FT',
      matchDate: new Date('2026-11-10T16:00:00.000Z'),
    });
    mockPrisma.matchHighlight.findMany.mockResolvedValue([]);
    mockPrisma.fixtureHighlightSync.findUnique.mockResolvedValue(null);

    const result = await getFixtureHighlights(42, new Date('2026-11-16T22:00:00.000Z'));

    expect(result.status).toBe('unavailable');
    expect(mockPrisma.fixtureHighlightSync.upsert).not.toHaveBeenCalled();
  });

  it('returns not_finished and does not queue a match that is still live', async () => {
    mockPrisma.cachedFixture.findUnique.mockResolvedValue({ status: '2H', matchDate: kickoff });

    const result = await getFixtureHighlights(42, new Date());

    expect(result.status).toBe('not_finished');
    expect(mockPrisma.matchHighlight.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.fixtureHighlightSync.upsert).not.toHaveBeenCalled();
  });
});
