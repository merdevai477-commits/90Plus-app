/**
 * Unit Tests for useSafeAnimation Hook
 * 
 * Tests:
 * 1. ✅ Hook creates animation correctly
 * 2. ✅ Hook starts animation
 * 3. ✅ Hook stops animation
 * 4. ✅ Hook resets animation
 * 5. ✅ Hook tracks running state
 * 6. ✅ Hook cleans up on unmount
 * 7. ✅ Hook handles timing animation
 * 8. ✅ Hook handles spring animation
 * 9. ✅ Hook handles loop animation
 * 10. ✅ useSafeLoop helper works
 * 11. ✅ useSafeSpring helper works
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { renderHook, act } from '@testing-library/react-hooks';
import { Animated, Easing } from 'react-native';
import { useSafeAnimation, useSafeLoop, useSafeSpring } from '../useSafeAnimation';

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

// Mock Animated
const mockStart = jest.fn((callback) => {
  // Simulate animation completion
  if (callback) {
    setTimeout(() => callback({ finished: true }), 0);
  }
});

const mockStop = jest.fn();

jest.mock('react-native', () => ({
  Animated: {
    Value: jest.fn().mockImplementation((value) => ({
      setValue: jest.fn(),
      interpolate: jest.fn(),
      _value: value,
    })),
    timing: jest.fn(() => ({
      start: mockStart,
      stop: mockStop,
    })),
    spring: jest.fn(() => ({
      start: mockStart,
      stop: mockStop,
    })),
    decay: jest.fn(() => ({
      start: mockStart,
      stop: mockStop,
    })),
    loop: jest.fn((animation) => ({
      start: mockStart,
      stop: mockStop,
      _animation: animation,
    })),
  },
  Easing: {
    inOut: jest.fn((easing) => easing),
    ease: jest.fn(),
    bezier: jest.fn(() => jest.fn()),
  },
  AppState: {
    addEventListener: jest.fn(() => ({
      remove: jest.fn(),
    })),
  },
}));

// Mock useAnimationCleanup
jest.mock('../useAnimationCleanup', () => ({
  useAnimationCleanup: jest.fn(() => ({
    registerAnimatedValue: jest.fn(),
    registerAnimation: jest.fn(),
    registerTimer: jest.fn(),
    registerListener: jest.fn(),
    cleanup: jest.fn(),
    isMounted: jest.fn(() => true),
  })),
}));

// ============================================================================
// TEST SUITE
// ============================================================================

describe('useSafeAnimation Hook', () => {
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
  // TEST 1: Creates Animation Correctly
  // ============================================================================

  it('should create animation with correct config', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
        useNativeDriver: true,
      })
    );

    expect(result.current.animatedValue).toBeDefined();
    expect(Animated.Value).toHaveBeenCalledWith(0);
  });

  // ============================================================================
  // TEST 2: Starts Animation
  // ============================================================================

  it('should start animation correctly', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
      })
    );

    // Start animation
    act(() => {
      result.current.start();
    });

    // Animated.timing should have been called
    expect(Animated.timing).toHaveBeenCalled();
    
    // start should have been called
    expect(mockStart).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 3: Stops Animation
  // ============================================================================

  it('should stop animation correctly', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
      })
    );

    // Start animation
    act(() => {
      result.current.start();
    });

    // Stop animation
    act(() => {
      result.current.stop();
    });

    // stop should have been called
    expect(mockStop).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 4: Resets Animation
  // ============================================================================

  it('should reset animation to initial value', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
      })
    );

    // Start animation
    act(() => {
      result.current.start();
    });

    // Reset animation
    act(() => {
      result.current.reset();
    });

    // setValue should have been called with initial value
    expect(result.current.animatedValue.setValue).toHaveBeenCalledWith(0);
    
    // stop should have been called
    expect(mockStop).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 5: Tracks Running State
  // ============================================================================

  it('should track running state correctly', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
      })
    );

    // Initially not running
    expect(result.current.isRunning()).toBe(false);

    // Start animation
    act(() => {
      result.current.start();
    });

    // Should be running
    expect(result.current.isRunning()).toBe(true);

    // Stop animation
    act(() => {
      result.current.stop();
    });

    // Should not be running
    expect(result.current.isRunning()).toBe(false);
  });

  // ============================================================================
  // TEST 6: Cleans Up on Unmount
  // ============================================================================

  it('should cleanup on unmount', () => {
    const { result, unmount } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
      })
    );

    // Start animation
    act(() => {
      result.current.start();
    });

    // Unmount
    unmount();

    // stop should have been called
    expect(mockStop).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 7: Handles Timing Animation
  // ============================================================================

  it('should handle timing animation', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 100,
        duration: 500,
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      })
    );

    act(() => {
      result.current.start();
    });

    expect(Animated.timing).toHaveBeenCalledWith(
      result.current.animatedValue,
      expect.objectContaining({
        toValue: 100,
        duration: 500,
      })
    );
  });

  // ============================================================================
  // TEST 8: Handles Spring Animation
  // ============================================================================

  it('should handle spring animation', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'spring',
        toValue: 100,
        tension: 40,
        friction: 7,
      })
    );

    act(() => {
      result.current.start();
    });

    expect(Animated.spring).toHaveBeenCalledWith(
      result.current.animatedValue,
      expect.objectContaining({
        toValue: 100,
        tension: 40,
        friction: 7,
      })
    );
  });

  // ============================================================================
  // TEST 9: Handles Loop Animation
  // ============================================================================

  it('should handle loop animation', () => {
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
        loop: true,
      })
    );

    act(() => {
      result.current.start();
    });

    expect(Animated.loop).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 10: Calls onComplete Callback
  // ============================================================================

  it('should call onComplete callback when animation finishes', async () => {
    const onComplete = jest.fn();
    
    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 100,
        onComplete,
      })
    );

    act(() => {
      result.current.start();
    });

    // Wait for animation to complete
    await act(async () => {
      await new Promise(resolve => setTimeout(resolve, 150));
    });

    expect(onComplete).toHaveBeenCalled();
  });

  // ============================================================================
  // TEST 11: Prevents Start After Unmount
  // ============================================================================

  it('should prevent start after unmount', () => {
    const { useAnimationCleanup } = require('../useAnimationCleanup');
    
    // Mock isMounted to return false
    useAnimationCleanup.mockReturnValue({
      registerAnimatedValue: jest.fn(),
      registerAnimation: jest.fn(),
      isMounted: jest.fn(() => false),
    });

    const { result } = renderHook(() =>
      useSafeAnimation(0, {
        type: 'timing',
        toValue: 1,
        duration: 1000,
        debug: true,
      })
    );

    // Clear previous calls
    mockStart.mockClear();

    // Try to start after unmount
    act(() => {
      result.current.start();
    });

    // start should NOT have been called
    expect(mockStart).not.toHaveBeenCalled();
  });
});

// ============================================================================
// HELPER FUNCTIONS TESTS
// ============================================================================

describe('useSafeAnimation Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.runOnlyPendingTimers();
    jest.useRealTimers();
  });

  // ============================================================================
  // TEST: useSafeLoop
  // ============================================================================

  it('useSafeLoop should create loop animation', () => {
    const { result } = renderHook(() =>
      useSafeLoop(0, 1, 1000, {
        easing: Easing.bezier(0.4, 0.0, 0.2, 1),
      })
    );

    act(() => {
      result.current.start();
    });

    expect(Animated.loop).toHaveBeenCalled();
    expect(Animated.timing).toHaveBeenCalledWith(
      result.current.animatedValue,
      expect.objectContaining({
        toValue: 1,
        duration: 1000,
        loop: true,
      })
    );
  });

  // ============================================================================
  // TEST: useSafeSpring
  // ============================================================================

  it('useSafeSpring should create spring animation', () => {
    const { result } = renderHook(() =>
      useSafeSpring(0, 100, {
        tension: 40,
        friction: 7,
      })
    );

    act(() => {
      result.current.start();
    });

    expect(Animated.spring).toHaveBeenCalledWith(
      result.current.animatedValue,
      expect.objectContaining({
        toValue: 100,
        tension: 40,
        friction: 7,
      })
    );
  });
});
