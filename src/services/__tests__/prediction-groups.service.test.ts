import { buildGroupSummary, startOfDayUtc, startOfWeekUtc, type GroupMemberStatsSeed } from '../prediction-groups.service';

describe('prediction-groups.service', () => {
  it('computes leaderboard order and user insight gap', () => {
    const seeds: GroupMemberStatsSeed[] = [
      {
        userId: 'u1',
        username: 'mohamed',
        displayName: 'Mohamed',
        avatar: null,
        totalCorrect: 5,
        totalResolved: 10,
        weeklyCorrect: 3,
        weeklyResolved: 4,
        todayCorrect: 1,
      },
      {
        userId: 'u2',
        username: 'ahmed',
        displayName: 'Ahmed',
        avatar: null,
        totalCorrect: 4,
        totalResolved: 8,
        weeklyCorrect: 1,
        weeklyResolved: 2,
        todayCorrect: 0,
      },
      {
        userId: 'u3',
        username: 'ali',
        displayName: 'Ali',
        avatar: null,
        totalCorrect: 3,
        totalResolved: 7,
        weeklyCorrect: 2,
        weeklyResolved: 3,
        todayCorrect: 2,
      },
    ];

    const summary = buildGroupSummary(seeds, 'u2');

    expect(summary.leaderboard[0]?.username).toBe('mohamed');
    expect(summary.leaderboard[1]?.username).toBe('ahmed');
    expect(summary.userInsight.rank).toBe(2);
    expect(summary.userInsight.nextRank).toBe(1);
    expect(summary.userInsight.pointsToNextRank).toBe(10);
  });

  it('computes weekly tabs and today winner independently from overall', () => {
    const seeds: GroupMemberStatsSeed[] = [
      {
        userId: 'u1',
        username: 'first',
        displayName: null,
        avatar: null,
        totalCorrect: 8,
        totalResolved: 10,
        weeklyCorrect: 1,
        weeklyResolved: 2,
        todayCorrect: 0,
      },
      {
        userId: 'u2',
        username: 'second',
        displayName: null,
        avatar: null,
        totalCorrect: 6,
        totalResolved: 8,
        weeklyCorrect: 4,
        weeklyResolved: 5,
        todayCorrect: 3,
      },
    ];

    const summary = buildGroupSummary(seeds, 'u1');

    expect(summary.tabs.weekly[0]?.username).toBe('second');
    expect(summary.tabs.bestPrecisePrediction?.username).toBe('second');
    expect(summary.tabs.topPointsToday?.username).toBe('second');
  });

  it('returns monday as start of week in UTC', () => {
    const sunday = new Date('2026-07-05T12:00:00.000Z');
    const weekStart = startOfWeekUtc(sunday);

    expect(weekStart.toISOString()).toBe('2026-06-29T00:00:00.000Z');
  });

  it('returns midnight as start of day in UTC', () => {
    const date = new Date('2026-07-01T18:22:30.000Z');
    const dayStart = startOfDayUtc(date);

    expect(dayStart.toISOString()).toBe('2026-07-01T00:00:00.000Z');
  });
});
