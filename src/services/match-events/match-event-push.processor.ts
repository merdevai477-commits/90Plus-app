/**
 * Enqueue-first push processor: delivery ledger is written only after a successful
 * (or idempotency-deduplicated) push, closing the crash window where delivery was
 * recorded but the job never ran.
 */

import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { notifyUser } from '../notify.service';
import { renderPushTemplate, getUserLanguage } from '../push-templates.service';
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

    const result = await notifyUser({
        userId,
        type: job.notificationType,
        title,
        message,
        data: job.data as any,
        bypassPreferences: true,
        idempotencyKey,
    });

    const pushSucceeded = result.delivered || result.reason === 'duplicate';

    if (!pushSucceeded) {
        throw new Error(`push not delivered: ${result.reason ?? 'unknown'}`);
    }

    await recordMatchEventDelivery(subscriptionId, event.eventKey, fixtureId);
    await updateSubscriptionFlags(sub, event);
}
