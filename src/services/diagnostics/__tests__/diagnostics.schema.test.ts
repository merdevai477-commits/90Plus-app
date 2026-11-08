import {
    BACKEND_EVENT_TYPES,
    batchEnvelopeSchema,
    CLIENT_EVENT_TYPES,
    summarizeIssues,
    validateClientEvent,
} from '../diagnostics.schema';

const WALL = Date.UTC(2026, 10, 8, 20, 0, 0);

function event(type: string, data: unknown, extra: Record<string, unknown> = {}) {
    return { eventId: 'abcd-ef01-1', seq: 1, type, severity: 'info', wall: WALL, mono: 1234.5, data, ...extra };
}

function envelope(overrides: Record<string, unknown> = {}) {
    return {
        schemaVersion: 1,
        sessionId: '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d',
        batchId: 'batch-0001',
        deviceId: 'dev_ABCDEFGH1234',
        sentAtWall: WALL,
        sentAtMono: 5000,
        app: { version: '1.1.4', build: '173', platform: 'ios', environment: 'production' },
        events: [event('screen_focus', { focused: true })],
        ...overrides,
    };
}

describe('batchEnvelopeSchema', () => {
    it('accepts a minimal valid envelope', () => {
        expect(batchEnvelopeSchema.safeParse(envelope()).success).toBe(true);
    });

    it('rejects other schema versions, empty or oversized batches and bad ids', () => {
        expect(batchEnvelopeSchema.safeParse(envelope({ schemaVersion: 2 })).success).toBe(false);
        expect(batchEnvelopeSchema.safeParse(envelope({ events: [] })).success).toBe(false);
        expect(batchEnvelopeSchema.safeParse(envelope({ events: new Array(201).fill(event('screen_focus', { focused: true })) })).success).toBe(false);
        expect(batchEnvelopeSchema.safeParse(envelope({ sessionId: 'not-a-uuid' })).success).toBe(false);
        expect(batchEnvelopeSchema.safeParse(envelope({ deviceId: 'short' })).success).toBe(false);
    });

    it('reports issue paths and codes without echoing values', () => {
        const parsed = batchEnvelopeSchema.safeParse(envelope({ deviceId: 'secret value!' }));
        expect(parsed.success).toBe(false);
        if (parsed.success) return;
        const issues = summarizeIssues(parsed.error);
        expect(issues).toEqual([{ path: 'deviceId', code: expect.any(String) }]);
        expect(JSON.stringify(issues)).not.toContain('secret value');
    });
});

describe('validateClientEvent', () => {
    it('accepts a pipeline trace and keeps only contract fields', () => {
        const result = validateClientEvent(
            event(
                'pipeline_trace',
                {
                    source: 'ws',
                    decision: 'applied',
                    sigBefore: '2H|66|null|1-0',
                    sigIn: '2H|67|null|1-0',
                    recvWall: WALL,
                    recvMono: 1200,
                    commitMono: 1290,
                    // Not part of the contract: must be stripped, never stored.
                    fixture: { teams: { home: { name: 'Al Ahly' } } },
                    homeName: 'Al Ahly',
                },
                { fixtureId: 1234567, traceId: 'tr-abc123' },
            ),
        );
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.event.fixtureId).toBe(1234567);
        expect(result.event.traceId).toBe('tr-abc123');
        expect(result.event.priority).toBe('normal');
        expect(result.event.data).not.toHaveProperty('fixture');
        expect(result.event.data).not.toHaveProperty('homeName');
        expect(result.event.data).toMatchObject({ source: 'ws', decision: 'applied', commitMono: 1290 });
    });

    it('rejects backend-only and unknown event types sent by a client', () => {
        for (const type of [...BACKEND_EVENT_TYPES, 'made_up_type']) {
            expect(validateClientEvent(event(type, {}))).toEqual({
                ok: false,
                eventId: 'abcd-ef01-1',
                reason: 'unknown_type',
            });
        }
    });

    it('rejects free text and non-finite numbers in data', () => {
        expect(validateClientEvent(event('ws_state', { state: 'disconnect', reason: 'مرحبا "quoted"' }))).toMatchObject({
            ok: false,
            reason: 'invalid_data',
        });
        expect(validateClientEvent(event('js_stall', { host: 'sync', latenessMs: Infinity, expectedMs: 5000 }))).toMatchObject({
            ok: false,
            reason: 'invalid_data',
        });
    });

    it('rejects data over the per-event size limit', () => {
        const counters: Record<string, number> = {};
        for (let i = 0; i < 64; i += 1) counters[`counter_${String(i).padStart(2, '0')}_${'x'.repeat(36)}`] = 123456789.123;
        expect(validateClientEvent(event('session_summary', { counters }))).toMatchObject({
            ok: false,
            reason: 'data_too_large',
        });
    });

    it('rejects a malformed base event and only reports a safe event id', () => {
        expect(validateClientEvent({ eventId: '<script>', type: 'screen_focus' })).toEqual({
            ok: false,
            eventId: null,
            reason: 'invalid_event',
        });
        expect(validateClientEvent(event('screen_focus', { focused: true }, { severity: 'fatal' }))).toEqual({
            ok: false,
            eventId: 'abcd-ef01-1',
            reason: 'invalid_event',
        });
    });

    it('has a data schema for every client event type', () => {
        for (const type of CLIENT_EVENT_TYPES) {
            const result = validateClientEvent(event(type, {}));
            expect(result.ok ? 'ok' : result.reason).not.toBe('unknown_type');
        }
    });

    it('validates a sentry reference without messages', () => {
        const result = validateClientEvent(
            event('sentry_event_ref', {
                sentryEventId: 'a'.repeat(32),
                level: 'error',
                exceptionType: 'TypeError',
                message: 'user@example.com failed',
            }),
        );
        expect(result.ok).toBe(true);
        if (result.ok) expect(result.event.data).not.toHaveProperty('message');
    });
});
