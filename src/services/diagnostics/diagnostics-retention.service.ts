import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { getRetentionDays } from './diagnostics.config';

const DELETE_BATCH = 5000;
const MAX_DELETE_ROUNDS = 200;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface RetentionSummary {
    expiredSessions: number;
    deletedEvents: number;
    deletedSessions: number;
}

/**
 * Daily cleanup. Events are deleted in bounded batches so a large session
 * never produces one long-running DELETE; sessions (and, by cascade, their
 * devices and any remaining events) go after the longer session retention.
 */
export async function runDiagnosticsRetention(nowMs: number = Date.now()): Promise<RetentionSummary> {
    const retention = getRetentionDays();
    const eventCutoff = new Date(nowMs - retention.events * DAY_MS);
    const sessionCutoff = new Date(nowMs - retention.sessions * DAY_MS);

    const expired = await prisma.diagnosticSession.updateMany({
        where: { status: 'active', expiresAt: { lt: new Date(nowMs) } },
        data: { status: 'expired' },
    });

    let deletedEvents = 0;
    for (let round = 0; round < MAX_DELETE_ROUNDS; round += 1) {
        const deleted = await prisma.$executeRaw`
            DELETE FROM "diagnostic_events"
            WHERE "id" IN (
                SELECT "id" FROM "diagnostic_events"
                WHERE "receivedAt" < ${eventCutoff}
                LIMIT ${DELETE_BATCH}
            )`;
        deletedEvents += deleted;
        if (deleted < DELETE_BATCH) break;
    }

    const sessions = await prisma.diagnosticSession.deleteMany({
        where: { status: { not: 'active' }, createdAt: { lt: sessionCutoff } },
    });

    const summary = { expiredSessions: expired.count, deletedEvents, deletedSessions: sessions.count };
    if (summary.expiredSessions || summary.deletedEvents || summary.deletedSessions) {
        logger.info(`[DIAG] ${JSON.stringify({ evt: 'retention', ...summary })}`);
    }
    return summary;
}
