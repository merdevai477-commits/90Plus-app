/**
 * Prediction Groups — business logic for ملك التوقعات
 */

import {
  GroupPredictionMode,
  Prisma,
} from '@prisma/client';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { notifyUser } from './notify.service';
import { NotificationType } from './notification.service';
import { getCurrentRoundWithMatches, isMatchLocked } from './group-round.service';

const INVITE_CODE_PREFIX = '90PLUS';
const INVITE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateInviteCode(): string {
  let suffix = '';
  for (let i = 0; i < 6; i++) {
    suffix += INVITE_CHARS[Math.floor(Math.random() * INVITE_CHARS.length)];
  }
  return `${INVITE_CODE_PREFIX}${suffix}`;
}

export function normalizeInviteCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/\s+/g, '');
}

export function isValidInviteCode(code: string): boolean {
  return /^90PLUS[A-Z0-9]{4,12}$/.test(code);
}

async function getActiveMembership(userId: string) {
  return prisma.groupMember.findFirst({
    where: { userId, leftAt: null },
    include: {
      group: {
        include: {
          owner: { select: { id: true, username: true, displayName: true, avatar: true } },
          members: {
            where: { leftAt: null },
            select: { id: true },
          },
        },
      },
    },
  });
}

async function getOwnedActiveGroup(userId: string) {
  return prisma.predictionGroup.findFirst({
    where: {
      ownerId: userId,
      members: { some: { userId, leftAt: null, role: 'OWNER' } },
    },
  });
}

export async function getMyGroupState(userId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership) {
    return { hasGroup: false as const, group: null, membership: null };
  }

  const group = membership.group;
  const activeMembers = group.members.length;

  return {
    hasGroup: true as const,
    membership: {
      id: membership.id,
      role: membership.role,
      groupXpTotal: membership.groupXpTotal,
      joinedAt: membership.joinedAt,
      isOwner: membership.role === 'OWNER',
    },
    group: {
      id: group.id,
      name: group.name,
      avatarUrl: group.avatarUrl,
      inviteCode: group.inviteCode,
      ownerId: group.ownerId,
      membersCount: activeMembers,
      createdAt: group.createdAt,
      isPrivate: true,
    },
  };
}

export async function createGroup(userId: string, name: string, avatarUrl?: string | null) {
  const trimmed = name.trim();
  if (trimmed.length < 2 || trimmed.length > 40) {
    throw new Error('INVALID_NAME');
  }

  const existingMembership = await getActiveMembership(userId);
  if (existingMembership) throw new Error('ALREADY_IN_GROUP');

  const owned = await getOwnedActiveGroup(userId);
  if (owned) throw new Error('ALREADY_OWNS_GROUP');

  let inviteCode = generateInviteCode();
  for (let attempt = 0; attempt < 5; attempt++) {
    const exists = await prisma.predictionGroup.findUnique({ where: { inviteCode } });
    if (!exists) break;
    inviteCode = generateInviteCode();
  }

  const group = await prisma.$transaction(async (tx) => {
    const created = await tx.predictionGroup.create({
      data: {
        name: trimmed,
        avatarUrl: avatarUrl ?? null,
        inviteCode,
        ownerId: userId,
      },
    });
    await tx.groupMember.create({
      data: {
        groupId: created.id,
        userId,
        role: 'OWNER',
      },
    });
    return created;
  });

  return getMyGroupState(userId);
}

export async function previewGroupByCode(code: string) {
  const normalized = normalizeInviteCode(code);
  if (!isValidInviteCode(normalized)) throw new Error('INVALID_CODE');

  const group = await prisma.predictionGroup.findUnique({
    where: { inviteCode: normalized },
    include: {
      members: { where: { leftAt: null }, select: { id: true } },
    },
  });
  if (!group) throw new Error('GROUP_NOT_FOUND');

  return {
    id: group.id,
    name: group.name,
    avatarUrl: group.avatarUrl,
    inviteCode: group.inviteCode,
    membersCount: group.members.length,
  };
}

