import {
    computeRef,
    readDiagAuthorization,
    signIngestToken,
    timingSafeEqualString,
    verifyIngestToken,
} from '../diagnostics-token';

const TOKEN_SECRET = 't'.repeat(40);
const ID_SECRET = 'i'.repeat(40);
const NOW = Date.UTC(2026, 10, 8, 20, 0, 0);
const SESSION = '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d';

describe('computeRef', () => {
    it('is deterministic, 32 hex chars, and never contains the raw id', () => {
        const ref = computeRef('device', 'device-abc-123', ID_SECRET);
        expect(ref).toMatch(/^[a-f0-9]{32}$/);
        expect(computeRef('device', 'device-abc-123', ID_SECRET)).toBe(ref);
        expect(ref).not.toContain('device-abc-123');
    });

    it('separates device and user namespaces and depends on the secret', () => {
        expect(computeRef('device', 'same', ID_SECRET)).not.toBe(computeRef('user', 'same', ID_SECRET));
        expect(computeRef('user', 'same', ID_SECRET)).not.toBe(computeRef('user', 'same', 'x'.repeat(40)));
    });
});

describe('ingest token', () => {
    const claims = { sessionId: SESSION, deviceRef: 'a'.repeat(32), expSec: Math.floor(NOW / 1000) + 3600 };

    it('round-trips signed claims', () => {
        const token = signIngestToken(claims, TOKEN_SECRET);
        expect(verifyIngestToken(token, TOKEN_SECRET, NOW)).toEqual({ ok: true, ...claims });
    });

    it('rejects a token signed with another secret', () => {
        const token = signIngestToken(claims, 'z'.repeat(40));
        expect(verifyIngestToken(token, TOKEN_SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    });

    it('rejects tampered claims', () => {
        const token = signIngestToken(claims, TOKEN_SECRET);
        const tampered = token.replace(claims.deviceRef, 'b'.repeat(32));
        expect(verifyIngestToken(tampered, TOKEN_SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
        const extended = token.replace(String(claims.expSec), String(claims.expSec + 99999));
        expect(verifyIngestToken(extended, TOKEN_SECRET, NOW)).toEqual({ ok: false, reason: 'bad_signature' });
    });

    it('rejects expired tokens', () => {
        const token = signIngestToken(claims, TOKEN_SECRET);
        expect(verifyIngestToken(token, TOKEN_SECRET, claims.expSec * 1000 + 1)).toEqual({
            ok: false,
            reason: 'expired',
        });
    });

    it('rejects malformed tokens', () => {
        for (const token of ['', 'v1', 'v2.a.b.1.sig', `v1.${SESSION}.ref.notanumber.sig`, 'v1.a.b.1.sig.extra']) {
            expect(verifyIngestToken(token, TOKEN_SECRET, NOW)).toEqual({ ok: false, reason: 'malformed' });
        }
    });
});

describe('readDiagAuthorization', () => {
    it('reads only the Diag scheme', () => {
        expect(readDiagAuthorization('Diag abc.def')).toBe('abc.def');
        expect(readDiagAuthorization(['Diag x'])).toBe('x');
        expect(readDiagAuthorization('Bearer abc')).toBeNull();
        expect(readDiagAuthorization(undefined)).toBeNull();
    });
});

describe('timingSafeEqualString', () => {
    it('compares strings of any length without throwing', () => {
        expect(timingSafeEqualString('abc', 'abc')).toBe(true);
        expect(timingSafeEqualString('abc', 'abd')).toBe(false);
        expect(timingSafeEqualString('abc', 'abcd')).toBe(false);
    });
});
