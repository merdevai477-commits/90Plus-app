/**
 * Clerk token cache: a locked iOS keychain must never surface as "no token"
 * (Clerk would start a signed-out client), and tokens saved as WHEN_UNLOCKED
 * must move to an item that stays readable while the phone is locked.
 */

const KEY = '__clerk_client_jwt';

const mockKeychain = new Map<string, string>();
/** WHEN_UNLOCKED items: unreadable while the app isn't in the foreground. */
const mockLocked = new Set<string>();
/** Items that fail to read no matter what. */
const mockBroken = new Set<string>();
const mockAppState = { currentState: 'active' };
const mockListeners = new Set<(state: string) => void>();
const mockPlatform = { OS: 'ios' };

jest.mock('react-native', () => ({
  Platform: mockPlatform,
  AppState: {
    get currentState() {
      return mockAppState.currentState;
    },
    addEventListener: (_type: string, listener: (state: string) => void) => {
      mockListeners.add(listener);
      return { remove: () => mockListeners.delete(listener) };
    },
  },
}));

jest.mock('expo-secure-store', () => ({
  AFTER_FIRST_UNLOCK: 0,
  getItemAsync: jest.fn(async (key: string) => {
    const locked = mockLocked.has(key) && mockAppState.currentState !== 'active';
    if (locked || mockBroken.has(key)) {
      throw new Error("Calling the 'getValueWithKeyAsync' function has failed → Caused by: User interaction is not allowed.");
    }
    return mockKeychain.get(key) ?? null;
  }),
  setItemAsync: jest.fn(async (key: string, value: string) => {
    mockKeychain.set(key, value);
  }),
  deleteItemAsync: jest.fn(async (key: string) => {
    mockKeychain.delete(key);
    mockLocked.delete(key);
  }),
}));

jest.mock('../logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('../sentry.service', () => ({
  captureException: jest.fn(),
}));

type Cache = typeof import('../clerkTokenCache').clerkTokenCache;

let cache: Cache;
let getItemAsync: jest.Mock;
let captureException: jest.Mock;

function setAppState(state: string) {
  mockAppState.currentState = state;
  for (const listener of [...mockListeners]) listener(state);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const flush = () => sleep(0);
/** Longer than the three-read retry window (120ms + 240ms). */
const PAST_RETRIES_MS = 500;

beforeEach(() => {
  mockKeychain.clear();
  mockLocked.clear();
  mockBroken.clear();
  mockListeners.clear();
  mockAppState.currentState = 'active';
  mockPlatform.OS = 'ios';

  jest.resetModules();
  cache = require('../clerkTokenCache').clerkTokenCache;
  getItemAsync = require('expo-secure-store').getItemAsync;
  captureException = require('../sentry.service').captureException;
});

describe('clerkTokenCache on iOS', () => {
  it('waits for the foreground instead of returning no token while the keychain is locked', async () => {
    mockKeychain.set(KEY, 'signed-in-jwt');
    mockLocked.add(KEY);
    setAppState('background');

    let result: string | null | undefined;
    const pending = cache.getToken(KEY).then((token) => {
      result = token;
    });
    await sleep(PAST_RETRIES_MS);
    expect(result).toBeUndefined();

    setAppState('active');
    await pending;
    expect(result).toBe('signed-in-jwt');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('after one foreground read, an old token stays readable while the phone is locked', async () => {
    mockKeychain.set(KEY, 'signed-in-jwt');
    mockLocked.add(KEY);

    await expect(cache.getToken(KEY)).resolves.toBe('signed-in-jwt');
    expect(mockKeychain.has(KEY)).toBe(false);

    setAppState('background');
    await expect(cache.getToken(KEY)).resolves.toBe('signed-in-jwt');
  });

  it('a token Clerk saves while a locked read is waiting is not overwritten by the old one', async () => {
    mockKeychain.set(KEY, 'old-jwt');
    mockLocked.add(KEY);
    setAppState('background');

    const read = cache.getToken(KEY);
    await flush();
    const save = cache.saveToken(KEY, 'new-jwt');

    setAppState('active');
    await expect(read).resolves.toBe('old-jwt');
    await save;
    await expect(cache.getToken(KEY)).resolves.toBe('new-jwt');
  });

  it('clearing the token also removes the old one so it cannot come back', async () => {
    mockKeychain.set(KEY, 'old-jwt');
    await cache.saveToken(KEY, 'new-jwt');

    await cache.clearToken(KEY);
    await expect(cache.getToken(KEY)).resolves.toBeNull();
  });

  it('a read that fails in the foreground is retried, then reported once', async () => {
    mockBroken.add(`${KEY}.afu`);

    await expect(cache.getToken(KEY)).resolves.toBeNull();
    expect(captureException).toHaveBeenCalledTimes(1);
    expect(captureException.mock.calls[0][1]).toEqual({
      tags: { area: 'clerk_token_cache', op: 'getToken' },
    });
  });
});

describe('clerkTokenCache on Android', () => {
  beforeEach(() => {
    mockPlatform.OS = 'android';
  });

  it('keeps using the original key', async () => {
    await cache.saveToken(KEY, 'jwt');
    expect(mockKeychain.get(KEY)).toBe('jwt');
    await expect(cache.getToken(KEY)).resolves.toBe('jwt');
  });

  it('does not wait on app state: gives up after three reads and reports once', async () => {
    mockKeychain.set(KEY, 'jwt');
    mockBroken.add(KEY);
    setAppState('background');

    await expect(cache.getToken(KEY)).resolves.toBeNull();
    expect(getItemAsync).toHaveBeenCalledTimes(3);
    expect(captureException).toHaveBeenCalledTimes(1);
  });
});
