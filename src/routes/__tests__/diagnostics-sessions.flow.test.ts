/**
 * Remote diagnostic session lifecycle over real HTTP: admin creates a
 * session, a targeted device receives a directive and token, uploads events,
 * the admin stops the session. Postgres is an in-memory fake that implements
 * only the Prisma calls the diagnostics services make; Redis is disabled, so
 * the Postgres fallbacks are what is exercised here.
 */

import type { AddressInfo } from 'net';
import type { Server } from 'http';

jest.mock('../../lib/prisma', () => {
    const { randomUUID } = require('crypto');
    type Row = Record<string, any>;
    const sessions: Row[] = [];
    const devices: Row[] = [];
    const events: Row[] = [];
    let eventSeq = 0;

    const pick = (row: Row, select?: Record<string, boolean>) =>
        select ? Object.fromEntries(Object.keys(select).filter((k) => select[k]).map((k) => [k, row[k]])) : { ...row };
    const applyData = (row: Row, data: Row) => {
        for (const [key, value] of Object.entries(data)) {
            if (value && typeof value === 'object' && 'increment' in value) row[key] = (row[key] ?? 0) + value.increment;
            else row[key] = value;
        }
    };
    const matches = (row: Row, where: Row = {}) =>
        Object.entries(where).every(([key, cond]) => {
            if (cond && typeof cond === 'object' && !(cond instanceof Date)) {
                if ('gt' in cond) return row[key] > cond.gt;
                if ('lt' in cond) return row[key] < cond.lt;
                if ('not' in cond) return row[key] !== cond.not;
            }
            return row[key] === cond;
        });

    const prisma: Row = {
        diagnosticSession: {
            create: async ({ data }: Row) => {
                const row = { id: randomUUID(), label: null, createdBy: null, eventCount: 0, stoppedAt: null, createdAt: new Date(), ...data };
                sessions.push(row);
                return { ...row };
            },
            findUnique: async ({ where, select }: Row) => {
                const row = sessions.find((s) => s.id === where.id);
                return row ? pick(row, select) : null;
            },
            findMany: async ({ where, take, include }: Row) =>
                sessions
                    .filter((row) => matches(row, where))
                    .sort((a, b) => b.createdAt - a.createdAt)
                    .slice(0, take ?? sessions.length)
                    .map((row) =>
                        include?._count
                            ? { ...row, _count: { devices: devices.filter((d) => d.sessionId === row.id).length } }
                            : { ...row },
                    ),
            update: async ({ where, data }: Row) => {
                const row = sessions.find((s) => s.id === where.id);
                if (!row) throw new Error('not found');
                applyData(row, data);
                return { ...row };
            },
            updateMany: async ({ where, data }: Row) => {
                const rows = sessions.filter((row) => matches(row, where));
                rows.forEach((row) => applyData(row, data));
                return { count: rows.length };
            },
        },
        diagnosticSessionDevice: {
            findUnique: async ({ where, select }: Row) => {
                const { sessionId, deviceRef } = where.sessionId_deviceRef;
                const row = devices.find((d) => d.sessionId === sessionId && d.deviceRef === deviceRef);
                return row ? pick(row, select) : null;
            },
            create: async ({ data }: Row) => {
                const row = { id: randomUUID(), eventCount: 0, ...data };
                devices.push(row);
                return { ...row };
            },
            update: async ({ where, data }: Row) => {
                const row = devices.find((d) => d.id === where.id)!;
                applyData(row, data);
                return { ...row };
            },
            updateMany: async ({ where, data }: Row) => {
                const rows = devices.filter((row) => matches(row, where));
                rows.forEach((row) => applyData(row, data));
                return { count: rows.length };
            },
            count: async ({ where }: Row) => devices.filter((row) => matches(row, where)).length,
            findMany: async ({ where, select }: Row) => devices.filter((row) => matches(row, where)).map((row) => pick(row, select)),
        },
        diagnosticEvent: {
            createMany: async ({ data, skipDuplicates }: Row) => {
                let count = 0;
                for (const row of data) {
                    if (events.some((e) => e.sessionId === row.sessionId && e.eventId === row.eventId)) {
                        if (!skipDuplicates) throw new Error('unique violation');
                        continue;
                    }
                    events.push({ id: ++eventSeq, receivedAt: new Date(), ...row });
                    count += 1;
                }
                return { count };
            },
        },
        user: { findUnique: async () => null },
        $queryRaw: async () => [],
    };
    prisma.$transaction = async (fn: (tx: Row) => unknown) => fn(prisma);
    return { __esModule: true, prisma, default: prisma, __fake: { sessions, devices, events } };
});
jest.mock('../../middleware/clerk.middleware', () => ({
    optionalAuth: (req: any, _res: any, next: any) => {
        if (req.headers['x-test-user']) req.auth = { userId: req.headers['x-test-user'] };
        next();
    },
    requireAuth: (req: any, res: any, next: any) => {
        if (!req.headers['x-test-user']) {
            res.status(401).json({ status: 'ERROR' });
            return;
        }
        req.auth = { userId: req.headers['x-test-user'] };
        next();
    },
}));
jest.mock('../../middleware/admin.middleware', () => ({
    requireAdmin: (req: any, res: any, next: any) => {
        if (req.auth?.userId !== 'user_dev') {
            res.status(403).json({ status: 'ERROR' });
            return;
        }
        req.adminUser = { id: 'internal-dev-id', isDeveloper: true };
        next();
    },
}));

