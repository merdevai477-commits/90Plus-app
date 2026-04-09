/**
 * Property-Based Tests for API Configuration
 *
 * **Feature: Centralized API Configuration, Property 6: API Configuration Environment URLs**
 * For any environment (development, staging, production), the API configuration
 * SHALL return a valid, non-empty URL specific to that environment.
 *
 * **Validates: Requirements 5.2, 5.4**
 */

import * as fc from 'fast-check';
import {
  getConfigForEnvironment,
  getAPIConfig,
  getEnvironment,
  Environment,
} from '../api.config';

// Mock react-native Platform
jest.mock('react-native', () => ({
  Platform: {
    OS: 'web',
    select: jest.fn((obj: Record<string, unknown>) => obj.web || obj.default),
  },
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  expoConfig: {
    extra: {},
  },
}));

describe('API Configuration Property Tests', () => {
  // Store original env values
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment for each test
    jest.resetModules();
    process.env = { ...originalEnv };
    // Set __DEV__ for tests
    (global as any).__DEV__ = true;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  /**
   * **Feature: Centralized API Configuration, Property 6: API Configuration Environment URLs**
   *
   * For any environment (development, staging, production), the API configuration
   * SHALL return a valid, non-empty URL specific to that environment.
   */
  describe('Property 6: API Configuration Environment URLs', () => {
    // Arbitrary for valid environments
    const environmentArbitrary = fc.constantFrom<Environment>(
      'development',
      'staging',
      'production'
    );

    it('should return valid non-empty baseUrl for any environment (100 iterations)', () => {
      fc.assert(
        fc.property(environmentArbitrary, (env: Environment) => {
          const config = getConfigForEnvironment(env);

          // baseUrl must be a non-empty string
          expect(typeof config.baseUrl).toBe('string');
          expect(config.baseUrl.length).toBeGreaterThan(0);

          // baseUrl must be a valid URL format (starts with http:// or https://)
          expect(config.baseUrl).toMatch(/^https?:\/\/.+/);

          // baseUrl must contain /api path
          expect(config.baseUrl).toContain('/api');
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid non-empty wsUrl for any environment (100 iterations)', () => {
      fc.assert(
        fc.property(environmentArbitrary, (env: Environment) => {
          const config = getConfigForEnvironment(env);

          // wsUrl must be a non-empty string
          expect(typeof config.wsUrl).toBe('string');
          expect(config.wsUrl.length).toBeGreaterThan(0);

          // wsUrl must be a valid WebSocket URL format (starts with ws:// or wss://)
          expect(config.wsUrl).toMatch(/^wss?:\/\/.+/);
        }),
        { numRuns: 100 }
      );
    });

    it('should return environment-specific URLs (different for each environment) (100 iterations)', () => {
      fc.assert(
        fc.property(
          environmentArbitrary,
          environmentArbitrary,
          (env1: Environment, env2: Environment) => {
            if (env1 === env2) {
              // Same environment should return same config
              const config1 = getConfigForEnvironment(env1);
              const config2 = getConfigForEnvironment(env2);
              expect(config1.baseUrl).toBe(config2.baseUrl);
              expect(config1.wsUrl).toBe(config2.wsUrl);
            } else {
              // Different environments should return different URLs
              const config1 = getConfigForEnvironment(env1);
              const config2 = getConfigForEnvironment(env2);
              expect(config1.baseUrl).not.toBe(config2.baseUrl);
              expect(config1.wsUrl).not.toBe(config2.wsUrl);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should return valid timeout and retryAttempts for any environment (100 iterations)', () => {
      fc.assert(
        fc.property(environmentArbitrary, (env: Environment) => {
          const config = getConfigForEnvironment(env);

          // timeout must be a positive number
          expect(typeof config.timeout).toBe('number');
          expect(config.timeout).toBeGreaterThan(0);

          // retryAttempts must be a non-negative integer
          expect(typeof config.retryAttempts).toBe('number');
          expect(config.retryAttempts).toBeGreaterThanOrEqual(0);
          expect(Number.isInteger(config.retryAttempts)).toBe(true);
        }),
        { numRuns: 100 }
      );
    });

    it('should use HTTPS for production and staging environments (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.constantFrom<Environment>('staging', 'production'),
          (env: Environment) => {
            const config = getConfigForEnvironment(env);

            // Production and staging must use HTTPS
            expect(config.baseUrl).toMatch(/^https:\/\/.+/);

            // Production and staging must use WSS
            expect(config.wsUrl).toMatch(/^wss:\/\/.+/);
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should allow HTTP for development environment (100 iterations)', () => {
      fc.assert(
        fc.property(fc.constant('development' as Environment), (env: Environment) => {
          const config = getConfigForEnvironment(env);

          // Development can use HTTP or HTTPS
          expect(config.baseUrl).toMatch(/^https?:\/\/.+/);

          // Development can use WS or WSS
          expect(config.wsUrl).toMatch(/^wss?:\/\/.+/);
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('Environment Detection', () => {
    it('should return a valid environment type', () => {
      const env = getEnvironment();
      expect(['development', 'staging', 'production']).toContain(env);
    });

    it('should return development when __DEV__ is true', () => {
      (global as any).__DEV__ = true;
      const { EXPO_PUBLIC_ENV, NODE_ENV, ...restEnv } = process.env;
      process.env = restEnv as NodeJS.ProcessEnv;

      // Re-import to get fresh module
      jest.resetModules();
      const { getEnvironment: freshGetEnv } = require('../api.config');
      expect(freshGetEnv()).toBe('development');
    });
  });

  describe('API Config Retrieval', () => {
    it('should return a complete APIConfig object', () => {
      const config = getAPIConfig();

      expect(config).toHaveProperty('baseUrl');
      expect(config).toHaveProperty('wsUrl');
      expect(config).toHaveProperty('timeout');
      expect(config).toHaveProperty('retryAttempts');
    });
  });
});
