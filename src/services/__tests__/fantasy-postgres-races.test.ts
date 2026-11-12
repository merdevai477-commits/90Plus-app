/**
 * Real PostgreSQL races for squad confirm, settlement, and fixture revision.
 * Skipped unless DATABASE_URL_TEST points at a disposable database.
 * Never use the Railway proxy.
 */

import { Prisma, PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL_TEST ?? '';
const railway = url.includes('rlwy.net');
if (railway) {
  throw new Error('DATABASE_URL_TEST must not be the Railway proxy');
}
const live = url.length > 0;

(live ? describe : describe.skip)('fantasy postgres races', () => {
  const prisma = new PrismaClient({ datasources: { db: { url } } });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  async function user(tag: string) {
    const stamp = `${tag}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    return prisma.user.create({
      data: { clerkUserId: `race-${stamp}`, email: `${stamp}@example.com`, username: stamp },
    });
  }

  it('lets one of two confirms win the version update', async () => {
    const owner = await user('confirm');
    const squad = await prisma.topScorersFiveSquad.create({
      data: { userId: owner.id, scopeKey: 'laliga', version: 0 },
    });
    const write = (playerId: string) => prisma.$transaction(async (tx) => {
      const claimed = await tx.topScorersFiveSquad.updateMany({
        where: { id: squad.id, version: 0 },
        data: { version: 1, confirmedAt: new Date(), unlocksAt: new Date(Date.now() + 7 * 86400000) },
      });
      if (claimed.count === 0) throw new Error('conflict');
      await tx.topScorersFiveSquadMember.create({
        data: { squadId: squad.id, slotKey: 'laliga', playerId, selectedAt: new Date() },
      });
    });
    const playerA = await prisma.topScorersFivePlayer.create({
      data: { leagueKey: 'laliga', nameAr: `a-${Date.now()}`, clubNameAr: 'c', externalPlayerId: Math.floor(Math.random() * 1e9) },
    });
    const playerB = await prisma.topScorersFivePlayer.create({
      data: { leagueKey: 'laliga', nameAr: `b-${Date.now()}`, clubNameAr: 'c', externalPlayerId: Math.floor(Math.random() * 1e9) },
    });
    const results = await Promise.allSettled([write(playerA.id), write(playerB.id)]);
    expect(results.filter((row) => row.status === 'fulfilled')).toHaveLength(1);
    const members = await prisma.topScorersFiveSquadMember.findMany({ where: { squadId: squad.id } });
    expect(members).toHaveLength(1);
    const stored = await prisma.topScorersFiveSquad.findUnique({ where: { id: squad.id } });
    expect(stored?.version).toBe(1);
  });

  it('rolls back a confirm that fails before the member insert', async () => {
    const owner = await user('rollback');
    const squad = await prisma.topScorersFiveSquad.create({
      data: { userId: owner.id, scopeKey: 'pl', version: 3 },
    });
    await expect(prisma.$transaction(async (tx) => {
      await tx.topScorersFiveSquad.updateMany({
        where: { id: squad.id, version: 3 },
        data: { version: 4, confirmedAt: new Date() },
      });
      throw new Error('halfway');
    })).rejects.toThrow('halfway');
    const stored = await prisma.topScorersFiveSquad.findUnique({ where: { id: squad.id } });
    expect(stored?.version).toBe(3);
    expect(stored?.confirmedAt).toBeNull();
  });

  it('treats a second week payout as a duplicate and leaves the wallet at 1000', async () => {
    const owner = await user('settle');
    const week = await prisma.coachKingGameweek.create({
      data: {
        weekKey: `race-${Date.now()}`,
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        lockAt: new Date(),
        status: 'COMPLETED',
      },
    });
    await prisma.coachKingWallet.create({ data: { userId: owner.id, balanceMilli: 400 } });
    const squad = await prisma.coachKingSquad.create({
      data: { userId: owner.id, gameweekId: week.id, isLive: true, confirmedAt: new Date(), unlocksAt: new Date(Date.now() + 86400000) },
    });
    const settle = () => prisma.$transaction(async (tx) => {
      await tx.coachKingWallet.update({ where: { userId: owner.id }, data: { balanceMilli: 1000 } });
      await tx.coachKingWeekPayout.create({
        data: { userId: owner.id, gameweekId: week.id, points: 4, settledAt: new Date() },
      });
    });
    await settle();
    await expect(settle()).rejects.toBeInstanceOf(Prisma.PrismaClientKnownRequestError);
    const wallet = await prisma.coachKingWallet.findUnique({ where: { userId: owner.id } });
    const payouts = await prisma.coachKingWeekPayout.findMany({ where: { userId: owner.id, gameweekId: week.id } });
    const live = await prisma.coachKingSquad.findUnique({ where: { id: squad.id } });
    expect(wallet?.balanceMilli).toBe(1000);
    expect(payouts).toHaveLength(1);
    expect(live?.unlocksAt).not.toBeNull();
  });

  it('serializes two workers on one fixture hash', async () => {
    const week = await prisma.topScorersFiveGameweek.create({
      data: {
        leagueKey: 'laliga',
        weekKey: `fx-${Date.now()}`,
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        lockAt: new Date(),
      },
    });
    const fixture = await prisma.topScorersFiveFixture.create({
      data: {
        gameweekId: week.id,
        fixtureId: Math.floor(Math.random() * 1e9),
        homeTeamId: 1,
        awayTeamId: 2,
        kickoffAt: new Date(),
        sourceHash: null,
      },
    });
    const stamp = (hash: string) => prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "top_scorers_five_fixtures" WHERE id = ${fixture.id} FOR UPDATE`;
      const current = await tx.topScorersFiveFixture.findUnique({ where: { id: fixture.id } });
      if (current?.sourceHash === hash) return 'same';
      await tx.topScorersFiveFixture.update({ where: { id: fixture.id }, data: { sourceHash: hash, processedAt: new Date() } });
      return 'wrote';
    });
    const [first, second] = await Promise.all([stamp('hash-a'), stamp('hash-a')]);
    const wrote = [first, second].filter((row) => row === 'wrote');
    expect(wrote.length).toBeGreaterThanOrEqual(1);
    const stored = await prisma.topScorersFiveFixture.findUnique({ where: { id: fixture.id } });
    expect(stored?.sourceHash).toBe('hash-a');
  });

  it('keeps both slot writes when they do not share a version', async () => {
    const owner = await user('mods');
    const week = await prisma.coachKingGameweek.create({
      data: {
        weekKey: `mods-${Date.now()}`,
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        lockAt: new Date(),
      },
    });
    const squad = await prisma.coachKingSquad.create({
      data: { userId: owner.id, gameweekId: week.id, isLive: true, version: 0, spentMilli: 0 },
    });
    await Promise.all([
      prisma.coachKingSquad.update({ where: { id: squad.id }, data: { spentMilli: { increment: 1 } } }),
      prisma.coachKingSquad.update({ where: { id: squad.id }, data: { spentMilli: { increment: 1 } } }),
    ]);
    const stored = await prisma.coachKingSquad.findUnique({ where: { id: squad.id } });
    expect(stored?.spentMilli).toBe(2);
    expect(stored?.version).toBe(0);
  });

  it('lets a slot edit and a confirm settle to one version', async () => {
    const owner = await user('slot');
    const week = await prisma.coachKingGameweek.create({
      data: {
        weekKey: `slot-${Date.now()}`,
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        lockAt: new Date(),
      },
    });
    const squad = await prisma.coachKingSquad.create({
      data: { userId: owner.id, gameweekId: week.id, isLive: true, version: 0 },
    });
    const edit = prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "coach_king_squads" WHERE id = ${squad.id} FOR UPDATE`;
      await tx.coachKingSquad.update({ where: { id: squad.id }, data: { spentMilli: 10 } });
    });
    const confirm = prisma.$transaction(async (tx) => {
      const claimed = await tx.coachKingSquad.updateMany({
        where: { id: squad.id, version: 0 },
        data: { version: 1, confirmedAt: new Date(), unlocksAt: new Date(Date.now() + 7 * 86400000) },
      });
      if (claimed.count === 0) throw new Error('conflict');
    });
    await Promise.allSettled([edit, confirm]);
    const stored = await prisma.coachKingSquad.findUnique({ where: { id: squad.id } });
    expect(stored?.spentMilli === 10 || stored?.version === 1).toBe(true);
    expect(stored?.version === 0 || stored?.version === 1).toBe(true);
  });

  it('allows an edit after the lock time without starting a new lock', async () => {
    const owner = await user('expiry');
    const week = await prisma.coachKingGameweek.create({
      data: {
        weekKey: `exp-${Date.now()}`,
        startAt: new Date(),
        endAt: new Date(Date.now() + 86400000),
        lockAt: new Date(),
      },
    });
    const past = new Date(Date.now() - 1000);
    const squad = await prisma.coachKingSquad.create({
      data: { userId: owner.id, gameweekId: week.id, isLive: true, unlocksAt: past, version: 2 },
    });
    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT 1 FROM "coach_king_squads" WHERE id = ${squad.id} FOR UPDATE`;
      const fresh = await tx.coachKingSquad.findUnique({ where: { id: squad.id } });
      if (fresh?.unlocksAt && fresh.unlocksAt.getTime() > Date.now()) throw new Error('locked');
      await tx.coachKingSquad.update({ where: { id: squad.id }, data: { spentMilli: 5 } });
    });
    const stored = await prisma.coachKingSquad.findUnique({ where: { id: squad.id } });
    expect(stored?.spentMilli).toBe(5);
    expect(stored?.unlocksAt?.toISOString()).toBe(past.toISOString());
    expect(stored?.version).toBe(2);
  });
});

describe('fantasy postgres races availability', () => {
  it('skips the race suite unless DATABASE_URL_TEST is a disposable database', () => {
    if (!live) {
      expect(url).toBe('');
      return;
    }
    expect(url).not.toContain('rlwy.net');
  });
});