import express from 'express';
import ingestRoutes from '../diagnostics-ingest.routes';
import directiveRoutes from '../diagnostics.routes';
import adminRoutes from '../diagnostics-admin.routes';
import { verifyIngestToken } from '../../services/diagnostics/diagnostics-token';

const { __fake: fake } = jest.requireMock('../../lib/prisma') as {
    __fake: { sessions: Array<Record<string, any>>; devices: Array<Record<string, any>>; events: Array<Record<string, any>> };
};

const ADMIN_KEY = 'k'.repeat(48);
const TOKEN_SECRET = 't'.repeat(40);
const DEVICE_A = 'devA_1234567890';
const DEVICE_B = 'devB_1234567890';

// jest runs with NODE_ENV=test, so the server-side diagnostics environment is "development".
const APP = { version: '1.1.4', build: '173', platform: 'ios', environment: 'development', channel: 'diagnostic' };

let server: Server;
let baseUrl: string;

beforeAll(async () => {
    process.env.DIAGNOSTICS_ENABLED = '1';
    process.env.DIAGNOSTICS_ADMIN_KEY = ADMIN_KEY;
    process.env.DIAG_TOKEN_SECRET = TOKEN_SECRET;
    process.env.DIAG_ID_SECRET = 'i'.repeat(40);

    const app = express();
    app.use('/api/diagnostics/events', ingestRoutes);
    app.use(express.json());
    app.use('/api/diagnostics/admin', adminRoutes);
    app.use('/api/diagnostics', directiveRoutes);
    server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    for (const key of ['DIAGNOSTICS_ENABLED', 'DIAGNOSTICS_ADMIN_KEY', 'DIAG_TOKEN_SECRET', 'DIAG_ID_SECRET']) {
        delete process.env[key];
    }
});

async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
    const res = await fetch(`${baseUrl}${path}`, {
        method,
        headers: { 'Content-Type': 'application/json', ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
    });
    const json = (await res.json().catch(() => null)) as any;
    return { status: res.status, json };
}

const admin = (method: string, path: string, body?: unknown) =>
    call(method, `/api/diagnostics/admin${path}`, body, { 'x-diagnostics-admin-key': ADMIN_KEY });

const directive = (deviceId: string, app: Record<string, unknown> = {}) =>
    call('POST', '/api/diagnostics/directive', { schemaVersion: 1, deviceId, app: { ...APP, ...app } });

function batch(sessionId: string, deviceId: string, batchId: string, seqs: number[], wall = Date.now() - 1000) {
    return {
        schemaVersion: 1,
        sessionId,
        batchId,
        deviceId,
        sentAtWall: Date.now(),
        app: APP,
        events: seqs.map((seq) => ({
            eventId: `${sessionId.slice(0, 4)}-${deviceId.slice(0, 4)}-${seq}`,
            seq,
            type: 'screen_focus',
            severity: 'info',
            wall,
            data: { focused: true },
        })),
    };
}