export async function joinGroup(userId: string, opts: { code?: string; inviteId?: string }) {
  const existing = await getActiveMembership(userId);
  if (existing) throw new Error('ALREADY_IN_GROUP');

  let groupId: string | null = null;

  if (opts.inviteId) {
    const invite = await prisma.groupInvite.findUnique({
      where: { id: opts.inviteId },
      include: { group: true },
    });
    if (!invite || invite.inviteeId !== userId) throw new Error('INVITE_NOT_FOUND');
    if (invite.status !== 'PENDING') throw new Error('INVITE_NOT_PENDING');
    groupId = invite.groupId;
  } else if (opts.code) {
    const preview = await previewGroupByCode(opts.code);
    groupId = preview.id;
  } else {
    throw new Error('MISSING_JOIN_PARAMS');
  }

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.create({
      data: { groupId: groupId!, userId, role: 'MEMBER' },
    });
    if (opts.inviteId) {
      await tx.groupInvite.update({
        where: { id: opts.inviteId },
        data: { status: 'ACCEPTED' },
      });
    }
  });

  return getMyGroupState(userId);
}

export async function leaveGroup(userId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership) throw new Error('NOT_IN_GROUP');

  await prisma.$transaction(async (tx) => {
    await tx.groupMember.update({
      where: { id: membership.id },
      data: { leftAt: new Date() },
    });

    if (membership.role === 'OWNER') {
      const nextOwner = await tx.groupMember.findFirst({
        where: { groupId: membership.groupId, leftAt: null, userId: { not: userId } },
        orderBy: { joinedAt: 'asc' },
      });

      if (nextOwner) {
        await tx.groupMember.update({
          where: { id: nextOwner.id },
          data: { role: 'OWNER' },
        });
        await tx.predictionGroup.update({
          where: { id: membership.groupId },
          data: { ownerId: nextOwner.userId },
        });
      }
    }
  });

  return { success: true };
}

export async function updateGroup(
  userId: string,
  groupId: string,
  data: { name?: string; avatarUrl?: string | null },
) {
  const membership = await getActiveMembership(userId);
  if (!membership || membership.groupId !== groupId || membership.role !== 'OWNER') {
    throw new Error('FORBIDDEN');
  }

  const update: Prisma.PredictionGroupUpdateInput = {};
  if (data.name !== undefined) {
    const trimmed = data.name.trim();
    if (trimmed.length < 2 || trimmed.length > 40) throw new Error('INVALID_NAME');
    update.name = trimmed;
  }
  if (data.avatarUrl !== undefined) update.avatarUrl = data.avatarUrl;

  await prisma.predictionGroup.update({ where: { id: groupId }, data: update });
  return getMyGroupState(userId);
}

export async function kickMember(ownerId: string, groupId: string, targetUserId: string) {
  const membership = await getActiveMembership(ownerId);
  if (!membership || membership.groupId !== groupId || membership.role !== 'OWNER') {
    throw new Error('FORBIDDEN');
  }
  if (targetUserId === ownerId) throw new Error('CANNOT_KICK_SELF');

  const target = await prisma.groupMember.findFirst({
    where: { groupId, userId: targetUserId, leftAt: null },
  });
  if (!target) throw new Error('MEMBER_NOT_FOUND');

  await prisma.groupMember.update({
    where: { id: target.id },
    data: { leftAt: new Date() },
  });

  return { success: true };
}

