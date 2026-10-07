jest.mock('../../lib/prisma', () => ({
    __esModule: true,
    default: { favoriteMatch: { findMany: jest.fn().mockResolvedValue([]) } },
}));
jest.mock('../football.service', () => ({
    footballService: { getFixtures: jest.fn().mockResolvedValue([]), isConfigured: () => true },
    isFootballQuotaExhausted: () => false,
}));
jest.mock('../websocket.service', () => ({ WebSocketService: { sendMatchUpdate: jest.fn() } }));
jest.mock('../prediction-resolver.service', () => ({
    PredictionResolverService: { resolveMatchPredictions: jest.fn() },
}));
jest.mock('../football-sync-leader.service', () => ({
    withSyncLeaderLease: jest.fn().mockResolvedValue({ acquired: false }),
}));
jest.mock('../api-football-quota.service', () => ({ isPurposeAllowed: () => true }));
jest.mock('../live-fixture-cache.service', () => ({
    writeLiveFixturesSnapshot: jest.fn(),
    writeTerminalFixtureSnapshot: jest.fn(),
    readLiveFixturesList: jest.fn().mockResolvedValue([]),
    readTerminalFixturesForIds: jest.fn().mockResolvedValue([]),
    isNsNearKickoff: () => false,
}));
jest.mock('../live-match-ingestor.service', () => ({
    __esModule: true,
    default: { triggerFixtureIngest: jest.fn() },
}));
jest.mock('../football-data-cache.service', () => ({
    footballDataCacheService: {
        invalidateFixtureDetailCaches: jest.fn().mockResolvedValue(undefined),
        invalidateMatchesByDateCache: jest.fn().mockResolvedValue(undefined),
        warmLiveFixtureDetails: jest.fn().mockResolvedValue(undefined),
    },
}));
jest.mock('../live-fixture-event-push.service', () => ({
    pushLiveFixtureEventDelta: jest.fn().mockResolvedValue(undefined),
    resetPushedEventsForFixture: jest.fn(),
}));
jest.mock('../synthetic-goals.service', () => ({
    reconcileSyntheticGoals: jest.fn().mockResolvedValue(undefined),
}));

import { liveFixtureSyncService } from '../live-fixture-sync.service';
import { WebSocketService } from '../websocket.service';

const MINUTE = 60_000;

function liveFixture(id: number, elapsed: number, home = 0, away = 0) {
    return {
        fixture: { id, date: '2026-10-08T18:00:00+00:00', status: { short: '2H', elapsed, extra: null } },
        goals: { home, away },
    };
}

const svc = liveFixtureSyncService as unknown as {
    processLiveFixtures(f: unknown[]): Promise<void>;
    pruneStaleLiveState(now: number): void;
    getLiveStateSizes(): { snapshots: number; eventPushStamps: number };
    stop(): void;
};

describe('live fixture sync state pruning', () => {
    let now = Date.parse('2026-10-08T18:00:00Z');

    beforeEach(() => {
        svc.stop();
        now = Date.parse('2026-10-08T18:00:00Z');
        jest.spyOn(Date, 'now').mockImplementation(() => now);
        (WebSocketService.sendMatchUpdate as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('drops fixtures that left the live feed more than 30 minutes ago', async () => {
        await svc.processLiveFixtures([liveFixture(1, 60), liveFixture(2, 60)]);
        expect(svc.getLiveStateSizes()).toEqual({ snapshots: 2, eventPushStamps: 2 });

        // Fixture 2 disappears without ever confirming FT; fixture 1 keeps playing.
        for (let m = 1; m <= 31; m += 1) {
            now += MINUTE;
            await svc.processLiveFixtures([liveFixture(1, 60 + m)]);
        }
        svc.pruneStaleLiveState(now);

        expect(svc.getLiveStateSizes()).toEqual({ snapshots: 1, eventPushStamps: 1 });
    });

    it('keeps a fixture that only blipped out of the feed, so it is not re-announced', async () => {
        await svc.processLiveFixtures([liveFixture(3, 70, 1, 0)]);
        now += 5 * MINUTE;
        await svc.processLiveFixtures([]);
        svc.pruneStaleLiveState(now);
        expect(svc.getLiveStateSizes().snapshots).toBe(1);

        (WebSocketService.sendMatchUpdate as jest.Mock).mockClear();
        now += MINUTE;
        await svc.processLiveFixtures([liveFixture(3, 70, 1, 0)]);
        expect(WebSocketService.sendMatchUpdate).not.toHaveBeenCalled();
    });

    it('releases throttle stamps whose snapshot was cleared at full time', async () => {
        await svc.processLiveFixtures([liveFixture(4, 88)]);
        (svc as unknown as { lastSnapshots: Map<number, unknown> }).lastSnapshots.delete(4);
        now += 2 * MINUTE;
        svc.pruneStaleLiveState(now);
        expect(svc.getLiveStateSizes()).toEqual({ snapshots: 0, eventPushStamps: 0 });
    });

    it('prunes at most once a minute', async () => {
        const start = now;
        await svc.processLiveFixtures([liveFixture(5, 10)]);

        svc.pruneStaleLiveState(start + 29.5 * MINUTE);
        expect(svc.getLiveStateSizes().snapshots).toBe(1);

        // Stale now, but the previous pass was under a minute ago.
        svc.pruneStaleLiveState(start + 30.2 * MINUTE);
        expect(svc.getLiveStateSizes().snapshots).toBe(1);

        svc.pruneStaleLiveState(start + 30.6 * MINUTE);
        expect(svc.getLiveStateSizes().snapshots).toBe(0);
    });
});
