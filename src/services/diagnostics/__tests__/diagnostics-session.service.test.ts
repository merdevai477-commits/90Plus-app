jest.mock('../../../lib/prisma', () => {
    const prisma = {
        diagnosticSession: { create: jest.fn(), findMany: jest.fn(), findUnique: jest.fn(), updateMany: jest.fn() },
        user: { findUnique: jest.fn() },
    };
    return { __esModule: true, prisma, default: prisma };
});

import prisma from '../../../lib/prisma';
import { computeRef } from '../diagnostics-token';
import {
    createSession,
    createSessionRequestSchema,
    effectiveSessionState,
    matchesTarget,
    toSessionSnapshot,
    type TargetContext,
} from '../diagnostics-session.service';

const db = prisma as unknown as {
    diagnosticSession: { create: jest.Mock; findMany: jest.Mock; findUnique: jest.Mock; updateMany: jest.Mock };
    user: { findUnique: jest.Mock };
};

const SECRETS = { tokenSecret: 't'.repeat(40), idSecret: 'i'.repeat(40) };
const NOW = Date.UTC(2026, 10, 8, 20, 0, 0);
const DEVICE_REF = 'a'.repeat(32);
const USER_REF = 'b'.repeat(32);

const ctx = (overrides: Partial<TargetContext> = {}): TargetContext => ({
    platform: 'ios',
    build: '173',
    version: '1.1.4',
    deviceRef: DEVICE_REF,
    userRef: null,
    ...overrides,
});

describe('matchesTarget', () => {
    it('never matches a target without a build, version, device or user selector', () => {
        expect(matchesTarget({}, ctx())).toBe(false);
        expect(matchesTarget({ platform: 'ios' }, ctx())).toBe(false);
    });

    it('requires every configured selector to match', () => {
        expect(matchesTarget({ platform: 'ios', buildNumbers: ['173'] }, ctx())).toBe(true);
        expect(matchesTarget({ platform: 'android', buildNumbers: ['173'] }, ctx())).toBe(false);
        expect(matchesTarget({ buildNumbers: ['172', '174'] }, ctx())).toBe(false);
        expect(matchesTarget({ appVersion: '1.1.4', buildNumbers: ['173'] }, ctx())).toBe(true);
        expect(matchesTarget({ appVersion: '1.1.5' }, ctx())).toBe(false);
        expect(matchesTarget({ deviceRefs: [DEVICE_REF] }, ctx())).toBe(true);
        expect(matchesTarget({ deviceRefs: ['c'.repeat(32)] }, ctx())).toBe(false);
    });

    it('does not match a user target for signed-out devices', () => {
        expect(matchesTarget({ userRefs: [USER_REF] }, ctx())).toBe(false);
        expect(matchesTarget({ userRefs: [USER_REF] }, ctx({ userRef: USER_REF }))).toBe(true);
    });
});

describe('effectiveSessionState', () => {
    const row = {
        id: 's',
        label: null,
        status: 'active',
        environment: 'production',
        target: { buildNumbers: ['173'] },
        config: {},
        startsAt: new Date(NOW - 60_000),
        expiresAt: new Date(NOW + 60_000),
        stoppedAt: null,
        eventCount: 0,
    };

    it('derives expiry from expiresAt even before the retention job marks it', () => {
        const snapshot = toSessionSnapshot(row);
        expect(effectiveSessionState(snapshot, NOW)).toBe('active');
        expect(effectiveSessionState(snapshot, NOW + 60_000)).toBe('expired');
        expect(effectiveSessionState(toSessionSnapshot({ ...row, status: 'stopped' }), NOW)).toBe('stopped');
    });

    it('fills config defaults and treats an unreadable target as matching nothing', () => {
        const snapshot = toSessionSnapshot({ ...row, target: { buildNumbers: 'bad' } });
        expect(snapshot.config).toMatchObject({ maxEvents: 20_000, maxDevices: 3 });
        expect(snapshot.config.features.pipeline).toBe(true);
        expect(matchesTarget(snapshot.target, ctx())).toBe(false);
    });
});

describe('createSession', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        db.diagnosticSession.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
            id: '0d6c8a52-2f6f-4f0e-9c1a-6f3e1b2a4c5d',
            eventCount: 0,
            stoppedAt: null,
            ...data,
        }));
    });

    it('applies bounded defaults: 30 minutes, 3 devices, 20000 events', async () => {
        const input = createSessionRequestSchema.parse({ target: { platform: 'ios', buildNumbers: ['173'] } });
        const result = await createSession(input, SECRETS, 'admin_key', NOW);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.session.expiresAt).toBe(NOW + 30 * 60_000);
        expect(result.session.config).toMatchObject({ maxDevices: 3, maxEvents: 20_000 });
        expect(result.session.config.sampling.selectorTiming).toBe(0.1);
    });

    it('rejects durations above the 120 minute cap and device caps above 10', () => {
        expect(createSessionRequestSchema.safeParse({ durationMin: 121, target: { buildNumbers: ['1'] } }).success).toBe(false);
        expect(
            createSessionRequestSchema.safeParse({ target: { buildNumbers: ['1'] }, config: { maxDevices: 11 } }).success,
        ).toBe(false);
    });

    it('stores only HMAC user references, never the raw user ids', async () => {
        db.user.findUnique.mockResolvedValue({ clerkUserId: 'user_fromInternalId' });
        const input = createSessionRequestSchema.parse({
            target: { userIds: ['user_2abcDEF', 'internal-user-uuid-1'] },
        });
        const result = await createSession(input, SECRETS, 'admin_key', NOW);
        expect(result.ok).toBe(true);
        const stored = db.diagnosticSession.create.mock.calls[0][0].data.target;
        expect(stored).toEqual({
            userRefs: [
                computeRef('user', 'user_2abcDEF', SECRETS.idSecret),
                computeRef('user', 'user_fromInternalId', SECRETS.idSecret),
            ],
        });
        expect(JSON.stringify(stored)).not.toContain('user_2abcDEF');
        expect(JSON.stringify(stored)).not.toContain('internal-user-uuid-1');
    });

    it('refuses a target that would match every device', async () => {
        const input = createSessionRequestSchema.parse({ target: { platform: 'ios' } });
        await expect(createSession(input, SECRETS, 'admin_key', NOW)).resolves.toEqual({
            ok: false,
            error: 'invalid_target',
        });
        expect(db.diagnosticSession.create).not.toHaveBeenCalled();
    });

    it('reports unknown users instead of creating an unreachable session', async () => {
        db.user.findUnique.mockResolvedValue(null);
        const input = createSessionRequestSchema.parse({ target: { userIds: ['missing-user'] } });
        await expect(createSession(input, SECRETS, 'admin_key', NOW)).resolves.toEqual({
            ok: false,
            error: 'user_not_found',
        });
    });
});
