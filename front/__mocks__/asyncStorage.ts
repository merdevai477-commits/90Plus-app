/**
 * Mock implementation of AsyncStorage for testing
 * This provides an in-memory storage that mimics AsyncStorage behavior
 */

let store: Record<string, string> = {};

const AsyncStorage = {
  getItem: jest.fn(async (key: string): Promise<string | null> => {
    return store[key] ?? null;
  }),

  setItem: jest.fn(async (key: string, value: string): Promise<void> => {
    store[key] = value;
  }),

  removeItem: jest.fn(async (key: string): Promise<void> => {
    delete store[key];
  }),

  getAllKeys: jest.fn(async (): Promise<string[]> => {
    return Object.keys(store);
  }),

  multiRemove: jest.fn(async (keys: string[]): Promise<void> => {
    keys.forEach(key => delete store[key]);
  }),

  multiGet: jest.fn(async (keys: string[]): Promise<[string, string | null][]> => {
    return keys.map(key => [key, store[key] ?? null]);
  }),

  multiSet: jest.fn(async (keyValuePairs: [string, string][]): Promise<void> => {
    keyValuePairs.forEach(([key, value]) => {
      store[key] = value;
    });
  }),

  clear: jest.fn(async (): Promise<void> => {
    store = {};
  }),

  // Helper for tests to reset the store
  __resetStore: () => {
    store = {};
  },

  // Helper for tests to get the raw store
  __getStore: () => store,

  // Helper for tests to set the raw store
  __setStore: (newStore: Record<string, string>) => {
    store = newStore;
  },
};

export default AsyncStorage;
