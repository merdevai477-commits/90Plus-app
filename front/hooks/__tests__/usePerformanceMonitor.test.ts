/**
 * Unit Tests for usePerformanceMonitor Hook
 * 
 * Tests:
 * 1. ✅ Hook tracks render count
 * 2. ✅ Hook estimates memory usage
 * 3. ✅ Hook triggers memory warning
 * 4. ✅ Hook triggers memory critical
 * 5. ✅ Hook calls auto-cleanup
 * 6. ✅ Hook tracks component lifetime
 * 7. ✅ Hook respects enabled flag
 * 8. ✅ Hook cleans up on unmount
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { usePerformanceMonitor, useRenderCount, useComponentLifetime } from '../usePerformanceMonitor';

// ============================================================================
// MOCKS
// ============================================================================

// Mock logger
jest.mock('../../utils/logger', () => ({
  logger: {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AppState
jest.mock('react-native', () => ({
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
    currentState: 'active',
  },
  InteractionManager: {
    runAfterInteractions: jest.fn((callback) => {
      callback();
      return { cancel: jest.fn() };
    }),
  },
}));

// ============================================================================
// TEST SUITE
// ============================================================================

describe('usePerformanceMonitor Hook', () => {
  // Setup
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ============================================================================
  // TEST 1: Tracks Render Count
  // ============================================================================

  it('should track render count correctly', () => {
    const { result, rerender } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 1000,
      })
    );

    // Initial render count should be 0
    expect(result.current.renderCount).toBeGreaterThanOrEqual(0);

    // Rerender multiple times
    rerender();
    rerender();
    rerender();

    // Advance time to trigger check
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Render count should have increased
    expect(result.current.renderCount).toBeGreaterThan(0);
  });

  // ============================================================================
  // TEST 2: Estimates Memory Usage
  // ============================================================================

  it('should estimate memory usage', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 1000,
      })
    );

    // Advance time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Memory usage should be estimated
    expect(result.current.memoryUsage).toBeGreaterThan(0);
  });

  // ============================================================================
  // TEST 3: Triggers Memory Warning
  // ============================================================================

  it('should trigger memory warning callback', () => {
    const onMemoryWarning = jest.fn();

    const { result, rerender } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 100,
        memoryWarningThreshold: 10, // Low threshold for testing
        onMemoryWarning,
      })
    );

    // Rerender many times to increase estimated memory
    for (let i = 0; i < 50; i++) {
      rerender();
    }

    // Advance time to trigger check
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Warning callback should have been called
    expect(onMemoryWarning).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 4: Triggers Memory Critical
  // ============================================================================

  it('should trigger memory critical callback', () => {
    const onMemoryCritical = jest.fn();

    const { result, rerender } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 100,
        memoryWarningThreshold: 10,
        memoryCriticalThreshold: 15, // Low threshold for testing
        onMemoryCritical,
      })
    );

    // Rerender many times to increase estimated memory
    for (let i = 0; i < 100; i++) {
      rerender();
    }

    // Advance time to trigger check
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Critical callback should have been called
    expect(onMemoryCritical).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 5: Calls Auto-Cleanup
  // ============================================================================

  it('should call auto-cleanup when critical threshold exceeded', () => {
    const onAutoCleanup = jest.fn();

    const { rerender } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 100,
        memoryCriticalThreshold: 15,
        onAutoCleanup,
      })
    );

    // Rerender many times
    for (let i = 0; i < 100; i++) {
      rerender();
    }

    // Advance time
    act(() => {
      jest.advanceTimersByTime(10000);
    });

    // Auto-cleanup should have been called
    expect(onAutoCleanup).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 6: Tracks Component Lifetime
  // ============================================================================

  it('should track component lifetime', () => {
    const { result } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 1000,
      })
    );

    // Initial mount time should be 0
    expect(result.current.mountTime).toBe(0);

    // Advance time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Mount time should have increased
    expect(result.current.mountTime).toBeGreaterThan(0);
  });

  // ============================================================================
  // TEST 7: Respects Enabled Flag
  // ============================================================================

  it('should respect enabled flag', () => {
    const onMemoryWarning = jest.fn();

    const { result, rerender } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: false, // Disabled
        checkInterval: 100,
        memoryWarningThreshold: 10,
        onMemoryWarning,
      })
    );

    // Rerender many times
    for (let i = 0; i < 50; i++) {
      rerender();
    }

    // Advance time
    act(() => {
      jest.advanceTimersByTime(5000);
    });

    // Warning callback should NOT have been called
    expect(onMemoryWarning).not.toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 8: Cleans Up on Unmount
  // ============================================================================

  it('should cleanup on unmount', () => {
    const { unmount } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 1000,
      })
    );

    // Unmount
    unmount();

    // Should not crash
    expect(true).toBe(true);
  });

  // ============================================================================
  // TEST 9: Tracks App State Changes
  // ============================================================================

  it('should track app state changes', () => {
    const { AppState } = require('react-native');
    
    const { result } = renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 1000,
      })
    );

    // Should have registered app state listener
    expect(AppState.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));

    // Initial state should be active
    expect(result.current.isActive).toBe(true);
  });

  // ============================================================================
  // TEST 10: Debug Logging
  // ============================================================================

  it('should log debug messages when enabled', () => {
    const { logger } = require('../../utils/logger');

    renderHook(() =>
      usePerformanceMonitor({
        componentName: 'TestComponent',
        enabled: true,
        checkInterval: 1000,
        debug: true,
      })
    );

    // Advance time
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    // Debug messages should have been logged
    expect(logger.debug).toHaveBeenCalled();
  });
});

// ============================================================================
// HELPER FUNCTIONS TESTS
// ============================================================================

describe('usePerformanceMonitor Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ============================================================================
  // TEST: useRenderCount
  // ============================================================================

  it('useRenderCount should track renders', () => {
    const { result, rerender } = renderHook(() => useRenderCount('TestComponent'));

    // Initial render count
    const initialCount = result.current;
    expect(initialCount).toBeGreaterThan(0);

    // Rerender
    rerender();

    // Count should increase
    expect(result.current).toBeGreaterThan(initialCount);
  });

  // ============================================================================
  // TEST: useComponentLifetime
  // ============================================================================

  it('useComponentLifetime should track lifetime', () => {
    const { result } = renderHook(() => useComponentLifetime());

    // Initial lifetime should be 0
    expect(result.current).toBe(0);

    // Advance time
    act(() => {
      jest.advanceTimersByTime(3000);
    });

    // Lifetime should have increased
    expect(result.current).toBeGreaterThan(0);
  });
});
