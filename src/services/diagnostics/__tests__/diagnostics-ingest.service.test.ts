jest.mock('../../../lib/prisma', () => {
    const prisma = {
        diagnosticSession: { findUnique: jest.fn(), update: jest.fn(async () => ({})) },
        diagnosticSessionDevice: { updateMany: jest.fn(async () => ({ count: 1 })) },
        diagnosticEvent: { createMany: jest.fn() },
    };
    return { __esModule: true, prisma, default: prisma };
});

import prisma from '../../../lib/prisma';
import { getRedisClient, isRedisConnected } from '../../../lib/redis';
import { ingestBatch } from '../diagnostics-ingest.service';
import type { BatchEnvelope } from '../diagnostics.schema';

const db = prisma as unknown as {
    diagnosticSession: { findUnique: jest.Mock; update: jest.Mock };
    diagnosticSessionDevice: { updateMany: jest.Mock };
    diagnosticEvent: { createMany: jest.Mock };
};

const NOW = Date.UTC(2026, 10, 8, 20, 0, 0);
const SESSION_ID = '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d';
const DEVICE_REF = 'a'.repeat(32);

function sessionRow(overrides: Record<string, unknown> = {}) {
    return {
        id: SESSION_ID,
        label: null,
        status: 'active',
        environment: 'production',
        target: { buildNumbers: ['173'] },
        config: { maxEvents: 1000 },
        startsAt: new Date(NOW - 10 * 60_000),
        expiresAt: new Date(NOW + 20 * 60_000),
        stoppedAt: null,
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
    interface FakeMulti {
        incrby: jest.Mock;
        expire: jest.Mock;
        exec: jest.Mock;
    }
    const multi: FakeMulti = {
        incrby: jest.fn((key: string, by: number) => {
            store.set(key, String(Number(store.get(key) ?? 0) + by));
            return multi;
        }),
        expire: jest.fn(() => multi),
        exec: jest.fn(async () => []),
    };
    return {
        store,
        get: jest.fn(async (key: string) => store.get(key) ?? null),
        set: jest.fn(async (key: string, value: string, ...args: unknown[]) => {
            if (args.includes('NX') && store.has(key)) return null;
            store.set(key, value);
            return 'OK';
        }),
        exists: jest.fn(async (key: string) => (store.has(key) ? 1 : 0)),
        del: jest.fn(async () => 1),
        multi: jest.fn(() => multi),
    };
}

beforeEach(() => {
    jest.clearAllMocks();
    (isRedisConnected as jest.Mock).mockReturnValue(false);
    (getRedisClient as jest.Mock).mockReturnValue(null);
    db.diagnosticSession.findUnique.mockResolvedValue(sessionRow());
    db.diagnosticEvent.createMany.mockImplementation(async ({ data }: { data: unknown[] }) => ({ count: data.length }));
});

describe('ingestBatch', () => {
    it('returns gone for an unknown session', async () => {
        db.diagnosticSession.findUnique.mockResolvedValue(null);
        await expect(ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW })).resolves.toEqual({
            kind: 'gone',
            sessionState: 'missing',
        });
        expect(db.diagnosticEvent.createMany).not.toHaveBeenCalled();
    });

    it('returns gone once the upload grace after close has passed', async () => {
        db.diagnosticSession.findUnique.mockResolvedValue(sessionRow({ expiresAt: new Date(NOW - 25 * 3600_000) }));
        await expect(ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW })).resolves.toEqual({
            kind: 'gone',
            sessionState: 'closed',
        });
    });

    it('refuses a build from another environment', async () => {
        const env = envelope([event(1)], {
            app: { version: '1.1.4', build: '173', platform: 'ios', environment: 'development' },
        });
        await expect(ingestBatch({ envelope: env, deviceRef: DEVICE_REF, nowMs: NOW })).resolves.toEqual({
            kind: 'forbidden',
            reason: 'environment_mismatch',
        });
    });

    it('stores valid events idempotently and reports partial rejections', async () => {
        db.diagnosticEvent.createMany.mockResolvedValue({ count: 1 });
        const result = await ingestBatch({
            envelope: envelope([event(1), event(2), event(2), { eventId: 'bad' }, event(3, { type: 'be_poll' })]),
            deviceRef: DEVICE_REF,
            nowMs: NOW,
        });
        expect(db.diagnosticEvent.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
        const rows = db.diagnosticEvent.createMany.mock.calls[0][0].data;
        expect(rows).toHaveLength(2);
        expect(rows[0]).toMatchObject({
            sessionId: SESSION_ID,
            eventId: 'abcd-ef01-1',
            source: 'client',
            type: 'screen_focus',
            deviceRef: DEVICE_REF,
            recordedAt: new Date(NOW - 1000),
            payload: { seq: 1, priority: 'normal', data: { focused: true } },
        });
        expect(result).toMatchObject({ kind: 'ok', accepted: 1, duplicates: 1, sessionState: 'active' });
        if (result.kind !== 'ok') return;
        expect(result.rejected).toEqual([
            { eventId: 'abcd-ef01-2', reason: 'duplicate_in_batch' },
            { eventId: null, reason: 'invalid_event' },
            { eventId: 'abcd-ef01-3', reason: 'unknown_type' },
        ]);
        expect(db.diagnosticSession.update).toHaveBeenCalledWith({
            where: { id: SESSION_ID },
            data: { eventCount: { increment: 1 } },
        });
    });

    it('rejects events recorded after the session closed but still accepts earlier ones', async () => {
        db.diagnosticSession.findUnique.mockResolvedValue(
            sessionRow({ status: 'stopped', stoppedAt: new Date(NOW - 60 * 60_000) }),
        );
        const result = await ingestBatch({
            envelope: envelope([event(1, { wall: NOW - 61 * 60_000 }), event(2, { wall: NOW - 30 * 60_000 })]),
            deviceRef: DEVICE_REF,
            nowMs: NOW,
        });
        expect(result).toMatchObject({ kind: 'ok', accepted: 1, sessionState: 'stopped' });
        if (result.kind === 'ok') {
            expect(result.rejected).toEqual([{ eventId: 'abcd-ef01-2', reason: 'recorded_after_close' }]);
        }
    });

    it('keeps critical events first when the session event cap is reached', async () => {
        db.diagnosticSession.findUnique
            .mockResolvedValueOnce(sessionRow({ config: { maxEvents: 100 }, eventCount: 98 }))
            .mockResolvedValueOnce({ eventCount: 98 });
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
        if (result.kind === 'ok') expect(result.rejected).toEqual([{ eventId: 'abcd-ef01-1', reason: 'max_events' }]);
    });

    it('acknowledges a re-sent batch without inserting it again when Redis knows the batch', async () => {
        const redis = fakeRedis();
        (isRedisConnected as jest.Mock).mockReturnValue(true);
        (getRedisClient as jest.Mock).mockReturnValue(redis);

        const first = await ingestBatch({ envelope: envelope([event(1), event(2)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(first).toMatchObject({ kind: 'ok', accepted: 2, maxEventsRemaining: 998 });
        expect(redis.store.get(`diag:batch:${SESSION_ID}:batch-0001`)).toBe('1');
        expect(redis.store.get(`diag:sess:${SESSION_ID}:count`)).toBe('2');

        const second = await ingestBatch({ envelope: envelope([event(1), event(2)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(second).toMatchObject({ kind: 'ok', accepted: 0, duplicates: 2, maxEventsRemaining: 998 });
        expect(db.diagnosticEvent.createMany).toHaveBeenCalledTimes(1);
        // Session row and seed count on the first batch; both come from Redis afterwards.
        expect(db.diagnosticSession.findUnique).toHaveBeenCalledTimes(2);
    });

    it('seeds the Redis event counter from Postgres so a Redis restart keeps the cap', async () => {
        const redis = fakeRedis();
        (isRedisConnected as jest.Mock).mockReturnValue(true);
        (getRedisClient as jest.Mock).mockReturnValue(redis);
        db.diagnosticSession.findUnique
            .mockResolvedValueOnce(sessionRow({ config: { maxEvents: 100 } }))
            .mockResolvedValueOnce({ eventCount: 99 });

        const result = await ingestBatch({ envelope: envelope([event(1), event(2)]), deviceRef: DEVICE_REF, nowMs: NOW });
        expect(result).toMatchObject({ kind: 'ok', accepted: 1, sessionState: 'capped', maxEventsRemaining: 0 });
        expect(redis.store.get(`diag:sess:${SESSION_ID}:count`)).toBe('100');
    });

    it('propagates storage failures so the route can answer 503 and the client retries', async () => {
        db.diagnosticEvent.createMany.mockRejectedValue(new Error('connection lost'));
        await expect(
            ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW }),
        ).rejects.toThrow('connection lost');
    });

    it('still acknowledges stored events when counter bookkeeping fails', async () => {
        db.diagnosticSession.update.mockRejectedValue(new Error('deadlock'));
        db.diagnosticSessionDevice.updateMany.mockRejectedValue(new Error('deadlock'));
        await expect(
            ingestBatch({ envelope: envelope([event(1)]), deviceRef: DEVICE_REF, nowMs: NOW }),
        ).resolves.toMatchObject({ kind: 'ok', accepted: 1 });
    });
});
