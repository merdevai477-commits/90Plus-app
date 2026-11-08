/**
 * POST /api/diagnostics/events over real HTTP. Storage is mocked at the
 * ingest-service boundary; token verification, body limits, envelope
 * validation and rate limiting are the real implementations.
 */

import type { AddressInfo } from 'net';
import type { Server } from 'http';

jest.mock('../../services/diagnostics/diagnostics-ingest.service', () => ({
    ingestBatch: jest.fn(),
}));

import express from 'express';
import router from '../diagnostics-ingest.routes';
import { ingestBatch } from '../../services/diagnostics/diagnostics-ingest.service';
import { computeRef, signIngestToken } from '../../services/diagnostics/diagnostics-token';

const TOKEN_SECRET = 't'.repeat(40);
const ID_SECRET = 'i'.repeat(40);
const SESSION_ID = '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d';
const DEVICE_ID = 'dev_ABCDEFGH1234';

const mockedIngest = ingestBatch as jest.Mock;

function tokenFor(overrides: { sessionId?: string; deviceId?: string; expSec?: number; secret?: string } = {}) {
    return signIngestToken(
        {
            sessionId: overrides.sessionId ?? SESSION_ID,
            deviceRef: computeRef('device', overrides.deviceId ?? DEVICE_ID, ID_SECRET),
            expSec: overrides.expSec ?? Math.floor(Date.now() / 1000) + 3600,
        },
        overrides.secret ?? TOKEN_SECRET,
    );
}

function body(overrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1,
        sessionId: SESSION_ID,
        batchId: 'batch-0001',
        deviceId: DEVICE_ID,
        sentAtWall: Date.now(),
        app: { version: '1.1.4', build: '173', platform: 'ios', environment: 'production' },
        events: [{ eventId: 'abcd-ef01-1', seq: 1, type: 'screen_focus', severity: 'info', wall: Date.now(), data: { focused: true } }],
        ...overrides,
    };
}

async function startServer(routes: express.Router): Promise<{ server: Server; baseUrl: string }> {
    const app = express();
    app.use('/api/diagnostics/events', routes);
    const server = await new Promise<Server>((resolve) => {
        const s = app.listen(0, () => resolve(s));
    });
    const { port } = server.address() as AddressInfo;
    return { server, baseUrl: `http://127.0.0.1:${port}` };
}

