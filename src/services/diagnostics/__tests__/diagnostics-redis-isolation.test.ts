import {
    describeDiagnosticRedis,
    diagRedis,
    guardDiagnosticTestProcess,
    resetDiagnosticRedisForTests,
} from '../diagnostics-redis';

describe('diagnostic redis isolation', () => {
    const previous = {
        NODE_ENV: process.env.NODE_ENV,
        REDIS_URL: process.env.REDIS_URL,
        DIAG_REDIS_URL: process.env.DIAG_REDIS_URL,
        DIAG_REDIS_ALLOW_PRODUCTION: process.env.DIAG_REDIS_ALLOW_PRODUCTION,
    };

    afterEach(() => {
        process.env.NODE_ENV = previous.NODE_ENV;
        if (previous.REDIS_URL === undefined) delete process.env.REDIS_URL;
        else process.env.REDIS_URL = previous.REDIS_URL;
        if (previous.DIAG_REDIS_URL === undefined) delete process.env.DIAG_REDIS_URL;
        else process.env.DIAG_REDIS_URL = previous.DIAG_REDIS_URL;
        if (previous.DIAG_REDIS_ALLOW_PRODUCTION === undefined) delete process.env.DIAG_REDIS_ALLOW_PRODUCTION;
        else process.env.DIAG_REDIS_ALLOW_PRODUCTION = previous.DIAG_REDIS_ALLOW_PRODUCTION;
        resetDiagnosticRedisForTests();
    });

    it('does not use REDIS_URL when DIAG_REDIS_URL is unset', () => {
        process.env.NODE_ENV = 'test';
        process.env.REDIS_URL = 'redis://production.example:6379';
        delete process.env.DIAG_REDIS_URL;
        expect(describeDiagnosticRedis()).toMatchObject({ mode: 'disabled', host: null });
        expect(diagRedis()).toBeNull();
        expect(describeDiagnosticRedis().reason).not.toContain('production.example');
    });

    it('refuses a local process whose diagnostic URL is the application Redis', () => {
        process.env.NODE_ENV = 'test';
        process.env.REDIS_URL = 'redis://:secret@production.example:6379/0';
        process.env.DIAG_REDIS_URL = 'redis://:other-secret@production.example:6379/1';
        const description = describeDiagnosticRedis();
        expect(description.mode).toBe('refused');
        expect(description.host).toBe('production.example');
        expect(JSON.stringify(description)).not.toContain('secret');
        expect(diagRedis()).toBeNull();
        expect(() => guardDiagnosticTestProcess()).toThrow(/Refusing the connection/);
    });

    it('allows the same host only when the operator opts in', () => {
        process.env.NODE_ENV = 'test';
        process.env.REDIS_URL = 'redis://production.example:6379';
        process.env.DIAG_REDIS_URL = 'redis://production.example:6379';
        process.env.DIAG_REDIS_ALLOW_PRODUCTION = '1';
        expect(describeDiagnosticRedis().mode).toBe('isolated');
        expect(() => guardDiagnosticTestProcess()).not.toThrow();
    });
});
