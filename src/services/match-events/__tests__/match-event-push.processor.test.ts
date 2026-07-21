const favoriteMatch = {
  findUnique: jest.fn(),
};
const claimMatchEventDelivery = jest.fn();
const completeMatchEventDelivery = jest.fn();
const releaseMatchEventDeliveryClaim = jest.fn();
const updateSubscriptionFlags = jest.fn();
const createNotification = jest.fn();

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: { favoriteMatch },
}));

jest.mock('../match-event-delivery.service', () => ({
  shouldDeliverToSubscription: () => true,
  isPrefAllowed: async () => true,
  updateSubscriptionFlags,
  claimMatchEventDelivery,
  completeMatchEventDelivery,
  releaseMatchEventDeliveryClaim,
}));

jest.mock('../../notification.service', () => ({
  NotificationService: { createNotification },
}));

jest.mock('../../push-templates.service', () => ({
  getUserLanguage: async () => 'en',
  localizeMatchVarDetail: (value: string) => value,
  renderPushTemplate: (key: string) => key,
}));

jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

import { processMatchEventPushJob } from '../match-event-push.processor';

const subscription = {
  id: 'sub-1',
  userId: 'user-1',
  apiMatchId: 77,
  subscribedAt: new Date(),
  matchDate: new Date(),
  homeTeam: 'Home',
  awayTeam: 'Away',
  homeTeamLogo: null,
  awayTeamLogo: null,
  leagueName: null,
  baselineHomeScore: 0,
  baselineAwayScore: 0,
  notifiedStart: false,
  notifiedEnd: false,
};

const job: any = {
  subscriptionId: 'sub-1',
  userId: 'user-1',
  fixtureId: 77,
  notificationType: 'MATCH_GOAL',
  titleKey: 'goalTitle',
  bodyKey: 'goalScoreBody',
  data: {},
  idempotencyKey: 'match-event:event-1:user-1',
  event: {
    fixtureId: 77,
    eventKey: 'event-1',
    eventType: 'goal_home',
    prefKey: 'matchGoals',
    detectedAt: new Date(),
    payload: { homeScore: 1, awayScore: 0 },
    templateVars: {},
  },
};

describe('match event push delivery state', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    favoriteMatch.findUnique.mockResolvedValue(subscription);
    completeMatchEventDelivery.mockResolvedValue(true);
    releaseMatchEventDeliveryClaim.mockResolvedValue(undefined);
  });

  it('releases a failed attempt, retries, then records exactly one success', async () => {
    const firstClaim = { subscriptionId: 'sub-1', eventKey: 'event-1', token: 'attempt-1' };
    const retryClaim = { subscriptionId: 'sub-1', eventKey: 'event-1', token: 'attempt-2' };
    claimMatchEventDelivery
      .mockResolvedValueOnce(firstClaim)
      .mockResolvedValueOnce(retryClaim)
      .mockResolvedValueOnce(null);
    createNotification
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'notification-1' });

    await expect(processMatchEventPushJob(job)).rejects.toThrow('notification delivery failed');
    expect(releaseMatchEventDeliveryClaim).toHaveBeenCalledWith(firstClaim);
    expect(completeMatchEventDelivery).not.toHaveBeenCalled();

    await expect(processMatchEventPushJob(job)).resolves.toBeUndefined();
    expect(completeMatchEventDelivery).toHaveBeenCalledTimes(1);
    expect(completeMatchEventDelivery).toHaveBeenCalledWith(retryClaim);
    expect(updateSubscriptionFlags).toHaveBeenCalledTimes(1);

    await expect(processMatchEventPushJob(job)).resolves.toBeUndefined();
    expect(createNotification).toHaveBeenCalledTimes(2);
    expect(completeMatchEventDelivery).toHaveBeenCalledTimes(1);
  });
});