const ingest = (token: string, body: unknown) =>
    call('POST', '/api/diagnostics/events', body, { Authorization: `Diag ${token}` });

describe('diagnostics admin access', () => {
    it('requires the admin key or a developer account', async () => {
        expect((await call('GET', '/api/diagnostics/admin/sessions')).status).toBe(401);
        expect((await call('GET', '/api/diagnostics/admin/sessions', undefined, { 'x-diagnostics-admin-key': 'wrong' })).status).toBe(401);
        expect((await call('GET', '/api/diagnostics/admin/sessions', undefined, { 'x-test-user': 'user_regular' })).status).toBe(403);
        expect((await call('GET', '/api/diagnostics/admin/sessions', undefined, { 'x-test-user': 'user_dev' })).status).toBe(200);
    });

    it('reports configuration as booleans without exposing secret values', async () => {
        const { status, json } = await admin('GET', '/status');
        expect(status).toBe(200);
        expect(json).toMatchObject({ enabled: true, secretsConfigured: true, adminKeyConfigured: true, redisConnected: false });
        expect(JSON.stringify(json)).not.toContain(ADMIN_KEY);
        expect(JSON.stringify(json)).not.toContain(TOKEN_SECRET);
    });

    it('validates session ids and create requests', async () => {
        expect((await admin('POST', '/sessions/not-a-uuid/stop')).status).toBe(400);
        expect((await admin('POST', '/sessions', { durationMin: 500, target: { buildNumbers: ['173'] } })).status).toBe(400);
    });
});

