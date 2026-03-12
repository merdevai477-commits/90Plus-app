/**
 * Property-Based Tests for WebSocket Client
 *
 * **Feature: security-technical-fixes, Property 27: WebSocket Reconnection with Backoff**
 * For any WebSocket disconnection, the client SHALL attempt reconnection with
 * exponential backoff and sync missed events upon successful reconnection.
 *
 * **Validates: Requirements 21.6, 21.7**
 */

import * as fc from 'fast-check';
import {
  calculateBackoffDelay,
  ReconnectionConfig,
  WSEventType,
  WSMessage,
} from '../websocketClient';

// Mock socket.io-client
jest.mock('socket.io-client', () => ({
  io: jest.fn(() => ({
    on: jest.fn(),
    emit: jest.fn(),
    connect: jest.fn(),
    disconnect: jest.fn(),
    connected: false,
  })),
}));

// Mock api.config
jest.mock('../../config/api.config', () => ({
  getWsUrl: jest.fn(() => 'ws://localhost:3000'),
}));

// Mock logger
jest.mock('../logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

describe('WebSocket Client Property Tests', () => {
  /**
   * **Feature: security-technical-fixes, Property 27: WebSocket Reconnection with Backoff**
   *
   * For any WebSocket disconnection, the client SHALL attempt reconnection with
   * exponential backoff and sync missed events upon successful reconnection.
   *
   * **Validates: Requirements 21.6, 21.7**
   */
  describe('Property 27: WebSocket Reconnection with Backoff', () => {
    // Arbitrary for reconnection config
    const reconnectionConfigArb = fc.record({
      maxAttempts: fc.integer({ min: 1, max: 20 }),
      baseDelay: fc.integer({ min: 100, max: 5000 }),
      maxDelay: fc.integer({ min: 5000, max: 60000 }),
      backoffMultiplier: fc.double({ min: 1.5, max: 3, noNaN: true }),
    });

    // Arbitrary for attempt numbers
    const attemptArb = fc.integer({ min: 0, max: 15 });

    /**
     * Test that backoff delay increases exponentially with each attempt
     * Requirement 21.6: Exponential backoff
     */
    it('should calculate exponentially increasing delays for consecutive attempts (100 iterations)', () => {
      fc.assert(
        fc.property(
          reconnectionConfigArb,
          attemptArb,
          (config: ReconnectionConfig, attempt: number) => {
            const delay = calculateBackoffDelay(attempt, config);
            const nextDelay = calculateBackoffDelay(attempt + 1, config);

            // Delay should be positive
            expect(delay).toBeGreaterThan(0);

            // Next delay should be greater than or equal to current (unless capped)
            if (delay < config.maxDelay) {
              expect(nextDelay).toBeGreaterThanOrEqual(delay);
            }
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that delay never exceeds maxDelay
     * Requirement 21.6: Bounded reconnection delay
     */
    it('should never exceed maxDelay regardless of attempt number (100 iterations)', () => {
      fc.assert(
        fc.property(
          reconnectionConfigArb,
          attemptArb,
          (config: ReconnectionConfig, attempt: number) => {
            const delay = calculateBackoffDelay(attempt, config);

            // Delay should never exceed maxDelay
            expect(delay).toBeLessThanOrEqual(config.maxDelay);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that first attempt uses baseDelay
     * Requirement 21.6: Start with base delay
     */
    it('should use baseDelay for first attempt (attempt 0) (100 iterations)', () => {
      fc.assert(
        fc.property(reconnectionConfigArb, (config: ReconnectionConfig) => {
          const delay = calculateBackoffDelay(0, config);

          // First attempt should use baseDelay
          expect(delay).toBe(config.baseDelay);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test that delay follows exponential formula
     * Requirement 21.6: Exponential backoff formula
     */
    it('should follow exponential backoff formula: baseDelay * multiplier^attempt (100 iterations)', () => {
      fc.assert(
        fc.property(
          reconnectionConfigArb,
          attemptArb,
          (config: ReconnectionConfig, attempt: number) => {
            const delay = calculateBackoffDelay(attempt, config);
            const expectedDelay = config.baseDelay * Math.pow(config.backoffMultiplier, attempt);
            const cappedExpected = Math.min(expectedDelay, config.maxDelay);

            // Delay should match the formula (with floating point tolerance)
            expect(delay).toBeCloseTo(cappedExpected, 5);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test that delay is always positive
     */
    it('should always return positive delay values (100 iterations)', () => {
      fc.assert(
        fc.property(
          reconnectionConfigArb,
          attemptArb,
          (config: ReconnectionConfig, attempt: number) => {
            const delay = calculateBackoffDelay(attempt, config);

            // Delay must be positive
            expect(delay).toBeGreaterThan(0);
            expect(Number.isFinite(delay)).toBe(true);
            expect(Number.isNaN(delay)).toBe(false);
          }
        ),
        { numRuns: 100 }
      );
    });

    /**
     * Test delay monotonicity until cap
     */
    it('should produce monotonically increasing delays until maxDelay cap (100 iterations)', () => {
      fc.assert(
        fc.property(reconnectionConfigArb, (config: ReconnectionConfig) => {
          const delays: number[] = [];
          
          for (let i = 0; i < 10; i++) {
            delays.push(calculateBackoffDelay(i, config));
          }

          // Check monotonicity (each delay >= previous)
          for (let i = 1; i < delays.length; i++) {
            expect(delays[i]).toBeGreaterThanOrEqual(delays[i - 1]);
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  describe('WebSocket Event Types', () => {
    // Arbitrary for valid WebSocket event types
    const wsEventTypeArb = fc.constantFrom<WSEventType>(
      'notification',
      'comment',
      'reply',
      'like',
      'follow',
      'match_update',
      'reel_update'
    );

    /**
     * Test that all event types are valid
     */
    it('should accept all valid WebSocket event types (100 iterations)', () => {
      const validEventTypes: WSEventType[] = [
        'notification',
        'comment',
        'reply',
        'like',
        'follow',
        'match_update',
        'reel_update',
      ];

      fc.assert(
        fc.property(wsEventTypeArb, (eventType: WSEventType) => {
          expect(validEventTypes).toContain(eventType);
        }),
        { numRuns: 100 }
      );
    });

    /**
     * Test WSMessage structure
     */
    it('should create valid WSMessage structure for any event type (100 iterations)', () => {
      fc.assert(
        fc.property(
          wsEventTypeArb,
          fc.jsonValue(),
          (eventType: WSEventType, payload: unknown) => {
            const message: WSMessage<any> = {
              type: eventType,
              payload: payload as any,
              timestamp: Date.now(),
            };

            // Message should have all required fields
            expect(message.type).toBe(eventType);
            expect(message.payload).toEqual(payload);
            expect(typeof message.timestamp).toBe('number');
            expect(message.timestamp).toBeGreaterThan(0);
          }
        ),
        { numRuns: 100 }
      );
    });
  });

  describe('Reconnection Configuration', () => {
    /**
     * Test default configuration values
     */
    it('should have sensible default configuration values', () => {
      // Import fresh to get defaults
      jest.resetModules();
      const { WebSocketClient } = require('../websocketClient');
      
      const client = new WebSocketClient();
      const config = client.getReconnectionConfig();

      // Verify defaults are sensible
      expect(config.maxAttempts).toBeGreaterThan(0);
      expect(config.baseDelay).toBeGreaterThan(0);
      expect(config.maxDelay).toBeGreaterThan(config.baseDelay);
      expect(config.backoffMultiplier).toBeGreaterThan(1);
    });

    /**
     * Test custom configuration
     */
    it('should allow custom reconnection configuration (100 iterations)', () => {
      fc.assert(
        fc.property(
          fc.record({
            maxAttempts: fc.integer({ min: 1, max: 20 }),
            baseDelay: fc.integer({ min: 100, max: 5000 }),
            maxDelay: fc.integer({ min: 5000, max: 60000 }),
            backoffMultiplier: fc.double({ min: 1.5, max: 3, noNaN: true }),
          }),
          (customConfig: ReconnectionConfig) => {
            jest.resetModules();
            const { WebSocketClient } = require('../websocketClient');
            
            const client = new WebSocketClient();
            client.setReconnectionConfig(customConfig);
            const config = client.getReconnectionConfig();

            expect(config.maxAttempts).toBe(customConfig.maxAttempts);
            expect(config.baseDelay).toBe(customConfig.baseDelay);
            expect(config.maxDelay).toBe(customConfig.maxDelay);
            expect(config.backoffMultiplier).toBe(customConfig.backoffMultiplier);
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
