jest.mock('../../../lib/prisma', () => {
    const prisma = {
        diagnosticSession: { updateMany: jest.fn(), deleteMany: jest.fn() },
        $executeRaw: jest.fn(),
    };
    return { __esModule: true, prisma, default: prisma };
});

import prisma from '../../../lib/prisma';
import { runDiagnosticsRetention } from '../diagnostics-retention.service';

const db = prisma as unknown as {
    diagnosticSession: { updateMany: jest.Mock; deleteMany: jest.Mock };
    $executeRaw: jest.Mock;
};

const NOW = Date.UTC(2026, 10, 8, 4, 45, 0);
const DAY = 24 * 60 * 60 * 1000;

describe('runDiagnosticsRetention', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        delete process.env.DIAG_RETENTION_DAYS;
        delete process.env.DIAG_SESSION_RETENTION_DAYS;
        db.diagnosticSession.updateMany.mockResolvedValue({ count: 2 });
        db.diagnosticSession.deleteMany.mockResolvedValue({ count: 1 });
    });

    it('deletes old events in bounded batches, then old closed sessions', async () => {
        db.$executeRaw.mockResolvedValueOnce(5000).mockResolvedValueOnce(5000).mockResolvedValueOnce(12);
        await expect(runDiagnosticsRetention(NOW)).resolves.toEqual({
            expiredSessions: 2,
            deletedEvents: 10_012,
            deletedSessions: 1,
        });
        expect(db.$executeRaw).toHaveBeenCalledTimes(3);
        expect(db.$executeRaw.mock.calls[0]).toContainEqual(new Date(NOW - 14 * DAY));
        expect(db.diagnosticSession.updateMany).toHaveBeenCalledWith({
            where: { status: 'active', expiresAt: { lt: new Date(NOW) } },
            data: { status: 'expired' },
        });
        expect(db.diagnosticSession.deleteMany).toHaveBeenCalledWith({
            where: { status: { not: 'active' }, createdAt: { lt: new Date(NOW - 30 * DAY) } },
        });
    });

    it('never keeps sessions for less time than their events', async () => {
        process.env.DIAG_RETENTION_DAYS = '20';
        process.env.DIAG_SESSION_RETENTION_DAYS = '5';
        db.$executeRaw.mockResolvedValue(0);
        await runDiagnosticsRetention(NOW);
        expect(db.diagnosticSession.deleteMany).toHaveBeenCalledWith({
            where: { status: { not: 'active' }, createdAt: { lt: new Date(NOW - 20 * DAY) } },
        });
    });
});
