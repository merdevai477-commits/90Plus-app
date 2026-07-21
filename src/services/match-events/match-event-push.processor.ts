/**
 * Match-event push processor — delivers inbox row + WebSocket + Expo push inline
 * (no second Bull notifications queue) so live events reach devices immediately.
 */

import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { renderPushTemplate, getUserLanguage, localizeMatchVarDetail } from '../push-templates.service';
import { NotificationService } from '../notification.service';
import type { MatchEventPushJob } from '../../queues/match-event-push.queue';
import {
    shouldDeliverToSubscription,
    isPrefAllowed,
    updateSubscriptionFlags,
    claimMatchEventDelivery,
    completeMatchEventDelivery,
    releaseMatchEventDeliveryClaim,
} from './match-event-delivery.service';

export async function processMatchEventPushJob(job: MatchEventPushJob): Promise<void> {
    const { subscriptionId, userId, event, fixtureId } = job;

    const sub = await prisma.favoriteMatch.findUnique({
        where: { id: subscriptionId },
    });

    if (!sub) {
        logger.debug('[MatchEventPush] subscription gone, skipping', { subscriptionId, eventKey: event.eventKey });
        return;
    }

    if (sub.notifiedEnd) {
        return;
    }

    if (!shouldDeliverToSubscription(sub, event)) {
        return;
    }

    if (!(await isPrefAllowed(userId, event.prefKey))) {
        return;
    }

    const lang = await getUserLanguage(userId);
    const vars: Record<string, string | number> = { ...(job.vars ?? {}) };
    if (event.eventType === 'var' && vars.detail != null) {
        vars.detail = localizeMatchVarDetail(String(vars.detail), lang);
    }

    let title: string | undefined;
    let message: string | undefined;

    // Prefer localized templates so Arabic/English matches User.settings.language.
    if (job.titleKey && job.bodyKey) {
        title = renderPushTemplate(job.titleKey as any, lang, vars);
        message = renderPushTemplate(job.bodyKey as any, lang, vars);
    } else if (job.message) {
        title = job.titleKey
            ? renderPushTemplate(job.titleKey as any, lang, vars)
            : renderPushTemplate('goalTitle', lang);
        message = job.message;
    }

    if (!title || !message) {
        throw new Error(`missing push copy for event ${event.eventKey}`);
    }

    const claim = await claimMatchEventDelivery(subscriptionId, event.eventKey, fixtureId);
    if (!claim) {
        logger.debug('[MatchEventPush] delivery already sent or in progress', {
            userId,
            eventKey: event.eventKey,
        });
        return;
    }

    try {
        const notification = await NotificationService.createNotification({
            userId,
            title,
            message,
            type: job.notificationType,
            channelId: 'match-updates',
            idempotencyKey: job.idempotencyKey,
            requirePushSuccess: true,
            data: {
                type: String(job.notificationType),
                priority: 'high',
                ...job.data,
            },
        });
        if (!notification) {
            throw new Error(`notification delivery failed for event ${event.eventKey}`);
        }
        if (!(await completeMatchEventDelivery(claim))) {
            throw new Error(`delivery claim lost for event ${event.eventKey}`);
        }
    } catch (err) {
        await releaseMatchEventDeliveryClaim(claim);
        throw err;
    }

    await updateSubscriptionFlags(sub, event);
}
