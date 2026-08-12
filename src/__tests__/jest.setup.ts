/*
 * Feature flags are pinned here, not inherited from whatever .env the machine
 * happens to have. QUESTIONS_ENABLE_FOOTBALL_DATA_FALLBACK turns on
 * deterministic round composition; a developer enabling it locally silently
 * rewrote the outcome of every "the AI failed, so no round is produced" test,
 * which is a property of the AI path those tests exist to protect. Suites that
 * want the deterministic path set this themselves.
 */
process.env.QUESTIONS_ENABLE_FOOTBALL_DATA_FALLBACK = 'false';
/*
 * Likewise the derived (persisted-career) transfer/ranking fallback: several
 * tests assert that the PRIMARY football path drops unusable upstream rows, and
 * a fallback that refills those pools afterwards hides the property they check.
 */
process.env.QUESTIONS_DISABLE_DERIVED_FALLBACK = 'true';

/**
 * Prevent real Redis connections during unit tests (avoids Jest hang + post-test logs).
 */
jest.mock('../lib/redis', () => {
  const mock = {
    initializeRedis: jest.fn(() => null),
    getRedisClient: jest.fn(() => null),
    isRedisConnected: jest.fn(() => false),
    closeRedis: jest.fn(async () => {}),
  };
  return { ...mock, default: mock.getRedisClient };
});
