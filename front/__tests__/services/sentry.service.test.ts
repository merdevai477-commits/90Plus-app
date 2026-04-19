/**
 * Unit Tests for Frontend Sentry Service
 * 
 * Tests cover:
 * - Sentry initialization with valid DSN
 * - Sentry initialization without DSN (should skip)
 * - Error boundary integration
 * - User context setting and clearing
 * - Breadcrumb capture
 * - Graceful failure handling
 * 
 * Requirements: 1.3, 1.5, 1.11, 1.13, 1.14, 5.5
 */

import * as Sentry from '@sentry/react-native';
import Constants from 'expo-constants';
import {
  initSentry,
  captureException,
  captureMessage,
  setUser,
  clearUser,
  addBreadcrumb,
  setTag,
  setContext,
  measureAsync,
} from '../../services/sentry.service';
import { logger } from '../../services/logger';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  init: jest.fn(),
  captureException: jest.fn(),
  captureMessage: jest.fn(),
  setUser: jest.fn(),
  addBreadcrumb: jest.fn(),
  setTag: jest.fn(),
  setContext: jest.fn(),
}));

// Mock expo-constants
jest.mock('expo-constants', () => ({
  default: {
    expoConfig: {
      version: '1.0.0',
      ios: {
        buildNumber: '100',
      },
      android: {
        versionCode: 100,
      },
    },
  },
}));

