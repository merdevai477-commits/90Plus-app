/**
 * Property-Based Tests for Frontend Sentry Service
 * 
 * Tests user context setting using fast-check property-based testing.
 * Validates Requirements 1.13
 */

import * as fc from 'fast-check';
import * as Sentry from '@sentry/react-native';
import { setUser } from '../../services/sentry.service';

// Mock Sentry
jest.mock('@sentry/react-native', () => ({
  setUser: jest.fn(),
}));

describe('Frontend Sentry Service - Property-Based Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 3: User Context Setting on Authentication', () => {
    /**
     * **Validates: Requirements 1.13**
     * 
     * For any user authentication event, the Sentry service SHALL set user context 
     * containing at minimum the user ID, and optionally username and email if available.
     */
    it('should set user context with ID, username, and email for any authentication event', () => {
      fc.assert(
        fc.property(
          // Generate random user authentication data
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            username: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
            email: fc.option(fc.emailAddress(), { nil: undefined }),
          }),
          (user) => {
            // Call setUser with generated user data
            setUser(user);
            
            // Verify Sentry.setUser was called with correct parameters
            expect(Sentry.setUser).toHaveBeenCalledTimes(1);
            expect(Sentry.setUser).toHaveBeenCalledWith({
              id: user.id,
              username: user.username,
              email: user.email,
            });
            
            // Verify user ID is always present
            const callArgs = (Sentry.setUser as jest.Mock).mock.calls[0][0];
            expect(callArgs.id).toBe(user.id);
            expect(callArgs.id).toBeDefined();
            expect(callArgs.id.length).toBeGreaterThan(0);
            
            // Verify optional fields are passed through correctly
            if (user.username !== undefined) {
              expect(callArgs.username).toBe(user.username);
            }
            if (user.email !== undefined) {
              expect(callArgs.email).toBe(user.email);
            }
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set user context with only ID when username and email are undefined', () => {
      fc.assert(
        fc.property(
          // Generate random user ID only
          fc.string({ minLength: 1, maxLength: 50 }),
          (userId) => {
            // Call setUser with only ID
            setUser({ id: userId });
            
            // Verify Sentry.setUser was called
            expect(Sentry.setUser).toHaveBeenCalledTimes(1);
            expect(Sentry.setUser).toHaveBeenCalledWith({
              id: userId,
              username: undefined,
              email: undefined,
            });
            
            // Verify user ID is present
            const callArgs = (Sentry.setUser as jest.Mock).mock.calls[0][0];
            expect(callArgs.id).toBe(userId);
            expect(callArgs.id).toBeDefined();
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set user context with ID and username when email is undefined', () => {
      fc.assert(
        fc.property(
          // Generate random user ID and username
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            username: fc.string({ minLength: 3, maxLength: 20 }),
          }),
          (user) => {
            // Call setUser with ID and username
            setUser({ id: user.id, username: user.username });
            
            // Verify Sentry.setUser was called
            expect(Sentry.setUser).toHaveBeenCalledTimes(1);
            expect(Sentry.setUser).toHaveBeenCalledWith({
              id: user.id,
              username: user.username,
              email: undefined,
            });
            
            // Verify fields are present
            const callArgs = (Sentry.setUser as jest.Mock).mock.calls[0][0];
            expect(callArgs.id).toBe(user.id);
            expect(callArgs.username).toBe(user.username);
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set user context with ID and email when username is undefined', () => {
      fc.assert(
        fc.property(
          // Generate random user ID and email
          fc.record({
            id: fc.string({ minLength: 1, maxLength: 50 }),
            email: fc.emailAddress(),
          }),
          (user) => {
            // Call setUser with ID and email
            setUser({ id: user.id, email: user.email });
            
            // Verify Sentry.setUser was called
            expect(Sentry.setUser).toHaveBeenCalledTimes(1);
            expect(Sentry.setUser).toHaveBeenCalledWith({
              id: user.id,
              username: undefined,
              email: user.email,
            });
            
            // Verify fields are present
            const callArgs = (Sentry.setUser as jest.Mock).mock.calls[0][0];
            expect(callArgs.id).toBe(user.id);
            expect(callArgs.email).toBe(user.email);
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle various user ID formats', () => {
      fc.assert(
        fc.property(
          // Generate different ID formats
          fc.oneof(
            fc.uuid(), // UUID format
            fc.integer({ min: 1, max: 999999 }).map(String), // Numeric ID
            fc.string({ minLength: 10, maxLength: 30 }), // Random string
            fc.array(fc.constantFrom('0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'a', 'b', 'c', 'd', 'e', 'f'), { minLength: 16, maxLength: 32 }).map(arr => arr.join('')), // Hex string
          ),
          fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
          fc.option(fc.emailAddress(), { nil: undefined }),
          (id, username, email) => {
            // Call setUser with various ID formats
            setUser({ id, username, email });
            
            // Verify Sentry.setUser was called with correct ID
            expect(Sentry.setUser).toHaveBeenCalledTimes(1);
            const callArgs = (Sentry.setUser as jest.Mock).mock.calls[0][0];
            expect(callArgs.id).toBe(id);
            expect(callArgs.id).toBeDefined();
            expect(typeof callArgs.id).toBe('string');
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should handle special characters in username and email', () => {
      fc.assert(
        fc.property(
          fc.string({ minLength: 1, maxLength: 50 }),
          fc.string({ minLength: 3, maxLength: 20 }), // Username with any characters
          fc.emailAddress(),
          (id, username, email) => {
            // Call setUser with special characters
            setUser({ id, username, email });
            
            // Verify Sentry.setUser was called and data is preserved
            expect(Sentry.setUser).toHaveBeenCalledTimes(1);
            const callArgs = (Sentry.setUser as jest.Mock).mock.calls[0][0];
            expect(callArgs.id).toBe(id);
            expect(callArgs.username).toBe(username);
            expect(callArgs.email).toBe(email);
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });

    it('should set user context multiple times for different users', () => {
      fc.assert(
        fc.property(
          // Generate array of user authentication events
          fc.array(
            fc.record({
              id: fc.string({ minLength: 1, maxLength: 50 }),
              username: fc.option(fc.string({ minLength: 3, maxLength: 20 }), { nil: undefined }),
              email: fc.option(fc.emailAddress(), { nil: undefined }),
            }),
            { minLength: 1, maxLength: 10 }
          ),
          (users) => {
            // Simulate multiple authentication events
            users.forEach((user) => {
              setUser(user);
            });
            
            // Verify Sentry.setUser was called for each user
            expect(Sentry.setUser).toHaveBeenCalledTimes(users.length);
            
            // Verify each call had correct data
            const calls = (Sentry.setUser as jest.Mock).mock.calls;
            users.forEach((user, index) => {
              expect(calls[index][0]).toEqual({
                id: user.id,
                username: user.username,
                email: user.email,
              });
            });
            
            // Clear mock for next iteration
            jest.clearAllMocks();
          }
        ),
        { numRuns: 100 }
      );
    });
  });
});
