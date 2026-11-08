jest.mock('../../../lib/prisma', () => {
    const prisma: {
        diagnosticSession: { update: jest.Mock };
        diagnosticSessionDevice: { findUnique: jest.Mock; update: jest.Mock };
        diagnosticEvent: { createMany: jest.Mock; count: jest.Mock };
        $queryRaw: jest.Mock;
        $transaction: jest.Mock;
    } = {
        diagnosticSession: { update: jest.fn(async () => ({})) },
        diagnosticSessionDevice: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
        diagnosticEvent: { createMany: jest.fn(), count: jest.fn() },
        $queryRaw: jest.fn(),
        $transaction: jest.fn(async (fn: (tx: unknown) => unknown) => fn(prisma)),
    };
    return { __esModule: true, prisma, default: prisma };
});

import prisma from '../../../lib/prisma';
import { ingestBatch } from '../diagnostics-ingest.service';
import type { BatchEnvelope } from '../diagnostics.schema';
import { resetDiagnosticRedisForTests, setDiagnosticRedisForTests } from '../diagnostics-redis';
import type Redis from 'ioredis';

const db = prisma as unknown as {
    diagnosticSession: { update: jest.Mock };
    diagnosticSessionDevice: { findUnique: jest.Mock; update: jest.Mock };
    diagnosticEvent: { createMany: jest.Mock; count: jest.Mock };
    $queryRaw: jest.Mock;
    $transaction: jest.Mock;
};

const NOW = Date.UTC(2026, 10, 8, 20, 0, 0);
const SESSION_ID = '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d';
const DEVICE_REF = 'a'.repeat(32);

function sessionRow(overrides: Record<string, unknown> = {}) {
    return {
        id: SESSION_ID,
        status: 'active',
        environment: 'production',
        config: { maxEvents: 1000, maxDevices: 3, features: {}, sampling: {} },
        expiresAt: new Date(NOW + 20 * 60_000),
        eventCount: 0,
        ...overrides,
    };
}

function event(seq: number, extra: Record<string, unknown> = {}) {
    return {
        eventId: `abcd-ef01-${seq}`,
        seq,
        type: 'screen_focus',
        severity: 'info',
        wall: NOW - 1000,
        data: { focused: true },
        ...extra,
    };
}

function envelope(events: unknown[], overrides: Partial<BatchEnvelope> = {}): BatchEnvelope {
    return {
        schemaVersion: 1,
        sessionId: SESSION_ID,
        batchId: 'batch-0001',
        deviceId: 'dev_ABCDEFGH1234',
        sentAtWall: NOW,
        app: { version: '1.1.4', build: '173', platform: 'ios', environment: 'production' },
        events,
        ...overrides,
    } as BatchEnvelope;
}

function fakeRedis() {
    const store = new Map<string, string>();
    return {
        store,
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, value: string) => {
            store.set(key, value);
            return 'OK';
        }),
        disconnect: jest.fn(),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    resetDiagnosticRedisForTests();
    db.$queryRaw.mockResolvedValue([sessionRow()]);
    db.diagnosticSessionDevice.findUnique.mockResolvedValue({ id: 'device-row' });
    db.diagnosticEvent.count.mockResolvedValue(0);
    db.diagnosticEvent.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
    db.$transaction.mockImplementation(async (fn: (tx: unknown) => unknown) => fn(db));
});

afterEach(() => {
    resetDiagnosticRedisForTests();
});

