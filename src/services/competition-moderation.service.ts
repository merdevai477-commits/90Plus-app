/**
 * Review-desk side effects for Predict & Win: activity log + sponsor/admin push.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import type { CompetitionActivityType, Prisma } from '@prisma/client';

const ADMIN_CLERK_FALLBACK = 'user_3EkQy6HwmjF8LeUlwDuXjn8EXs6';

export async function recordCompetitionActivity(
  competitionId: string,
  type: CompetitionActivityType,
  payload: Prisma.InputJsonValue,
): Promise<void> {
  try {
    await prisma.competitionActivity.create({
      data: { competitionId, type, payload },
    });
  } catch (err: any) {
    logger.warn('[CompetitionModeration] activity write failed:', err?.message);
  }
}

async function notifyLazy(
  userId: string,
  opts: {
    titleKey: import('./push-templates.service').PushTemplateKey;
    bodyKey: import('./push-templates.service').PushTemplateKey;
    vars: Record<string, string | number>;
    data: { screen?: string; entityId?: string; [k: string]: unknown };
    idempotencyKey: string;
  },
): Promise<void> {
  try {
    const { notifyUser } = await import('./notify.service');
    const { NotificationType } = await import('./notification.service');
    await notifyUser({
      userId,
      type: NotificationType.GENERAL,
      titleKey: opts.titleKey,
      bodyKey: opts.bodyKey,
      vars: opts.vars,
      data: opts.data,
      idempotencyKey: opts.idempotencyKey,
      bypassPreferences: true,
    });
  } catch (err: any) {
    logger.warn('[CompetitionModeration] notify failed:', err?.message);
  }
}

export async function resolveAssAdminUserId(): Promise<string | null> {
  const clerkUserId = (process.env.ASS_ADMIN_CLERK_ID ?? ADMIN_CLERK_FALLBACK).trim();
  if (!clerkUserId) return null;
  const user = await prisma.user.findFirst({
    where: { clerkUserId },
    select: { id: true },
  });
  return user?.id ?? null;
}

export async function notifyAssAdmin(opts: {
  titleKey: import('./push-templates.service').PushTemplateKey;
  bodyKey: import('./push-templates.service').PushTemplateKey;
  vars: Record<string, string | number>;
  data: { screen?: string; entityId?: string; [k: string]: unknown };
  idempotencyKey: string;
}): Promise<void> {
  const adminId = await resolveAssAdminUserId();
  if (!adminId) {
    logger.warn('[CompetitionModeration] AsS admin Clerk user not found in DB');
    return;
  }
  await notifyLazy(adminId, opts);
}

export async function notifySponsorReviewDecision(opts: {
  ownerId: string | null;
  competitionId: string;
  approved: boolean;
  prizeName: string;
  reason?: string | null;
}): Promise<void> {
  if (!opts.ownerId) return;
  const reason = (opts.reason ?? '').trim();
  if (opts.approved) {
    await notifyLazy(opts.ownerId, {
      titleKey: 'competitionApprovedTitle',
      bodyKey: 'competitionApprovedBody',
      vars: { prize: opts.prizeName },
      data: { screen: `/predict-and-win/${opts.competitionId}`, entityId: opts.competitionId, kind: 'competition_approved' },
      idempotencyKey: `competitionApproved:${opts.competitionId}`,
    });
    return;
  }
  await notifyLazy(opts.ownerId, {
    titleKey: 'competitionRejectedTitle',
    bodyKey: reason ? 'competitionRejectedReasonBody' : 'competitionRejectedBody',
    vars: { prize: opts.prizeName, reason },
    data: { screen: `/predict-and-win/${opts.competitionId}`, entityId: opts.competitionId, kind: 'competition_rejected' },
    idempotencyKey: `competitionRejected:${opts.competitionId}`,
  });
}