export async function inviteUser(inviterId: string, groupId: string, inviteeId: string) {
  const membership = await getActiveMembership(inviterId);
  if (!membership || membership.groupId !== groupId) throw new Error('FORBIDDEN');

  const inviteeMembership = await getActiveMembership(inviteeId);
  if (inviteeMembership) throw new Error('INVITEE_IN_GROUP');

  const group = membership.group;
  const invite = await prisma.groupInvite.upsert({
    where: { groupId_inviteeId: { groupId, inviteeId } },
    create: {
      groupId,
      inviterId,
      inviteeId,
      status: 'PENDING',
    },
    update: {
      inviterId,
      status: 'PENDING',
    },
  });

  try {
    const inviter = await prisma.user.findUnique({
      where: { id: inviterId },
      select: { id: true, username: true, displayName: true, avatar: true },
    });
    await notifyUser({
      userId: inviteeId,
      type: NotificationType.GROUP_INVITE,
      title: 'دعوة لمجموعة توقعات',
      message: `تمت دعوتك للانضمام إلى "${group.name}"`,
      data: {
        screen: '/prediction-groups',
        groupId: group.id,
        inviteId: invite.id,
        joinCode: group.inviteCode,
      },
      idempotencyKey: `group-invite:${invite.id}`,
      actor: inviter
        ? {
            id: inviter.id,
            username: inviter.username,
            displayName: inviter.displayName,
            avatar: inviter.avatar,
          }
        : undefined,
    });
  } catch (err) {
    logger.warn('[PredictionGroups] invite notification failed:', err);
  }

  return { inviteId: invite.id };
}

export async function getGroupMembers(groupId: string, viewerId: string) {
  const viewer = await getActiveMembership(viewerId);
  if (!viewer || viewer.groupId !== groupId) throw new Error('FORBIDDEN');

  const members = await prisma.groupMember.findMany({
    where: { groupId, leftAt: null },
    orderBy: [{ groupXpTotal: 'desc' }, { joinedAt: 'asc' }],
    include: {
      user: {
        select: {
          id: true,
          username: true,
          displayName: true,
          avatar: true,
        },
      },
    },
  });

  return members.map((m, index) => ({
    rank: index + 1,
    userId: m.userId,
    username: m.user.username,
    name: m.user.displayName || m.user.username,
    avatar: m.user.avatar,
    points: m.groupXpTotal,
    isMe: m.userId === viewerId,
    isAdmin: m.role === 'OWNER',
    role: m.role,
    joinedAt: m.joinedAt,
  }));
}

export async function getGroupStandings(groupId: string, viewerId: string) {
  const members = await getGroupMembers(groupId, viewerId);

  const allSettled = await prisma.groupPrediction.findMany({
    where: { groupId, isCorrect: { not: null } },
    select: { userId: true, isCorrect: true },
  });
  const correctByUser = new Map<string, number>();
  const wrongCounts = new Map<string, number>();
  for (const row of allSettled) {
    if (row.isCorrect) {
      correctByUser.set(row.userId, (correctByUser.get(row.userId) ?? 0) + 1);
    } else {
      wrongCounts.set(row.userId, (wrongCounts.get(row.userId) ?? 0) + 1);
    }
  }

  const enriched = members
    .filter((m) => m.points > 0 || correctByUser.has(m.userId))
    .map((m) => {
      const correct = correctByUser.get(m.userId) ?? 0;
      const wrong = wrongCounts.get(m.userId) ?? 0;
      const total = correct + wrong;
      return {
        ...m,
        correct,
        wrong,
        accuracy: total > 0 ? Math.round((correct / total) * 100) : 0,
      };
    });

  return {
    members: enriched,
    groupStats: {
      totalPredictions: allSettled.length,
      correctPredictions: allSettled.filter((r) => r.isCorrect).length,
      wrongPredictions: allSettled.filter((r) => !r.isCorrect).length,
    },
  };
}