describe('ingest acceptance', () => {
    it('accepts events for an active enrolled session', async () => {
        db.diagnosticEvent.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
        const result = await ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(result).toMatchObject({ kind: 'ok', accepted: 1, duplicates: 0, sessionState: 'active' });
        expect(db.diagnosticEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
        expect(String(db.$queryRaw.mock.calls[0][0].join(' '))).toContain('FOR UPDATE');
        expect(db.diagnosticSession.update).toHaveBeenCalledWith({
            where: { id: SESSION_ID },
            data: { eventCount: 1 },
        });
        expect(db.diagnosticSessionDevice.update).toHaveBeenCalledWith({
            where: { id: 'device-row' },
            data: { eventCount: 1, lastSeenAt: new Date(NOW) },
        });
    });

    it.each(['stopped', 'expired', 'revoked', 'pending'] as const)('rejects a %s session before inserting', async (status) => {
        db.$queryRaw.mockResolvedValue([sessionRow({ status })]);
        const result = await ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(result).toEqual({ kind: 'gone', sessionState: status });
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
        expect(db.diagnosticSession.update).not.toHaveBeenCalled();
        expect(db.diagnosticSessionDevice.update).not.toHaveBeenCalled();
    });

    it('rejects an active session whose expiry has passed', async () => {
        db.$queryRaw.mockResolvedValue([sessionRow({ expiresAt: new Date(NOW - 1000) })]);
        await expect(ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW })).resolves.toEqual({
            kind: 'gone',
            sessionState: 'expired',
        });
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
    });

    it('rejects an unknown status instead of treating it as active', async () => {
        db.$queryRaw.mockResolvedValue([sessionRow({ status: 'archived' })]);
        await expect(ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW })).resolves.toEqual({
            kind: 'gone',
            sessionState: 'closed',
        });
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
    });

    it('rejects a device that never joined', async () => {
        db.diagnosticSessionDevice.findUnique.mockResolvedValue(null);
        await expect(ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW })).resolves.toEqual({
            kind: 'forbidden',
            reason: 'device_unauthorized',
        });
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
    });

    it('rejects the whole batch when the stored event count is already at the cap', async () => {
        db.diagnosticEvent.count.mockResolvedValue(100);
        db.$queryRaw.mockResolvedValue([sessionRow({ config: { maxEvents: 100, maxDevices: 1, features: {}, sampling: {} } })]);
        const result = await ingestBatch({
            envelope: envelope([event(1), event(2)]),
            deviceRef: DEVICE_REF,
            nowMs: NOW,
        });
        expect(result).toMatchObject({ kind: 'ok', accepted: 0, sessionState: 'capped', maxEventsRemaining: 0 });
        if (result.kind === 'ok') {
            expect(result.rejected).toEqual([
                { eventId: 'abcd-ef01-1', reason: 'max_events' },
                { eventId: 'abcd-ef01-2', reason: 'max_events' },
            ]);
        }
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
    });

    it('keeps higher-priority events when only part of the batch fits', async () => {
        db.diagnosticEvent.count.mockResolvedValueOnce(98).mockResolvedValueOnce(100).mockResolvedValueOnce(2);
        db.$queryRaw.mockResolvedValue([sessionRow({ config: { maxEvents: 100, maxDevices: 1, features: {}, sampling: {} } })]);
        const result = await ingestBatch({
            envelope: envelope([
                event(1, { priority: 'low' }),
                event(2, { priority: 'critical' }),
                event(3, { priority: 'high' }),
            ]),
            deviceRef: DEVICE_REF,
            nowMs: NOW,
        });
        const rows = db.diagnosticEvent.createMany.mock.calls[0][0].data;
        expect(rows.map((row: { eventId: string }) => row.eventId)).toEqual(['abcd-ef01-2', 'abcd-ef01-3']);
        expect(result).toMatchObject({ kind: 'ok', accepted: 2, sessionState: 'capped', maxEventsRemaining: 0 });
    });

    it('counts only newly inserted rows when a batch mixes old and new ids', async () => {
        const seen = new Set<string>();
        db.diagnosticEvent.createMany.mockImplementation(async ({ data }: { data: Array<{ eventId: string }> }) => {
            let count = 0;
            for (const row of data) {
                if (seen.has(row.eventId)) continue;
                seen.add(row.eventId);
                count += 1;
            }
            return { count };
        });
        db.diagnosticEvent.count.mockImplementation(async () => seen.size);
        await ingestBatch({ envelope: envelope([event(1), event(2)]), deviceRef: DEVICE_REF, nowMs: NOW });
        const mixed = await ingestBatch({
            envelope: envelope([event(2), event(3)], { batchId: 'batch-0002' }),
            deviceRef: DEVICE_REF,
            nowMs: NOW,
        });
        expect(mixed).toMatchObject({ kind: 'ok', accepted: 1, duplicates: 1 });
        expect(db.diagnosticSession.update).toHaveBeenLastCalledWith({
            where: { id: SESSION_ID },
            data: { eventCount: 3 },
        });
    });

    it('does not insert a batch that arrives after stop has committed', async () => {
        const row = sessionRow();
        const stored: string[] = [];
        db.$queryRaw.mockImplementation(async () => [{ ...row }]);
        db.diagnosticEvent.count.mockImplementation(async () => stored.length);
        db.diagnosticEvent.createMany.mockImplementation(async ({ data }: { data: Array<{ eventId: string }> }) => {
            if (row.status !== 'active') throw new Error('insert after stop');
            for (const item of data) stored.push(item.eventId);
            return { count: data.length };
        });
        db.diagnosticSession.update.mockImplementation(async ({ data }: { data: { status?: string; eventCount?: number } }) => {
            if (data.status) row.status = data.status;
            return row;
        });
        let gate = Promise.resolve();
        db.$transaction.mockImplementation(async (fn: (tx: unknown) => Promise<unknown>) => {
            const run = gate.then(() => fn(db));
            gate = run.then(() => undefined, () => undefined);
            return run;
        });

        const first = ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW });
        const stopping = gate.then(async () => {
            row.status = 'stopped';
        });
        const second = stopping.then(() =>
            ingestBatch({ envelope: envelope([event(2)], { batchId: 'batch-0002' }), deviceRef: DEVICE_REF, nowMs: NOW }),
        );
        const [accepted, rejected] = await Promise.all([first, second]);
        expect(accepted).toMatchObject({ kind: 'ok', accepted: 1 });
        expect(rejected).toEqual({ kind: 'gone', sessionState: 'stopped' });
        expect(stored).toEqual(['abcd-ef01-1']);
    });

    it('mirrors the persisted count to redis and does not use redis to decide acceptance', async () => {
        const redis = fakeRedis();
        setDiagnosticRedisForTests(redis as unknown as Redis);
        db.diagnosticEvent.count.mockResolvedValueOnce(0).mockResolvedValueOnce(1).mockResolvedValueOnce(1);
        const result = await ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(result).toMatchObject({ kind: 'ok', accepted: 1 });
        expect(redis.store.get(`diag:development:sess:${SESSION_ID}:count`)).toBe('1');
        expect(redis.get).not.toHaveBeenCalled();
    });

    it('still rejects a stopped session when redis has a stale active counter', async () => {
        const redis = fakeRedis();
        redis.store.set(`diag:development:sess:${SESSION_ID}:count`, '0');
        setDiagnosticRedisForTests(redis as unknown as Redis);
        db.$queryRaw.mockResolvedValue([sessionRow({ status: 'stopped' })]);
        const result = await ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(result).toEqual({ kind: 'gone', sessionState: 'stopped' });
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
        expect(redis.store.get(`diag:development:sess:${SESSION_ID}:count`)).toBe('0');
    });

    it('propagates a failed transaction so the client can retry', async () => {
        db.diagnosticEvent.createMany.mockRejectedValue(new Error('connection lost'));
        await expect(ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW })).rejects.toThrow(
            'connection lost',
        );
    });
});
