/**
 * Match-event push processor — delivers inbox row + WebSocket + Expo push inline
 * (no second Bull notifications queue) so live events reach devices immediately.
 */

import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { claimNotifyIdempotency } from '../notify.service';
import { renderPushTemplate, getUserLanguage, localizeMatchVarDetail } from '../push-templates.service';
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

    await NotificationService.createNotification({
        userId,
        title,
        message,
        type: job.notificationType,
        channelId: 'match-updates',
        data: {
            type: String(job.notificationType),
            priority: 'high',
            ...job.data,
        },
    });

    await recordMatchEventDelivery(subscriptionId, event.eventKey, fixtureId);
    await updateSubscriptionFlags(sub, event);
}