export async function getGlobalLeaderboard(period: 'all' | 'week' | 'month' = 'all') {
  const now = new Date();
  let since: Date | undefined;
  if (period === 'week') {
    since = new Date(now);
    since.setDate(since.getDate() - 7);
  } else if (period === 'month') {
    since = new Date(now);
    since.setDate(since.getDate() - 30);
  }

  const groups = await prisma.predictionGroup.findMany({
    include: {
      members: {
        where: { leftAt: null },
        select: { userId: true, groupXpTotal: true },
      },
    },
  });

  type Row = {
    id: string;
    name: string;
    avatarUrl: string | null;
    inviteCode: string;
    points: number;
    members: number;
  };

  const rows: Row[] = [];

  for (const g of groups) {
    let points = 0;
    if (since) {
      const agg = await prisma.groupPrediction.aggregate({
        where: {
          groupId: g.id,
          settledAt: { gte: since },
          isCorrect: true,
        },
        _sum: { xpAwarded: true },
      });
      points = agg._sum.xpAwarded ?? 0;
    } else {
      points = g.members.reduce((sum, m) => sum + m.groupXpTotal, 0);
    }

    if (points <= 0 && g.members.length === 0) continue;

    rows.push({
      id: g.id,
      name: g.name,
      avatarUrl: g.avatarUrl,
      inviteCode: g.inviteCode,
      points,
      members: g.members.length,
    });
  }

  rows.sort((a, b) => b.points - a.points);

  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

export async function saveGroupPredictions(
  userId: string,
  groupId: string,
  predictions: Array<{
    apiMatchId: number;
    mode: GroupPredictionMode;
    predictedWinner?: 'home' | 'draw' | 'away';
    predictedHomeScore?: number;
    predictedAwayScore?: number;
  }>,
) {
  const membership = await getActiveMembership(userId);
  if (!membership || membership.groupId !== groupId) throw new Error('FORBIDDEN');

  const { round, matches } = await getCurrentRoundWithMatches();
  const allowedIds = new Set((round.matchIds as number[]) ?? []);
  const statusById = new Map(matches.map((m) => [m.apiMatchId, m.status]));

  for (const p of predictions) {
    if (!allowedIds.has(p.apiMatchId)) throw new Error('MATCH_NOT_IN_ROUND');
    const status = statusById.get(p.apiMatchId) ?? 'NS';
    if (isMatchLocked(status)) throw new Error('MATCH_LOCKED');

    if (p.mode === 'EXACT') {
      if (
        p.predictedHomeScore == null ||
        p.predictedAwayScore == null ||
        p.predictedHomeScore < 0 ||
        p.predictedAwayScore < 0
      ) {
        throw new Error('INVALID_SCORE');
      }
    } else if (!p.predictedWinner) {
      throw new Error('INVALID_WINNER');
    }

    await prisma.groupPrediction.upsert({
      where: {
        userId_roundId_apiMatchId: {
          userId,
          roundId: round.id,
          apiMatchId: p.apiMatchId,
        },
      },
      create: {
        roundId: round.id,
        groupId,
        userId,
        apiMatchId: p.apiMatchId,
        mode: p.mode,
        predictedWinner: p.predictedWinner ?? null,
        predictedHomeScore: p.predictedHomeScore ?? null,
        predictedAwayScore: p.predictedAwayScore ?? null,
      },
      update: {
        mode: p.mode,
        predictedWinner: p.predictedWinner ?? null,
        predictedHomeScore: p.predictedHomeScore ?? null,
        predictedAwayScore: p.predictedAwayScore ?? null,
        isCorrect: null,
        xpAwarded: 0,
        settledAt: null,
      },
    });
  }

  return { success: true, roundId: round.id };
}

export async function getMyRoundPredictions(userId: string, groupId: string) {
  const membership = await getActiveMembership(userId);
  if (!membership || membership.groupId !== groupId) throw new Error('FORBIDDEN');

  const { round, matches } = await getCurrentRoundWithMatches();
  const mine = await prisma.groupPrediction.findMany({
    where: { userId, roundId: round.id, groupId },
  });
  const byMatch = new Map(mine.map((p) => [p.apiMatchId, p]));

  return {
    round: { id: round.id, date: round.date, status: round.status },
    matches: matches.map((m) => ({
      ...m,
      prediction: byMatch.get(m.apiMatchId) ?? null,
    })),
  };
}
