import {
  fixtureEventDedupeKey,
  pushLiveFixtureEventDelta,
  resetPushedEventsForFixture,
} from '../live-fixture-event-push.service';
import WebSocketService from '../websocket.service';
import { footballDataCacheService } from '../football-data-cache.service';

jest.mock('../football-data-cache.service', () => ({
  footballDataCacheService: {
    getMatchEvents: jest.fn(),
  },
}));

jest.mock('../websocket.service', () => ({
  __esModule: true,
  default: {
    sendMatchUpdate: jest.fn(),
  },
}));

jest.mock('../../config/sentry.config', () => ({
  addBreadcrumb: jest.fn(),
}));

const mockGetEvents = footballDataCacheService.getMatchEvents as jest.Mock;
const mockSend = WebSocketService.sendMatchUpdate as jest.Mock;

describe('live-fixture-event-push.service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    resetPushedEventsForFixture(4665946);
  });

  it('pushes only newly seen events on match_update.newEvents', async () => {
    const goal = {
      time: { elapsed: 12, extra: null },
      team: { id: 1, name: 'Home', logo: '' },
      player: { id: 9, name: 'Striker' },
      assist: { id: null, name: null },
      type: 'Goal',
      detail: 'Normal Goal',
      comments: null,
    };
    mockGetEvents.mockResolvedValueOnce([goal]);

    const pushed = await pushLiveFixtureEventDelta(4665946, {
      homeScore: 1,
      awayScore: 0,
      status: '1H',
      minute: 12,
      reason: 'score_change',
      forceRefresh: true,
    });

    expect(pushed).toBe(1);
    expect(mockSend).toHaveBeenCalledWith(
      4665946,
      expect.objectContaining({
        matchId: 4665946,
        newEvents: [goal],
      }),
    );

    mockGetEvents.mockResolvedValueOnce([goal]);
    const second = await pushLiveFixtureEventDelta(4665946, {
      homeScore: 1,
      awayScore: 0,
      status: '1H',
      minute: 12,
    });
    expect(second).toBe(0);
    expect(mockSend).toHaveBeenCalledTimes(1);
  });

  it('uses stable dedupe keys', () => {
    const event = {
      time: { elapsed: 45, extra: 2 },
      team: { id: 2, name: 'Away' },
      player: { id: 7, name: 'Mid' },
      assist: { id: null, name: null },
      type: 'Card',
      detail: 'Yellow Card',
      comments: null,
    };
    expect(fixtureEventDedupeKey(event as any)).toBe(
      fixtureEventDedupeKey(event as any),
    );
  });
});
