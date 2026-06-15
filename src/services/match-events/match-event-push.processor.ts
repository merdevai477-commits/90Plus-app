/**
 * Match-event push processor — delivers inbox row + WebSocket + Expo push inline
 * (no second Bull notifications queue) so live events reach devices immediately.
 */

import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { claimNotifyIdempotency } from '../notify.service';
import { renderPushTemplate, getUserLanguage } from '../push-templates.service';
import { NotificationService } from '../notification.service';
import type { MatchEventPushJob } from '../../queues/match-event-push.queue';
import {
    shouldDeliverToSubscription,
    isPrefAllowed,
    updateSubscriptionFlags,
    isDeliveryRecorded,
    recordMatchEventDelivery,
} from './match-event-delivery.service';

export async function processMatchEventPushJob(job: MatchEventPushJob): Promise<void> {
    const { subscriptionId, userId, event, fixtureId, idempotencyKey } = job;

    if (await isDeliveryRecorded(subscriptionId, event.eventKey)) {
        return;
    }

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

    if (idempotencyKey) {
        const fresh = await claimNotifyIdempotency(idempotencyKey);
        if (!fresh) {
            logger.debug('[MatchEventPush] idempotency duplicate', { userId, eventKey: event.eventKey });
            return;
        }
    }

    const lang = await getUserLanguage(userId);
    let title: string | undefined;
    let message: string | undefined;

    if (job.message) {
        title = job.titleKey
            ? renderPushTemplate(job.titleKey as any, lang, job.vars ?? {})
            : renderPushTemplate('goalTitle', lang);
        message = job.message;
    } else if (job.titleKey && job.bodyKey) {
        title = renderPushTemplate(job.titleKey as any, lang, job.vars ?? {});
        message = renderPushTemplate(job.bodyKey as any, lang, job.vars ?? {});
    }

    if (!title || !message) {
        throw new Error(`missing push copy for event ${event.eventKey}`);
    }

    await NotificationService.createNotification({
        userId,
        title,
        message,
        type: job.notificationType,
        data: {
            type: String(job.notificationType),
            priority: 'high',
            ...job.data,
        },
    });

    await recordMatchEventDelivery(subscriptionId, event.eventKey, fixtureId);
    await updateSubscriptionFlags(sub, event);
}
