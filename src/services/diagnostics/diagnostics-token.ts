import crypto from 'crypto';

/**
 * Privacy-safe references and session-scoped ingest tokens.
 *
 * Raw Clerk user ids and raw diagnostic device ids are never stored: only
 * keyed HMAC references, which cannot be reversed without DIAG_ID_SECRET.
 */

export type RefKind = 'device' | 'user';

export function computeRef(kind: RefKind, raw: string, idSecret: string): string {
    return crypto.createHmac('sha256', idSecret).update(`${kind}:${raw}`).digest('hex').slice(0, 32);
}

const TOKEN_VERSION = 'v1';

export interface IngestTokenClaims {
    sessionId: string;
    deviceRef: string;
    /** Unix seconds after which the token is rejected. */
    expSec: number;
}

function signature(payload: string, tokenSecret: string): string {
    return crypto.createHmac('sha256', tokenSecret).update(payload).digest('base64url');
}

export function signIngestToken(claims: IngestTokenClaims, tokenSecret: string): string {
    const payload = `${TOKEN_VERSION}.${claims.sessionId}.${claims.deviceRef}.${claims.expSec}`;
    return `${payload}.${signature(payload, tokenSecret)}`;
}

export type TokenVerification =
    | ({ ok: true } & IngestTokenClaims)
    | { ok: false; reason: 'malformed' | 'bad_signature' | 'expired' };

export function verifyIngestToken(token: string, tokenSecret: string, nowMs: number): TokenVerification {
    const parts = token.split('.');
    if (parts.length !== 5 || parts[0] !== TOKEN_VERSION) return { ok: false, reason: 'malformed' };
    const [, sessionId, deviceRef, expRaw, sig] = parts;
    const expSec = Number(expRaw);
    if (!sessionId || !deviceRef || !sig || !Number.isInteger(expSec)) return { ok: false, reason: 'malformed' };

    const expected = Buffer.from(signature(`${TOKEN_VERSION}.${sessionId}.${deviceRef}.${expRaw}`, tokenSecret));
    const provided = Buffer.from(sig);
    if (expected.length !== provided.length || !crypto.timingSafeEqual(expected, provided)) {
        return { ok: false, reason: 'bad_signature' };
    }
    if (nowMs > expSec * 1000) return { ok: false, reason: 'expired' };
    return { ok: true, sessionId, deviceRef, expSec };
}

/** Reads `Authorization: Diag <token>`; returns null when absent or another scheme. */
export function readDiagAuthorization(header: string | string[] | undefined): string | null {
    const raw = Array.isArray(header) ? header[0] : header;
    if (!raw) return null;
    const match = /^Diag\s+(\S+)$/.exec(raw.trim());
    return match ? match[1] : null;
}

export function timingSafeEqualString(a: string, b: string): boolean {
    const left = Buffer.from(a);
    const right = Buffer.from(b);
    return left.length === right.length && crypto.timingSafeEqual(left, right);
}