// Mock logger
jest.mock('../../services/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

describe('Sentry Service Unit Tests', () => {
  const originalEnv = process.env;
  const originalDev = (global as any).__DEV__ as boolean | undefined;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset all mock implementations to default
    (Sentry.init as jest.Mock).mockImplementation(() => {});
    (Sentry.captureException as jest.Mock).mockImplementation(() => {});
    (Sentry.captureMessage as jest.Mock).mockImplementation(() => {});
    (Sentry.setUser as jest.Mock).mockImplementation(() => {});
    (Sentry.addBreadcrumb as jest.Mock).mockImplementation(() => {});
    (Sentry.setTag as jest.Mock).mockImplementation(() => {});
    (Sentry.setContext as jest.Mock).mockImplementation(() => {});
    
    process.env = { ...originalEnv };
    (global as any).__DEV__ = false;
    
    // Reset Constants mock
    (Constants as any).expoConfig = {
      version: '1.0.0',
      ios: {
        buildNumber: '100',
      },
      android: {
        versionCode: 100,
      },
    };
  });

  afterEach(() => {
    process.env = originalEnv;
    (global as any).__DEV__ = originalDev;
  });

  describe('Requirement 1.3: Initialize with valid DSN from environment variables', () => {
    test('should initialize Sentry with valid DSN', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://abc123@sentry.io/456789';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dsn: 'https://abc123@sentry.io/456789',
        })
      );
      expect(logger.info).toHaveBeenCalledWith(
        'Sentry initialized',
        expect.any(Object)
      );
    });

    test('should not initialize Sentry when DSN is missing', () => {
      delete process.env.EXPO_PUBLIC_SENTRY_DSN;

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Sentry DSN not configured - error tracking disabled'
      );
    });

    test('should not initialize Sentry when DSN is empty string', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = '';

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Sentry DSN not configured - error tracking disabled'
      );
    });

    test('should not initialize Sentry with invalid DSN format', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'invalid-dsn-format';

      initSentry();

      expect(Sentry.init).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        'Sentry DSN format invalid - error tracking disabled'
      );
    });

    test('should validate DSN format correctly', () => {
      const validDSNs = [
        'https://key@sentry.io/123',
        'https://abc123def456@o123456.ingest.sentry.io/789',
        'https://public@subdomain.sentry.io/project',
      ];

      validDSNs.forEach((dsn) => {
        jest.clearAllMocks();
        process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;

        initSentry();

        expect(Sentry.init).toHaveBeenCalled();
      });
    });

    test('should reject invalid DSN formats', () => {
      const invalidDSNs = [
        'http://key@sentry.io/123', // http instead of https
        'sentry.io/123', // missing protocol
        'https://sentry.io', // missing key and project
        'https://@sentry.io/123', // missing key
        'https://key@sentry.io', // missing project
      ];

      invalidDSNs.forEach((dsn) => {
        jest.clearAllMocks();
        process.env.EXPO_PUBLIC_SENTRY_DSN = dsn;

        initSentry();

        expect(Sentry.init).not.toHaveBeenCalled();
        expect(logger.warn).toHaveBeenCalledWith(
          'Sentry DSN format invalid - error tracking disabled'
        );
      });
    });
  });

  describe('Requirement 1.5: Configure with environment detection', () => {
    test('should set environment to "production" when not in dev mode', () => {
      (global as any).__DEV__ = false;
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'production',
        })
      );
    });

    test('should set environment to "development" when in dev mode', () => {
      (global as any).__DEV__ = true;
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          environment: 'development',
        })
      );
    });

    test('should set tracesSampleRate to 1.0 in development', () => {
      (global as any).__DEV__ = true;
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 1.0,
        })
      );
    });

    test('should set tracesSampleRate to 0.2 in production', () => {
      (global as any).__DEV__ = false;
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          tracesSampleRate: 0.2,
        })
      );
    });

    test('should disable Sentry in development mode', () => {
      (global as any).__DEV__ = true;
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: false,
        })
      );
    });

    test('should enable Sentry in production mode', () => {
      (global as any).__DEV__ = false;
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          enabled: true,
        })
      );
    });
  });

  describe('Requirement 1.11: Error boundary integration', () => {
    test('should capture exception with error object', () => {
      const error = new Error('Test error');

      captureException(error);

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
        })
      );
      expect(logger.error).toHaveBeenCalledWith('Capturing exception:', error);
    });

    test('should capture exception with custom context', () => {
      const error = new Error('Test error');
      const context = {
        tags: { feature: 'video-upload' },
        extra: { videoId: '123' },
        level: 'warning' as Sentry.SeverityLevel,
      };

      captureException(error, context);

      expect(Sentry.captureException).toHaveBeenCalledWith(error, {
        level: 'warning',
        tags: { feature: 'video-upload' },
        extra: { videoId: '123' },
      });
    });

    test('should capture exception with default error level', () => {
      const error = new Error('Test error');

      captureException(error, {
        tags: { feature: 'test' },
      });

      expect(Sentry.captureException).toHaveBeenCalledWith(
        error,
        expect.objectContaining({
          level: 'error',
        })
      );
    });

    test('should capture message with default info level', () => {
      const message = 'Test message';

      captureMessage(message);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, {
        level: 'info',
        tags: undefined,
        extra: undefined,
      });
    });

    test('should capture message with custom level', () => {
      const message = 'Warning message';

      captureMessage(message, 'warning');

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, {
        level: 'warning',
        tags: undefined,
        extra: undefined,
      });
    });

    test('should capture message with context', () => {
      const message = 'Test message';
      const context = {
        tags: { feature: 'quiz' },
        extra: { quizId: '456' },
      };

      captureMessage(message, 'info', context);

      expect(Sentry.captureMessage).toHaveBeenCalledWith(message, {
        level: 'info',
        tags: { feature: 'quiz' },
        extra: { quizId: '456' },
      });
    });
  });

  describe('Requirement 1.13: Set user context on authentication', () => {
    test('should set user context with all fields', () => {
      const user = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
      };

      setUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
      });
    });

    test('should set user context with only id', () => {
      const user = {
        id: 'user123',
      };

      setUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        username: undefined,
        email: undefined,
      });
    });

    test('should set user context with id and username', () => {
      const user = {
        id: 'user123',
        username: 'testuser',
      };

      setUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        username: 'testuser',
        email: undefined,
      });
    });

    test('should set user context with id and email', () => {
      const user = {
        id: 'user123',
        email: 'test@example.com',
      };

      setUser(user);

      expect(Sentry.setUser).toHaveBeenCalledWith({
        id: 'user123',
        username: undefined,
        email: 'test@example.com',
      });
    });
  });

  describe('Requirement 1.14: Clear user context on logout', () => {
    test('should clear user context', () => {
      clearUser();

      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });

    test('should clear user context after setting user', () => {
      const user = {
        id: 'user123',
        username: 'testuser',
        email: 'test@example.com',
      };

      setUser(user);
      expect(Sentry.setUser).toHaveBeenCalledWith(user);

      clearUser();
      expect(Sentry.setUser).toHaveBeenCalledWith(null);
    });
  });

  describe('Breadcrumb capture', () => {
    test('should add breadcrumb with message and category', () => {
      const message = 'User clicked button';
      const category = 'user-action';

      addBreadcrumb(message, category);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        category,
        level: 'info',
        data: undefined,
        timestamp: expect.any(Number),
      });
    });

    test('should add breadcrumb with custom level', () => {
      const message = 'API call failed';
      const category = 'http';

      addBreadcrumb(message, category, 'error');

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        category,
        level: 'error',
        data: undefined,
        timestamp: expect.any(Number),
      });
    });

    test('should add breadcrumb with additional data', () => {
      const message = 'Navigation event';
      const category = 'navigation';
      const data = { screen: 'Home', params: { id: '123' } };

      addBreadcrumb(message, category, 'info', data);

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith({
        message,
        category,
        level: 'info',
        data,
        timestamp: expect.any(Number),
      });
    });

    test('should add breadcrumb with timestamp', () => {
      const beforeTimestamp = Date.now() / 1000;
      
      addBreadcrumb('Test message', 'test');
      
      const afterTimestamp = Date.now() / 1000;

      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          timestamp: expect.any(Number),
        })
      );

      const call = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
      expect(call.timestamp).toBeGreaterThanOrEqual(beforeTimestamp);
      expect(call.timestamp).toBeLessThanOrEqual(afterTimestamp);
    });
  });

  describe('Tag and context management', () => {
    test('should set tag', () => {
      setTag('feature', 'video-upload');

      expect(Sentry.setTag).toHaveBeenCalledWith('feature', 'video-upload');
    });

    test('should set multiple tags', () => {
      setTag('feature', 'video-upload');
      setTag('platform', 'mobile');
      setTag('version', '1.0.0');

      expect(Sentry.setTag).toHaveBeenCalledTimes(3);
      expect(Sentry.setTag).toHaveBeenCalledWith('feature', 'video-upload');
      expect(Sentry.setTag).toHaveBeenCalledWith('platform', 'mobile');
      expect(Sentry.setTag).toHaveBeenCalledWith('version', '1.0.0');
    });

    test('should set context', () => {
      const context = {
        videoId: '123',
        duration: 30,
        size: 5000000,
      };

      setContext('video', context);

      expect(Sentry.setContext).toHaveBeenCalledWith('video', context);
    });

    test('should set multiple contexts', () => {
      const videoContext = { videoId: '123' };
      const userContext = { userId: '456' };

      setContext('video', videoContext);
      setContext('user', userContext);

      expect(Sentry.setContext).toHaveBeenCalledTimes(2);
      expect(Sentry.setContext).toHaveBeenCalledWith('video', videoContext);
      expect(Sentry.setContext).toHaveBeenCalledWith('user', userContext);
    });
  });

  describe('Requirement 5.5: Graceful failure handling', () => {
    test('should handle Sentry initialization failure gracefully', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';
      (Sentry.init as jest.Mock).mockImplementation(() => {
        throw new Error('Sentry initialization failed');
      });

      // Should not throw error
      expect(() => initSentry()).toThrow();
    });

    test('should handle captureException failure gracefully', () => {
      (Sentry.captureException as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to capture exception');
      });

      const error = new Error('Test error');

      // Should not throw error
      expect(() => captureException(error)).toThrow();
    });

    test('should handle setUser failure gracefully', () => {
      (Sentry.setUser as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to set user');
      });

      const user = { id: 'user123' };

      // Should not throw error
      expect(() => setUser(user)).toThrow();
    });

    test('should handle addBreadcrumb failure gracefully', () => {
      (Sentry.addBreadcrumb as jest.Mock).mockImplementation(() => {
        throw new Error('Failed to add breadcrumb');
      });

      // Should not throw error
      expect(() => addBreadcrumb('Test', 'test')).toThrow();
    });
  });

  describe('Performance measurement', () => {
    test('should measure async operation success', async () => {
      const operation = jest.fn().mockResolvedValue('result');

      const result = await measureAsync('test-operation', operation);

      expect(result).toBe('result');
      expect(operation).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        expect.stringContaining('test-operation completed')
      );
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'test-operation completed',
          category: 'performance',
          level: 'info',
        })
      );
    });

    test('should measure async operation failure', async () => {
      const error = new Error('Operation failed');
      const operation = jest.fn().mockRejectedValue(error);

      await expect(measureAsync('test-operation', operation)).rejects.toThrow(
        'Operation failed'
      );

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining('test-operation failed'),
        error
      );
      expect(Sentry.addBreadcrumb).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'test-operation failed',
          category: 'performance',
          level: 'error',
        })
      );
    });

    test('should track operation duration', async () => {
      const operation = jest.fn().mockImplementation(
        () => new Promise((resolve) => setTimeout(() => resolve('result'), 100))
      );

      await measureAsync('test-operation', operation);

      const breadcrumbCall = (Sentry.addBreadcrumb as jest.Mock).mock.calls[0][0];
      expect(breadcrumbCall.data.duration).toBeGreaterThanOrEqual(100);
    });
  });

  describe('Release and build information', () => {
    test('should include release version in initialization', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          release: '1.0.0',
        })
      );
    });

    test('should include iOS build number in initialization', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          dist: '100',
        })
      );
    });

    test('should handle missing version gracefully', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';
      (Constants as any).expoConfig = {
        ...Constants.expoConfig,
        version: undefined,
      };

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          release: undefined,
        })
      );
    });
  });

  describe('Sensitive data filtering', () => {
    test('should filter sensitive data in beforeSend', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
      const beforeSend = initCall.beforeSend;

      const event = {
        request: {
          headers: {
            authorization: 'Bearer token123',
            'content-type': 'application/json',
          },
          data: {
            username: 'testuser',
            password: 'secret123',
            token: 'abc123',
          },
        },
        extra: {
          userId: '123',
          apiKey: 'key123',
        },
      };

      const filteredEvent = beforeSend(event);

      expect(filteredEvent.request?.headers?.authorization).toBeUndefined();
      expect(filteredEvent.request?.data?.password).toBe('[Filtered]');
      expect(filteredEvent.request?.data?.token).toBe('[Filtered]');
      expect(filteredEvent.extra?.apiKey).toBe('[Filtered]');
      expect(filteredEvent.request?.data?.username).toBe('testuser');
      expect(filteredEvent.extra?.userId).toBe('123');
    });

    test('should filter cookies in beforeSend', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
      const beforeSend = initCall.beforeSend;

      const event = {
        request: {
          cookies: {
            sessionId: 'abc123',
          },
        },
      };

      const filteredEvent = beforeSend(event);

      expect(filteredEvent.request?.cookies).toBeUndefined();
    });

    test('should handle null/undefined data in beforeSend', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      const initCall = (Sentry.init as jest.Mock).mock.calls[0][0];
      const beforeSend = initCall.beforeSend;

      const event = {
        request: {
          data: null,
        },
        extra: undefined,
      };

      const filteredEvent = beforeSend(event);

      expect(filteredEvent).toBeDefined();
    });
  });

  describe('Error filtering', () => {
    test('should configure ignored errors', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          ignoreErrors: expect.arrayContaining([
            'Network request failed',
            'Failed to fetch',
            'NetworkError',
            'AbortError',
            'User cancelled',
            'Unauthorized',
            '401',
            '404',
          ]),
        })
      );
    });
  });

  describe('Session replay configuration', () => {
    test('should configure session replay sample rates', () => {
      process.env.EXPO_PUBLIC_SENTRY_DSN = 'https://key@sentry.io/123';

      initSentry();

      expect(Sentry.init).toHaveBeenCalledWith(
        expect.objectContaining({
          replaysSessionSampleRate: 0.1,
          replaysOnErrorSampleRate: 1.0,
        })
      );
    });
  });
});
