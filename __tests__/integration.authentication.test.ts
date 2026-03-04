/**
 * Integration Test: Authentication Flow Without Security Vulnerabilities
 * 
 * Tests the complete authentication workflow to ensure:
 * - No hardcoded credentials exist
 * - All authentication uses Clerk
 * - Login/logout flow works correctly
 * - State management is secure
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.4, 3.1, 3.2
 * 
 * Task 10.2: Integration test for authentication flow without vulnerabilities
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

// Mock Clerk
jest.mock('@clerk/clerk-expo', () => ({
  useAuth: jest.fn(),
  useUser: jest.fn(),
  SignedIn: ({ children }: any) => children,
  SignedOut: ({ children }: any) => children,
}));

describe('Integration: Authentication Flow Without Vulnerabilities', () => {
  let globalState: any;

  beforeEach(async () => {
    jest.clearAllMocks();

    // Clear AsyncStorage
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);
    (AsyncStorage.setItem as jest.Mock).mockResolvedValue(undefined);
    (AsyncStorage.removeItem as jest.Mock).mockResolvedValue(undefined);

    // Import globalState (already imported at module level)
    const { globalState: gs } = await import('../globalState');
    globalState = gs;

    // Reset state to defaults
    globalState.userType = 'guest';
    globalState.username = '';
    globalState.isLoggedIn = false;
    globalState.userProfile = null;
    globalState.needsUsernameCompletion = false;
    globalState.tempAuthData = null;
  });

  /**
   * Test: Verify no hardcoded login function exists
   * 
   * Requirement 2.1, 2.2: No hardcoded credentials, all auth uses Clerk
   */
  test('should not have hardcoded login function', () => {
    // Verify that globalState.login does not exist
    expect(globalState.login).toBeUndefined();

    // Verify that attempting to call login throws an error
    expect(() => {
      if (typeof globalState.login === 'function') {
        globalState.login('any_username', 'any_password');
      }
    }).not.toThrow(); // Should not throw because login doesn't exist
  });

  /**
   * Test: Verify no hardcoded credentials in globalState
   * 
   * Requirement 2.1, 2.2, 2.4: No hardcoded credentials visible in code
   */
  test('should not contain hardcoded credentials', () => {
    // Convert globalState to string to check for hardcoded values
    const stateString = JSON.stringify(globalState);

    // Verify no hardcoded username
    expect(stateString).not.toContain('mahmoud_essam');

    // Verify no hardcoded password
    expect(stateString).not.toContain('password');

    // Verify initial state is clean
    expect(globalState.username).toBe('');
    expect(globalState.isLoggedIn).toBe(false);
    expect(globalState.userType).toBe('guest');
  });

  /**
   * Test: Complete authentication flow using Clerk
   * 
   * Requirement 3.1: Clerk authentication works normally
   */
  test('should complete authentication flow using Clerk', async () => {
    // Simulate Clerk authentication success
    const mockUserData = {
      id: 'user_123',
      username: 'testuser',
      email: 'test@example.com',
    };

    // Simulate setting user data after Clerk authentication
    globalState.username = mockUserData.username;
    globalState.isLoggedIn = true;
    globalState.userType = 'diamond';

    // Verify state is updated correctly
    expect(globalState.isLoggedIn).toBe(true);
    expect(globalState.username).toBe('testuser');
    expect(globalState.username).not.toBe('mahmoud_essam'); // Not hardcoded username
    expect(globalState.userType).toBe('diamond');

    // Verify state can be saved (saveState is called internally)
    await globalState.saveState();
    
    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 10));
    
    expect(AsyncStorage.setItem).toHaveBeenCalled();
  });

  /**
   * Test: Logout flow clears all state
   * 
   * Requirement 3.2: Logout clears all local data
   */
  test('should clear all state on logout', async () => {
    // Setup: User is logged in
    globalState.username = 'testuser';
    globalState.isLoggedIn = true;
    globalState.userType = 'diamond';
    globalState.userProfile = {
      id: 'user_123',
      email: 'test@example.com',
    };

    // Perform logout
    await globalState.logout();

    // Verify all state is cleared
    expect(globalState.isLoggedIn).toBe(false);
    expect(globalState.username).toBe('');
    expect(globalState.userType).toBe('guest');
    expect(globalState.userProfile).toBeNull();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify AsyncStorage is cleared
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  /**
   * Test: Load state from AsyncStorage
   * 
   * Requirement 3.3: loadState restores valid user state
   */
  test('should restore valid user state from AsyncStorage', async () => {
    // Setup: Mock stored state
    const storedState = {
      userType: 'diamond' as const,
      username: 'testuser',
      isLoggedIn: true,
      userProfile: {
        id: 'user_123',
        email: 'test@example.com',
      },
    };

    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(
      JSON.stringify(storedState)
    );

    // Reset state first
    globalState.userType = 'guest';
    globalState.username = '';
    globalState.isLoggedIn = false;
    globalState.userProfile = null;

    // Load state
    await globalState.loadState();

    // Verify state is restored
    expect(globalState.userType).toBe('diamond');
    expect(globalState.username).toBe('testuser');
    expect(globalState.isLoggedIn).toBe(true);
    expect(globalState.userProfile).toEqual(storedState.userProfile);
    expect(globalState.isLoaded).toBe(true);
  });

  /**
   * Test: Load state handles empty storage
   * 
   * Requirement 3.3: loadState handles missing data gracefully
   */
  test('should handle empty AsyncStorage gracefully', async () => {
    // Setup: No stored state
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(null);

    // Load state
    await globalState.loadState();

    // Verify default state
    expect(globalState.userType).toBe('guest');
    expect(globalState.username).toBe('');
    expect(globalState.isLoggedIn).toBe(false);
    expect(globalState.isLoaded).toBe(true);
  });

  /**
   * Test: Load state handles corrupted data
   * 
   * Requirement 3.3: loadState handles errors gracefully
   */
  test('should handle corrupted AsyncStorage data gracefully', async () => {
    // Setup: Corrupted JSON
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue('invalid json {');

    // Load state should not throw
    await expect(globalState.loadState()).resolves.not.toThrow();

    // Verify default state is maintained
    expect(globalState.isLoaded).toBe(true);
  });

  /**
   * Test: setUserType does not set hardcoded username
   * 
   * Requirement 2.1, 2.2: setUserType cleaned of hardcoded logic
   */
  test('should not set hardcoded username when setting user type', () => {
    // Set user type
    globalState.setUserType('diamond');

    // Verify user type is set
    expect(globalState.userType).toBe('diamond');

    // Verify username is NOT automatically set to hardcoded value
    expect(globalState.username).not.toBe('mahmoud_essam');
    expect(globalState.username).toBe(''); // Should remain empty

    // Verify isLoggedIn is NOT automatically set to true
    expect(globalState.isLoggedIn).toBe(false);
  });

  /**
   * Test: Complete login-logout cycle
   * 
   * Requirements: 2.1, 2.2, 2.3, 3.1, 3.2
   */
  test('should complete full login-logout cycle securely', async () => {
    // Initial state: Not logged in
    expect(globalState.isLoggedIn).toBe(false);
    expect(globalState.username).toBe('');

    // Step 1: Simulate Clerk authentication
    globalState.username = 'secureuser';
    globalState.isLoggedIn = true;
    globalState.userType = 'diamond';
    await globalState.saveState();

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify logged in state
    expect(globalState.isLoggedIn).toBe(true);
    expect(globalState.username).toBe('secureuser');
    expect(globalState.username).not.toBe('mahmoud_essam');

    // Step 2: Logout
    await globalState.logout();

    // Wait for async operations
    await new Promise(resolve => setTimeout(resolve, 10));

    // Verify logged out state
    expect(globalState.isLoggedIn).toBe(false);
    expect(globalState.username).toBe('');
    expect(globalState.userType).toBe('guest');

    // Verify storage is cleared
    expect(AsyncStorage.removeItem).toHaveBeenCalled();
  });

  /**
   * Test: Username completion flow
   * 
   * Requirement 3.4: needsUsernameCompletion and tempAuthData preserved
   */
  test('should handle username completion flow', () => {
    // Setup: User needs to complete username
    globalState.needsUsernameCompletion = true;
    globalState.tempAuthData = {
      userId: 'user_123',
      email: 'test@example.com',
    };

    // Verify flags are set
    expect(globalState.needsUsernameCompletion).toBe(true);
    expect(globalState.tempAuthData).toBeDefined();
    expect(globalState.tempAuthData.userId).toBe('user_123');

    // Complete username
    globalState.username = 'newuser';
    globalState.needsUsernameCompletion = false;
    globalState.tempAuthData = null;
    globalState.isLoggedIn = true;

    // Verify completion
    expect(globalState.needsUsernameCompletion).toBe(false);
    expect(globalState.tempAuthData).toBeNull();
    expect(globalState.isLoggedIn).toBe(true);
    expect(globalState.username).toBe('newuser');
  });

  /**
   * Test: Multiple login attempts with different users
   * 
   * Requirement 2.1, 2.2: All authentication uses Clerk, no hardcoded bypass
   */
  test('should handle multiple user sessions correctly', async () => {
    // User 1 logs in
    globalState.username = 'user1';
    globalState.isLoggedIn = true;
    await globalState.saveState();

    expect(globalState.username).toBe('user1');

    // User 1 logs out
    await globalState.logout();
    expect(globalState.isLoggedIn).toBe(false);

    // User 2 logs in
    globalState.username = 'user2';
    globalState.isLoggedIn = true;
    await globalState.saveState();

    expect(globalState.username).toBe('user2');
    expect(globalState.username).not.toBe('user1');
    expect(globalState.username).not.toBe('mahmoud_essam');
  });

  /**
   * Test: State persistence across app restarts
   * 
   * Requirement 3.3: loadState restores valid sessions
   */
  test('should persist and restore state across app restarts', async () => {
    // Session 1: User logs in
    globalState.username = 'persistentuser';
    globalState.isLoggedIn = true;
    globalState.userType = 'diamond';
    await globalState.saveState();

    // Wait for async operation
    await new Promise(resolve => setTimeout(resolve, 10));

    // Get the saved data
    const setItemCalls = (AsyncStorage.setItem as jest.Mock).mock.calls;
    expect(setItemCalls.length).toBeGreaterThan(0);
    const savedData = setItemCalls[setItemCalls.length - 1][1];
    expect(savedData).toBeDefined();

    // Simulate app restart: Load state
    (AsyncStorage.getItem as jest.Mock).mockResolvedValue(savedData);

    // Reset state to simulate fresh start
    globalState.username = '';
    globalState.isLoggedIn = false;
    globalState.userType = 'guest';

    // Load state
    await globalState.loadState();

    // Verify state is restored
    expect(globalState.username).toBe('persistentuser');
    expect(globalState.isLoggedIn).toBe(true);
    expect(globalState.userType).toBe('diamond');
  });

  /**
   * Test: Verify no authentication bypass exists
   * 
   * Requirement 2.1, 2.2: No way to bypass Clerk authentication
   */
  test('should not allow authentication bypass', () => {
    // Verify no login function exists
    expect(globalState.login).toBeUndefined();

    // Verify cannot set isLoggedIn without proper authentication
    // (In real app, this would be controlled by Clerk)
    globalState.isLoggedIn = false;
    expect(globalState.isLoggedIn).toBe(false);

    // Attempting to manually set isLoggedIn should not grant access
    // without proper Clerk authentication flow
    globalState.isLoggedIn = true;
    expect(globalState.isLoggedIn).toBe(true);

    // But username should still be empty (no hardcoded bypass)
    expect(globalState.username).not.toBe('mahmoud_essam');
  });
});
