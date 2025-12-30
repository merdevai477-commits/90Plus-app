/**
 * Jest Setup File
 * 
 * This file runs before each test file and sets up the test environment.
 */

// Define __DEV__ global for React Native compatibility
global.__DEV__ = true;

// Suppress console warnings during tests (optional)
// Uncomment if you want cleaner test output
// global.console.warn = jest.fn();

// Mock fetch globally if not already defined
if (typeof global.fetch === 'undefined') {
  global.fetch = jest.fn();
}
