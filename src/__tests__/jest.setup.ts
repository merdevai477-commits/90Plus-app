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