describe('remote diagnostic session lifecycle', () => {
    let sessionId = '';
    let tokenA = '';

    it('creates a bounded session for one iOS build and one device', async () => {
        const { status, json } = await admin('POST', '/sessions', {
            label: 'TestFlight 173',
            durationMin: 30,
            target: { platform: 'ios', buildNumbers: ['173'] },
            config: { maxDevices: 1, maxEvents: 500 },
        });
        expect(status).toBe(201);
        sessionId = json.session.id;
        expect(json.session).toMatchObject({ state: 'active', environment: 'development', createdBy: 'admin_key' });
        expect(json.session.config).toMatchObject({ maxDevices: 1, maxEvents: 500 });
    });

    it('does not enrol builds outside the target', async () => {
        expect((await directive(DEVICE_A, { build: '172' })).json).toMatchObject({ active: false });
        expect((await directive(DEVICE_A, { platform: 'android' })).json).toMatchObject({ active: false });
        expect((await directive(DEVICE_A, { environment: 'production' })).json).toMatchObject({ active: false });
        expect(fake.devices).toHaveLength(0);
    });

    it('enrols the targeted device with a session token, features and expiry', async () => {
        const { status, json } = await directive(DEVICE_A);
        expect(status).toBe(200);
        expect(json).toMatchObject({ active: true, sessionId, config: { maxEvents: 500 } });
        expect(json.config.features).toMatchObject({ pipeline: true, clock: true });
        expect(json.expiresInMs).toBeGreaterThan(29 * 60_000);
        expect(json.expiresInMs).toBeLessThanOrEqual(30 * 60_000);
        const verified = verifyIngestToken(json.token, TOKEN_SECRET, Date.now());
        expect(verified).toMatchObject({ ok: true, sessionId });
        // Upload window: session expiry plus 24h grace.
        if (verified.ok) expect(verified.expSec * 1000).toBeGreaterThanOrEqual(json.expiresAt + 24 * 3600_000);
        tokenA = json.token;
        expect(fake.devices).toHaveLength(1);
        expect(JSON.stringify(fake.devices[0])).not.toContain(DEVICE_A);
    });

    it('enforces maxDevices but lets an enrolled device rejoin', async () => {
        expect((await directive(DEVICE_B)).json).toMatchObject({ active: false });
        const again = await directive(DEVICE_A);
        expect(again.json).toMatchObject({ active: true, sessionId });
        expect(fake.devices).toHaveLength(1);
    });

    it('stores uploaded events once, even when a batch is re-sent', async () => {
        const body = batch(sessionId, DEVICE_A, 'batch-a-0001', [1, 2]);
        const first = await ingest(tokenA, body);
        expect(first.status).toBe(200);
        expect(first.json).toMatchObject({ accepted: 2, duplicates: 0, sessionState: 'active', maxEventsRemaining: 498 });

        const resent = await ingest(tokenA, body);
        expect(resent.json).toMatchObject({ accepted: 0, duplicates: 2 });
        expect(fake.events.filter((e) => e.sessionId === sessionId)).toHaveLength(2);
    });

    it('does not let another device upload with this token', async () => {
        const res = await ingest(tokenA, batch(sessionId, DEVICE_B, 'batch-b-0001', [1]));
        expect(res.status).toBe(401);
        expect(res.json).toEqual({ error: 'device_mismatch' });
    });

    it('shows device and event counts to the admin', async () => {
        const list = await admin('GET', '/sessions');
        const item = list.json.sessions.find((s: { id: string }) => s.id === sessionId);
        expect(item).toMatchObject({ state: 'active', deviceCount: 1, eventCount: 2 });

        const devices = await admin('GET', `/sessions/${sessionId}/devices`);
        expect(devices.json.devices).toHaveLength(1);
        expect(devices.json.devices[0]).toMatchObject({ platform: 'ios', buildNumber: '173', channel: 'diagnostic', eventCount: 2 });
    });

    it('stops on admin request: no new enrolment, late uploads of earlier events still accepted', async () => {
        const stopped = await admin('POST', `/sessions/${sessionId}/stop`);
        expect(stopped.json.session).toMatchObject({ state: 'stopped' });

        expect((await directive(DEVICE_A)).json).toMatchObject({ active: false });

        const late = await ingest(tokenA, batch(sessionId, DEVICE_A, 'batch-a-0002', [3]));
        expect(late.json).toMatchObject({ accepted: 1, sessionState: 'stopped' });

        const afterStop = await ingest(
            tokenA,
            batch(sessionId, DEVICE_A, 'batch-a-0003', [4], Date.now() + 10 * 60_000),
        );
        expect(afterStop.json).toMatchObject({ accepted: 0 });
        expect(afterStop.json.rejected).toEqual([{ eventId: expect.any(String), reason: 'recorded_after_close' }]);
    });

    it('stops enrolling once a session has expired', async () => {
        const created = await admin('POST', '/sessions', { durationMin: 5, target: { buildNumbers: ['173'] } });
        expect((await directive(DEVICE_B)).json).toMatchObject({ active: true, sessionId: created.json.session.id });

        const row = fake.sessions.find((s) => s.id === created.json.session.id)!;
        row.expiresAt = new Date(Date.now() - 1000);
        expect((await directive(DEVICE_B)).json).toMatchObject({ active: false });
        const detail = await admin('GET', `/sessions/${row.id}`);
        expect(detail.json.session.state).toBe('expired');
    });

    it('stops enrolling once the session event cap is reached', async () => {
        const created = await admin('POST', '/sessions', {
            target: { buildNumbers: ['173'] },
            config: { maxEvents: 100, maxDevices: 5 },
        });
        const row = fake.sessions.find((s) => s.id === created.json.session.id)!;
        row.eventCount = 100;
        expect((await directive('devC_1234567890')).json).toMatchObject({ active: false });
    });
});

describe('master switch', () => {
    it('hides every diagnostics route while DIAGNOSTICS_ENABLED is off', async () => {
        delete process.env.DIAGNOSTICS_ENABLED;
        try {
            expect((await directive(DEVICE_A)).status).toBe(404);
            expect((await admin('GET', '/sessions')).status).toBe(404);
            expect((await ingest('v1.x.y.1.z', batch('0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d', DEVICE_A, 'batch-x-0001', [1]))).status).toBe(404);
        } finally {
            process.env.DIAGNOSTICS_ENABLED = '1';
        }
    });
});
