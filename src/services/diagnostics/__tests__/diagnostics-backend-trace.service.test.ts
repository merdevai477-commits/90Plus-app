jest.mock('../../../lib/prisma', () => {
    const prisma = { diagnosticEvent: { createMany: jest.fn() } };
    return { __esModule: true, prisma, default: prisma };
});

import prisma from '../../../lib/prisma';
import { lagAudit } from '../../../utils/lag-audit';
import {
    createDiagTrace,
    diagnosticsRequestTag,
    flushBackendTrace,
    noteLagAudit,
    recordBackendPoll,
    resetBackendTraceForTests,
    withDiagMeta,
} from '../diagnostics-backend-trace.service';

const db = prisma as unknown as { diagnosticEvent: { createMany: jest.Mock } };
const SESSION = '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d';

describe('backend trace sink', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetBackendTraceForTests(null);
        db.diagnosticEvent.createMany.mockResolvedValue({ count: 1 });
    });

    it('records nothing and leaves response meta unchanged while no session is active', async () => {
        noteLagAudit('ws_broadcast_decision', { fixtureId: 1, status: '2H', elapsed: 10, hg: 1, ag: 0 });
        recordBackendPoll({ gen: 1, fetchStartedAt: Date.now(), providerMs: 20, count: 3, cached: false });
        lagAudit('http_live_list_read', { clocks: [{ id: 1, elapsed: 10 }] });
        expect(createDiagTrace(1)).toBeUndefined();
        expect(withDiagMeta({ elapsedMs: 5 })).toEqual({ elapsedMs: 5 });
        expect(await flushBackendTrace()).toBe(0);
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
    });

    it('keeps a signature and drops fixture dumps', async () => {
        resetBackendTraceForTests([SESSION]);
        noteLagAudit('ws_broadcast_decision', {
            fixtureId: 9,
            status: '2H',
            elapsed: 67,
            extra: null,
            hg: 1,
            ag: 0,
            reason: 'score',
            traceId: 'b-abc123',
            clocks: [{ id: 9, name: 'should not be stored' }],
            diffs: [{ id: 9 }],
        });
        noteLagAudit('not_a_point', { fixtureId: 1 });
        expect(await flushBackendTrace()).toBe(1);
        const rows = db.diagnosticEvent.createMany.mock.calls[0][0].data;
        expect(rows).toHaveLength(1);
        expect(rows[0]).toMatchObject({
            sessionId: SESSION,
            source: 'backend',
            type: 'be_change',
            fixtureId: 9,
            traceId: 'b-abc123',
        });
        expect(rows[0].payload).toMatchObject({ point: 'ws_broadcast_decision', sig: '2H|67|null|1-0', reason: 'score' });
        expect(JSON.stringify(rows[0].payload)).not.toContain('should not');
        expect(rows[0].payload).not.toHaveProperty('clocks');
        expect(rows[0].payload).not.toHaveProperty('diffs');
    });

    it('puts the trace on the envelope only while recording', () => {
        expect(createDiagTrace(4)).toBeUndefined();
        resetBackendTraceForTests([SESSION]);
        const trace = createDiagTrace(4, 1_780_000_000_000);
        expect(trace).toMatchObject({ gen: 4, detectedAt: 1_780_000_000_000 });
        expect(trace?.id).toMatch(/^b-[a-f0-9]{16}$/);
        expect(withDiagMeta({ elapsedMs: 5 })).toEqual({ elapsedMs: 5, generatedAt: expect.any(Number) });
    });

    it('records a tagged request when it finishes and ignores everyone else', () => {
        resetBackendTraceForTests([SESSION]);
        const finish: Array<() => void> = [];
        const res = {
            statusCode: 200,
            on: (event: string, cb: () => void) => {
                if (event === 'finish') finish.push(cb);
            },
        };
        const next = jest.fn();
        diagnosticsRequestTag({ get: () => undefined, path: '/api/football/fixtures/live' } as any, res as any, next);
        expect(next).toHaveBeenCalledTimes(1);
        finish.forEach((cb) => cb());

        diagnosticsRequestTag(
            {
                get: (name: string) => (name === 'x-diag-session' ? SESSION : undefined),
                method: 'GET',
                path: '/api/football/fixtures/live',
                baseUrl: '',
                route: undefined,
            } as any,
            res as any,
            next,
        );
        expect(finish).toHaveLength(1);
        finish[0]();
        return flushBackendTrace().then(() => {
            const row = db.diagnosticEvent.createMany.mock.calls[0][0].data[0];
            expect(row.type).toBe('be_http_serve');
            expect(row.payload).toMatchObject({ point: 'request', method: 'GET', status: 200, sessionId: SESSION });
        });
    });
});
