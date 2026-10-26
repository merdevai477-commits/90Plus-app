import {
  CK_START_BALANCE_MILLI,
  COACH_KING_SLOTS,
  coachKingMatchResult,
  coachKingNextBalanceMilli,
  coachKingRemainingMilli,
  coachKingResultPoints,
  computeCoachKingPoints,
  extractCoachKingStats,
  formatCoachKingMoney,
  inspectCoachKingSquad,
  type CkDraftSlot,
} from '../coach-king-scoring';

function fullSquad(price = 40): CkDraftSlot[] {
  return COACH_KING_SLOTS.map((slot, index) => ({
    slotKey: slot.key,
    playerId: `p${index}`,
    line: slot.line,
    teamId: index + 1,
    priceMilli: price,
  }));
}

describe('coach king budget', () => {
  it('formats tenths of a million and grows the bank by 0.1M per point', () => {
    expect(formatCoachKingMoney(275)).toBe('27.5M');
    expect(formatCoachKingMoney(CK_START_BALANCE_MILLI)).toBe('100M');
    expect(coachKingRemainingMilli(1000, 725)).toBe(275);
    expect(coachKingNextBalanceMilli(1000, 30)).toBe(1030);
  });

  it('rejects an unfinished squad, a duplicate, the wrong line, a short budget, and a started club', () => {
    const slots = fullSquad(90);
    expect(inspectCoachKingSquad({
      slots,
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set(),
      requireComplete: true,
    })).toMatchObject({ code: 'BUDGET' });

    const affordable = fullSquad(40);
    const ok = inspectCoachKingSquad({
      slots: affordable,
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set(),
      requireComplete: true,
    });
    expect(ok).toEqual({ ok: true, spentMilli: 40 * 11 + 30 });

    expect(inspectCoachKingSquad({
      slots: affordable.slice(0, 10),
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set(),
      requireComplete: true,
    })).toMatchObject({ code: 'INCOMPLETE' });

    const dup = fullSquad(40).map((slot, index) => ({ ...slot, playerId: index === 1 ? 'p0' : slot.playerId }));
    expect(inspectCoachKingSquad({
      slots: dup,
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set(),
      requireComplete: true,
    })).toMatchObject({ code: 'DUPLICATE_PLAYER' });

    const wrong = fullSquad(40).map((slot) => (slot.slotKey === 'gk' ? { ...slot, line: 'FWD' as const } : slot));
    expect(inspectCoachKingSquad({
      slots: wrong,
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set(),
      requireComplete: true,
    })).toMatchObject({ code: 'WRONG_LINE' });

    expect(inspectCoachKingSquad({
      slots: affordable,
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set([1]),
      requireComplete: true,
    })).toMatchObject({ code: 'MATCH_STARTED' });

    const oneClub = fullSquad(40).map((slot, index) => ({ ...slot, teamId: index < 4 ? 7 : slot.teamId }));
    expect(inspectCoachKingSquad({
      slots: oneClub,
      coachPriceMilli: 30,
      coachTeamId: 9,
      balanceMilli: 1000,
      startedTeamIds: new Set(),
      requireComplete: true,
    })).toMatchObject({ code: 'CLUB_LIMIT' });
  });
});

describe('coach king points', () => {
  it('scores appearance, minutes, goals by line, assists, clean sheets, and cards', () => {
    expect(computeCoachKingPoints('FWD', {
      minutes: 90, goals: 1, assists: 1, yellows: 1, reds: 0, ownGoals: 0, teamConceded: 1,
    })).toEqual({ points: 2 + 4 + 3 - 1, cleanSheet: false });

    expect(computeCoachKingPoints('MID', {
      minutes: 60, goals: 1, assists: 0, yellows: 0, reds: 0, ownGoals: 0, teamConceded: 0,
    }).points).toBe(2 + 5);

    expect(computeCoachKingPoints('DEF', {
      minutes: 90, goals: 1, assists: 0, yellows: 0, reds: 0, ownGoals: 0, teamConceded: 0,
    })).toEqual({ points: 2 + 6 + 4, cleanSheet: true });

    expect(computeCoachKingPoints('GK', {
      minutes: 59, goals: 0, assists: 0, yellows: 0, reds: 1, ownGoals: 1, teamConceded: 0,
    })).toEqual({ points: 1 - 3 - 2, cleanSheet: false });

    expect(computeCoachKingPoints('DEF', {
      minutes: 0, goals: 0, assists: 0, yellows: 0, reds: 0, ownGoals: 0, teamConceded: 0,
    }).points).toBe(0);
  });

  it('gives the coach 3 for a win and 1 for a draw', () => {
    expect(coachKingResultPoints(coachKingMatchResult(2, 1))).toBe(3);
    expect(coachKingResultPoints(coachKingMatchResult(1, 1))).toBe(1);
    expect(coachKingResultPoints(coachKingMatchResult(0, 2))).toBe(0);
  });

  it('reads goals, cards, own goals, and a 90-minute starter fallback from a 365 game', () => {
    const stats = extractCoachKingStats({
      members: [
        { id: 10, athleteId: 100 },
        { id: 11, athleteId: 200 },
      ],
      homeCompetitor: {
        id: 1,
        score: 1,
        lineups: { members: [{ id: 10, status: 1 }, { id: 11, status: 0 }] },
      },
      awayCompetitor: { id: 2, score: 0, lineups: { members: [] } },
      events: [
        { playerId: 10, extraPlayers: [11], eventType: { id: 1, subTypeName: 'Normal Goal' } },
        { playerId: 11, eventType: { id: 1, subTypeName: 'Own Goal' } },
        { playerId: 10, eventType: { id: 2, subTypeName: 'Yellow' } },
      ],
    });

    expect(stats.get(100)).toMatchObject({ minutes: 90, goals: 1, assists: 0, yellows: 1, ownGoals: 0, teamConceded: 0 });
    expect(stats.get(200)).toMatchObject({ minutes: 90, goals: 0, ownGoals: 1, assists: 1, teamConceded: 0 });
  });
});