function post(baseUrl: string, payload: unknown, token?: string | null, rawBody?: string) {
    return fetch(`${baseUrl}/api/diagnostics/events`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Diag ${token}` } : {}),
        },
        body: rawBody ?? JSON.stringify(payload),
    });
}

describe('POST /api/diagnostics/events', () => {
    let server: Server;
    let baseUrl: string;

    beforeAll(async () => {
        ({ server, baseUrl } = await startServer(router));
    });

    afterAll(async () => {
        await new Promise<void>((resolve) => server.close(() => resolve()));
    });

    beforeEach(() => {
        mockedIngest.mockReset();
        process.env.DIAGNOSTICS_ENABLED = '1';
        process.env.DIAG_TOKEN_SECRET = TOKEN_SECRET;
        process.env.DIAG_ID_SECRET = ID_SECRET;
    });

    afterEach(() => {
        delete process.env.DIAGNOSTICS_ENABLED;
        delete process.env.DIAG_TOKEN_SECRET;
        delete process.env.DIAG_ID_SECRET;
    });

    it('is invisible (404) while the master switch is off', async () => {
        delete process.env.DIAGNOSTICS_ENABLED;
        const res = await post(baseUrl, body(), tokenFor());
        expect(res.status).toBe(404);
        expect(mockedIngest).not.toHaveBeenCalled();
    });

    it('fails closed with 503 when the secrets are not configured', async () => {
        delete process.env.DIAG_TOKEN_SECRET;
        const res = await post(baseUrl, body(), tokenFor());
        expect(res.status).toBe(503);
        expect(res.headers.get('retry-after')).toBe('300');
    });

    it('requires a Diag token', async () => {
        const res = await post(baseUrl, body(), null);
        expect(res.status).toBe(401);
        await expect(res.json()).resolves.toEqual({ error: 'missing_token' });
    });

    it('rejects a forged token with 401 and an expired one with 410', async () => {
        const forged = await post(baseUrl, body(), tokenFor({ secret: 'z'.repeat(40) }));
        expect(forged.status).toBe(401);
        await expect(forged.json()).resolves.toEqual({ error: 'token_bad_signature' });

        const expired = await post(baseUrl, body(), tokenFor({ expSec: Math.floor(Date.now() / 1000) - 1 }));
        expect(expired.status).toBe(410);
    });

    it('answers 400 for malformed JSON and 413 above 256 KB', async () => {
        const malformed = await post(baseUrl, null, tokenFor(), '{"schemaVersion": 1,');
        expect(malformed.status).toBe(400);
        await expect(malformed.json()).resolves.toEqual({ error: 'invalid_json' });

        const huge = await post(baseUrl, body({ padding: 'x'.repeat(300 * 1024) }), tokenFor());
        expect(huge.status).toBe(413);
        expect(mockedIngest).not.toHaveBeenCalled();
    });

    it('answers 400 with issue paths for an invalid envelope', async () => {
        const res = await post(baseUrl, body({ schemaVersion: 7 }), tokenFor());
        expect(res.status).toBe(400);
        const json = (await res.json()) as { error: string; issues: Array<{ path: string }> };
        expect(json.error).toBe('invalid_envelope');
        expect(json.issues[0].path).toBe('schemaVersion');
    });

    it('binds the token to its session and device', async () => {
        const otherSession = await post(baseUrl, body(), tokenFor({ sessionId: '11111111-2222-4333-8444-555555555555' }));
        expect(otherSession.status).toBe(401);
        await expect(otherSession.json()).resolves.toEqual({ error: 'session_mismatch' });

        const otherDevice = await post(baseUrl, body(), tokenFor({ deviceId: 'dev_SOMEONEELSE99' }));
        expect(otherDevice.status).toBe(401);
        await expect(otherDevice.json()).resolves.toEqual({ error: 'device_mismatch' });
    });

    it('acknowledges a stored batch with server receive and send times for clock-offset estimation', async () => {
        mockedIngest.mockResolvedValue({
            kind: 'ok',
            accepted: 1,
            duplicates: 0,
            rejected: [],
            sessionState: 'active',
            maxEventsRemaining: 999,
        });
        const before = Date.now();
        const res = await post(baseUrl, body(), tokenFor());
        const after = Date.now();
        expect(res.status).toBe(200);
        expect(res.headers.get('cache-control')).toBe('no-store');
        const json = (await res.json()) as Record<string, number>;
        expect(json).toMatchObject({ ok: true, accepted: 1, sessionState: 'active', maxEventsRemaining: 999 });
        expect(json.serverRecvAt).toBeGreaterThanOrEqual(before);
        expect(json.serverSendAt).toBeGreaterThanOrEqual(json.serverRecvAt);
        expect(json.serverSendAt).toBeLessThanOrEqual(after);
        expect(mockedIngest).toHaveBeenCalledWith(
            expect.objectContaining({ deviceRef: computeRef('device', DEVICE_ID, ID_SECRET) }),
        );
    });

    it('maps closed sessions to 410 and environment mismatches to 403', async () => {
        mockedIngest.mockResolvedValueOnce({ kind: 'gone', sessionState: 'closed' });
        expect((await post(baseUrl, body(), tokenFor())).status).toBe(410);

        mockedIngest.mockResolvedValueOnce({ kind: 'forbidden', reason: 'environment_mismatch' });
        expect((await post(baseUrl, body(), tokenFor())).status).toBe(403);
    });

    it('answers 503 with Retry-After when storage fails, so the client keeps the batch', async () => {
        mockedIngest.mockRejectedValue(new Error('db down'));
        const res = await post(baseUrl, body(), tokenFor());
        expect(res.status).toBe(503);
        expect(res.headers.get('retry-after')).toBe('30');
        await expect(res.json()).resolves.toEqual({ error: 'storage_unavailable' });
    });
});

describe('POST /api/diagnostics/events rate limiting', () => {
    it('returns 429 with Retry-After once a token exceeds its per-minute limit', async () => {
        process.env.DIAGNOSTICS_ENABLED = '1';
        process.env.DIAG_TOKEN_SECRET = TOKEN_SECRET;
        process.env.DIAG_ID_SECRET = ID_SECRET;
        process.env.DIAG_INGEST_TOKEN_RATE_MAX = '2';
        let isolatedRouter: express.Router | undefined;
        jest.isolateModules(() => {
            isolatedRouter = require('../diagnostics-ingest.routes').default;
        });
        const { ingestBatch: isolatedIngest } = jest.requireMock('../../services/diagnostics/diagnostics-ingest.service');
        (isolatedIngest as jest.Mock).mockResolvedValue({
            kind: 'ok',
            accepted: 1,
            duplicates: 0,
            rejected: [],
            sessionState: 'active',
            maxEventsRemaining: 10,
        });

        const { server, baseUrl } = await startServer(isolatedRouter!);
        try {
            const token = tokenFor();
            expect((await post(baseUrl, body(), token)).status).toBe(200);
            expect((await post(baseUrl, body(), token)).status).toBe(200);
            const limited = await post(baseUrl, body(), token);
            expect(limited.status).toBe(429);
            expect(Number(limited.headers.get('retry-after'))).toBeGreaterThan(0);
            // A different device token has its own budget.
            expect((await post(baseUrl, body({ deviceId: 'dev_OTHERDEVICE01' }), tokenFor({ deviceId: 'dev_OTHERDEVICE01' }))).status).toBe(200);
        } finally {
            await new Promise<void>((resolve) => server.close(() => resolve()));
            delete process.env.DIAG_INGEST_TOKEN_RATE_MAX;
            delete process.env.DIAGNOSTICS_ENABLED;
            delete process.env.DIAG_TOKEN_SECRET;
            delete process.env.DIAG_ID_SECRET;
        }
    });
});
