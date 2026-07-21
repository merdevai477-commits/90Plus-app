const add = jest.fn();
const registerProcessor = jest.fn();
const on = jest.fn();
const close = jest.fn();
const processMatchEventPushJob = jest.fn();

jest.mock('bull', () =>
  jest.fn().mockImplementation(() => ({
    add,
    process: registerProcessor,
    on,
    close,
  })),
);

jest.mock('../../lib/bull-redis', () => ({
  bullCreateClient: jest.fn(),
}));

jest.mock('../../services/match-events/match-event-push.processor', () => ({
  processMatchEventPushJob,
}));

jest.mock('../../utils/logger', () => ({
  logger: {
    info: jest.fn(),
    warn: jest.fn(),
  },
}));

import { enqueueMatchEventPush } from '../match-event-push.queue';

const payload: any = {
  subscriptionId: 'subscription-1',
  userId: 'user-1',
  fixtureId: 77,
  notificationType: 'MATCH_GOAL',
  prefKey: 'matchGoals',
  data: {},
  idempotencyKey: 'match-event:event-1:user-1',
  event: {
    fixtureId: 77,
    eventKey: 'event-1',
    eventType: 'goal_home',
  },
};

describe('match-event push retry queue', () => {
  const previousRedisUrl = process.env.REDIS_URL;

  beforeEach(() => {
    process.env.REDIS_URL = 'redis://test';
    jest.clearAllMocks();
    add.mockResolvedValue({ id: 'retry-1' });
  });

  afterAll(() => {
    if (previousRedisUrl == null) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  });

  it('does not enqueue when immediate delivery succeeds', async () => {
    processMatchEventPushJob.mockResolvedValue(undefined);

    await expect(enqueueMatchEventPush(payload)).resolves.toBeUndefined();

    expect(add).not.toHaveBeenCalled();
  });

  it('queues a failed immediate delivery with exponential retries', async () => {
    processMatchEventPushJob.mockRejectedValue(new Error('temporary Expo failure'));

    await expect(enqueueMatchEventPush(payload)).resolves.toBeUndefined();

    expect(add).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({
        attempts: 6,
        backoff: { type: 'exponential', delay: 2_000 },
      }),
    );
  });
});
