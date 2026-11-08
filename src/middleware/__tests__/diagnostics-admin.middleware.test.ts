jest.mock('../clerk.middleware', () => ({
    requireAuth: jest.fn((req: any, res: any, next: any) => {
        if (!req.headers['x-test-user']) {
            res.status(401).json({ status: 'ERROR' });
            return;
        }
        req.auth = { userId: req.headers['x-test-user'] };
        next();
    }),
}));
jest.mock('../admin.middleware', () => ({
    requireAdmin: jest.fn((req: any, res: any, next: any) => {
        if (req.auth?.userId !== 'user_dev') {
            res.status(403).json({ status: 'ERROR' });
            return;
        }
        req.adminUser = { id: 'internal-dev-id', isDeveloper: true };
        next();
    }),
}));

import type { NextFunction, Request, Response } from 'express';
import { requireDiagnosticsAdmin } from '../diagnostics-admin.middleware';

const ADMIN_KEY = 'k'.repeat(48);

function run(headers: Record<string, string>) {
    const req = { headers } as unknown as Request;
    const res = {
        statusCode: 200,
        body: undefined as unknown,
        locals: {} as Record<string, unknown>,
        status(code: number) {
            this.statusCode = code;
            return this;
        },
        json(body: unknown) {
            this.body = body;
            return this;
        },
    };
    const next = jest.fn() as unknown as NextFunction;
    requireDiagnosticsAdmin(req, res as unknown as Response, next);
    return { res, next: next as unknown as jest.Mock };
}

describe('requireDiagnosticsAdmin', () => {
    afterEach(() => {
        delete process.env.DIAGNOSTICS_ADMIN_KEY;
    });

    it('accepts the configured admin key', () => {
        process.env.DIAGNOSTICS_ADMIN_KEY = ADMIN_KEY;
        const { res, next } = run({ 'x-diagnostics-admin-key': ADMIN_KEY });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.locals.diagAdmin).toEqual({ kind: 'admin_key', userId: null });
    });

    it('rejects a wrong key without falling back to Clerk', () => {
        process.env.DIAGNOSTICS_ADMIN_KEY = ADMIN_KEY;
        const { res, next } = run({ 'x-diagnostics-admin-key': 'k'.repeat(47), 'x-test-user': 'user_dev' });
        expect(next).not.toHaveBeenCalled();
        expect(res.statusCode).toBe(401);
        expect(res.body).toEqual({ error: 'invalid_admin_key' });
    });

    it('rejects any key while no key (or a key under 32 chars) is configured', () => {
        expect(run({ 'x-diagnostics-admin-key': ADMIN_KEY }).res.statusCode).toBe(401);
        process.env.DIAGNOSTICS_ADMIN_KEY = 'short-key';
        expect(run({ 'x-diagnostics-admin-key': 'short-key' }).res.statusCode).toBe(401);
    });

    it('falls back to a signed-in developer account', () => {
        const { res, next } = run({ 'x-test-user': 'user_dev' });
        expect(next).toHaveBeenCalledTimes(1);
        expect(res.locals.diagAdmin).toEqual({ kind: 'developer', userId: 'internal-dev-id' });
    });

    it('rejects anonymous and non-developer callers', () => {
        expect(run({}).res.statusCode).toBe(401);
        const nonDev = run({ 'x-test-user': 'user_regular' });
        expect(nonDev.res.statusCode).toBe(403);
        expect(nonDev.next).not.toHaveBeenCalled();
    });
});
