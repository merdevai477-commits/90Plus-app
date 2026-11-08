import prisma from '../../../lib/prisma';
import { analyzeDiagnostics, toAnalysisEvent, type AnalysisEvent, type AnalysisReport } from './diagnostics-analysis';

const MAX_EVENTS = 5000;

export async function loadSessionAnalysisEvents(
    sessionId: string,
    filter: { type?: string; fixtureId?: number; limit?: number } = {},
): Promise<AnalysisEvent[]> {
    const take = Math.min(MAX_EVENTS, Math.max(1, filter.limit ?? 2000));
    const rows = await prisma.diagnosticEvent.findMany({
        where: {
            sessionId,
            ...(filter.type ? { type: filter.type } : {}),
            ...(filter.fixtureId ? { fixtureId: filter.fixtureId } : {}),
        },
        orderBy: { recordedAt: 'asc' },
        take,
        select: {
            eventId: true,
            type: true,
            source: true,
            recordedAt: true,
            fixtureId: true,
            traceId: true,
            payload: true,
        },
    });
    return rows.map(toAnalysisEvent);
}

export async function buildSessionReport(sessionId: string): Promise<AnalysisReport> {
    return analyzeDiagnostics(await loadSessionAnalysisEvents(sessionId, { limit: MAX_EVENTS }));
}
