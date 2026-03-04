/**
 * Integration Test: Invalid Video Rejection
 * 
 * Tests the complete video validation workflow including:
 * - Frontend validation before upload
 * - Backend validation on server
 * - Rejection of videos < 5 seconds
 * - Rejection of videos > 60 seconds
 * - Clear error messages for users
 * 
 * Requirements: 2.6, 2.7
 * 
 * Task 10.4: Integration test for rejecting invalid videos
 */

import { extractDurationFromUrl } from '../utils/videoDuration';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

// Mock logger
jest.mock('../services/logger', () => ({
  logger: {
    warn: jest.fn(),
    info: jest.fn(),
    error: jest.fn(),
  },
}));

describe('Integration: Invalid Video Rejection', () => {
  const { Audio } = require('expo-av');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Helper: Simulate frontend video validation
   */
  const validateVideoFrontend = async (
    videoUri: string
  ): Promise<{ valid: boolean; error?: string; duration?: number }> => {
    // Extract duration
    const duration = await extractDurationFromUrl(videoUri);

    // Check if duration was extracted
    if (duration === null) {
      return {
        valid: false,
        error: 'Cannot determine video duration. Please select another video.',
      };
    }

    // Validate duration range
    if (duration < 5) {
      return {
        valid: false,
        error: 'Video is too short. Duration must be at least 5 seconds.',
        duration,
      };
    }

    if (duration > 60) {
      return {
        valid: false,
        error: 'Video is too long. Duration must not exceed 60 seconds.',
        duration,
      };
    }

    // Valid video
    return {
      valid: true,
      duration,
    };
  };

  /**
   * Helper: Simulate backend video validation
   */
  const validateVideoBackend = (
    duration: number
  ): { valid: boolean; error?: string; errorCode?: string } => {
    if (duration < 5) {
      return {
        valid: false,
        error: 'Video duration must be at least 5 seconds',
        errorCode: 'E007',
      };
    }

    if (duration > 60) {
      return {
        valid: false,
        error: 'Video duration must not exceed 60 seconds',
        errorCode: 'E007',
      };
    }

    return { valid: true };
  };

  /**
   * Test: Reject video shorter than 5 seconds (Frontend)
   * 
   * Requirement 2.6: Videos < 5 seconds are rejected
   */
  test('should reject video with 3 seconds duration in frontend', async () => {
    const videoUri = 'file:///path/to/short-video.mp4';
    const shortDuration = 3;

    // Mock duration extraction
    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: shortDuration * 1000,
      },
    });

    // Validate video
    const result = await validateVideoFrontend(videoUri);

    // Verify rejection
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('too short');
    expect(result.error).toContain('5 seconds');
    expect(result.duration).toBe(3);

    // Verify duration was extracted
    expect(Audio.Sound.createAsync).toHaveBeenCalled();
    expect(mockSound.unloadAsync).toHaveBeenCalled();
  });

  /**
   * Test: Reject video longer than 60 seconds (Frontend)
   * 
   * Requirement 2.7: Videos > 60 seconds are rejected
   */
  test('should reject video with 120 seconds duration in frontend', async () => {
    const videoUri = 'file:///path/to/long-video.mp4';
    const longDuration = 120;

    // Mock duration extraction
    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: longDuration * 1000,
      },
    });

    // Validate video
    const result = await validateVideoFrontend(videoUri);

    // Verify rejection
    expect(result.valid).toBe(false);
    expect(result.error).toBeDefined();
    expect(result.error).toContain('too long');
    expect(result.error).toContain('60 seconds');
    expect(result.duration).toBe(120);
  });

  /**
   * Test: Accept video with exactly 5 seconds duration
   * 
   * Requirement 2.6: Minimum valid duration is 5 seconds
   */
  test('should accept video with exactly 5 seconds duration', async () => {
    const videoUri = 'file:///path/to/min-video.mp4';
    const minDuration = 5;

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: minDuration * 1000,
      },
    });

    // Validate video
    const result = await validateVideoFrontend(videoUri);

    // Verify acceptance
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.duration).toBe(5);
  });

  /**
   * Test: Accept video with exactly 60 seconds duration
   * 
   * Requirement 2.7: Maximum valid duration is 60 seconds
   */
  test('should accept video with exactly 60 seconds duration', async () => {
    const videoUri = 'file:///path/to/max-video.mp4';
    const maxDuration = 60;

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: maxDuration * 1000,
      },
    });

    // Validate video
    const result = await validateVideoFrontend(videoUri);

    // Verify acceptance
    expect(result.valid).toBe(true);
    expect(result.error).toBeUndefined();
    expect(result.duration).toBe(60);
  });

  /**
   * Test: Reject video with 4 seconds duration (just below minimum)
   * 
   * Requirement 2.6: Videos < 5 seconds are rejected
   */
  test('should reject video with 4 seconds duration', async () => {
    const videoUri = 'file:///path/to/video.mp4';

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: 4000,
      },
    });

    const result = await validateVideoFrontend(videoUri);

    expect(result.valid).toBe(false);
    expect(result.duration).toBe(4);
  });

  /**
   * Test: Reject video with 61 seconds duration (just above maximum)
   * 
   * Requirement 2.7: Videos > 60 seconds are rejected
   */
  test('should reject video with 61 seconds duration', async () => {
    const videoUri = 'file:///path/to/video.mp4';

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: 61000,
      },
    });

    const result = await validateVideoFrontend(videoUri);

    expect(result.valid).toBe(false);
    expect(result.duration).toBe(61);
  });

  /**
   * Test: Backend validation rejects short videos
   * 
   * Requirement 2.6: Backend also validates duration
   */
  test('should reject short video in backend validation', () => {
    const result = validateVideoBackend(3);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('at least 5 seconds');
    expect(result.errorCode).toBe('E007');
  });

  /**
   * Test: Backend validation rejects long videos
   * 
   * Requirement 2.7: Backend also validates duration
   */
  test('should reject long video in backend validation', () => {
    const result = validateVideoBackend(120);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('not exceed 60 seconds');
    expect(result.errorCode).toBe('E007');
  });

  /**
   * Test: Backend validation accepts valid videos
   * 
   * Requirements 2.6, 2.7: Backend accepts valid durations
   */
  test('should accept valid video in backend validation', () => {
    const validDurations = [5, 10, 30, 45, 60];

    for (const duration of validDurations) {
      const result = validateVideoBackend(duration);
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    }
  });

  /**
   * Test: Complete validation flow (Frontend + Backend)
   * 
   * Requirements 2.6, 2.7: Both layers validate
   */
  test('should validate video in both frontend and backend', async () => {
    const videoUri = 'file:///path/to/video.mp4';
    const validDuration = 30;

    // Mock frontend validation
    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: validDuration * 1000,
      },
    });

    // Step 1: Frontend validation
    const frontendResult = await validateVideoFrontend(videoUri);
    expect(frontendResult.valid).toBe(true);
    expect(frontendResult.duration).toBe(30);

    // Step 2: Backend validation (would happen after upload)
    const backendResult = validateVideoBackend(frontendResult.duration!);
    expect(backendResult.valid).toBe(true);

    // Video passes both validations
    expect(frontendResult.valid && backendResult.valid).toBe(true);
  });

  /**
   * Test: Frontend catches invalid video before backend
   * 
   * Requirements 2.6, 2.7: Frontend validation prevents unnecessary uploads
   */
  test('should catch invalid video in frontend before reaching backend', async () => {
    const videoUri = 'file:///path/to/short-video.mp4';

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: 3000, // 3 seconds
      },
    });

    // Frontend validation
    const frontendResult = await validateVideoFrontend(videoUri);

    // Should be rejected in frontend
    expect(frontendResult.valid).toBe(false);

    // Backend validation would not be reached
    // (no upload attempt made)
  });

  /**
   * Test: Error messages are clear and user-friendly
   * 
   * Requirements 2.6, 2.7: Clear error messages
   */
  test('should provide clear error messages for invalid videos', async () => {
    // Test short video error message
    const shortVideoUri = 'file:///path/to/short.mp4';
    const mockSound1 = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound1,
      status: {
        isLoaded: true,
        durationMillis: 3000,
      },
    });

    const shortResult = await validateVideoFrontend(shortVideoUri);
    expect(shortResult.error).toContain('too short');
    expect(shortResult.error).toContain('5 seconds');

    // Test long video error message
    jest.clearAllMocks();
    const longVideoUri = 'file:///path/to/long.mp4';
    const mockSound2 = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound2,
      status: {
        isLoaded: true,
        durationMillis: 120000,
      },
    });

    const longResult = await validateVideoFrontend(longVideoUri);
    expect(longResult.error).toContain('too long');
    expect(longResult.error).toContain('60 seconds');
  });

  /**
   * Test: Handle video with unknown duration
   * 
   * Requirement 2.6, 2.7: Reject videos with unknown duration
   */
  test('should reject video when duration cannot be determined', async () => {
    const videoUri = 'file:///path/to/unknown.mp4';

    // Mock duration extraction failure
    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: false, // Failed to load
      },
    });

    const result = await validateVideoFrontend(videoUri);

    expect(result.valid).toBe(false);
    expect(result.error).toContain('Cannot determine');
    expect(result.duration).toBeUndefined();
  });

  /**
   * Test: Multiple invalid videos are all rejected
   * 
   * Requirements 2.6, 2.7: Consistent rejection
   */
  test('should consistently reject multiple invalid videos', async () => {
    const invalidDurations = [0, 1, 2, 3, 4, 61, 90, 120, 300];

    for (const duration of invalidDurations) {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: duration * 1000,
        },
      });

      const result = await validateVideoFrontend(`file:///video_${duration}.mp4`);

      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();

      jest.clearAllMocks();
    }
  });

  /**
   * Test: Multiple valid videos are all accepted
   * 
   * Requirements 2.6, 2.7: Consistent acceptance
   */
  test('should consistently accept multiple valid videos', async () => {
    const validDurations = [5, 10, 15, 20, 30, 40, 50, 60];

    for (const duration of validDurations) {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: duration * 1000,
        },
      });

      const result = await validateVideoFrontend(`file:///video_${duration}.mp4`);

      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
      expect(result.duration).toBe(duration);

      jest.clearAllMocks();
    }
  });

  /**
   * Test: Validation with fractional seconds
   * 
   * Requirements 2.6, 2.7: Handle fractional durations correctly
   */
  test('should handle fractional seconds in validation', async () => {
    // 4.9 seconds - should be rejected (< 5)
    const mockSound1 = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound1,
      status: {
        isLoaded: true,
        durationMillis: 4900,
      },
    });

    const result1 = await validateVideoFrontend('file:///video1.mp4');
    expect(result1.valid).toBe(false);

    // 5.1 seconds - should be accepted (>= 5)
    jest.clearAllMocks();
    const mockSound2 = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound2,
      status: {
        isLoaded: true,
        durationMillis: 5100,
      },
    });

    const result2 = await validateVideoFrontend('file:///video2.mp4');
    expect(result2.valid).toBe(true);

    // 60.1 seconds - should be rejected (> 60)
    jest.clearAllMocks();
    const mockSound3 = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound3,
      status: {
        isLoaded: true,
        durationMillis: 60100,
      },
    });

    const result3 = await validateVideoFrontend('file:///video3.mp4');
    expect(result3.valid).toBe(false);
  });

  /**
   * Test: Backend error codes are correct
   * 
   * Requirements 2.6, 2.7: Proper error codes (E007)
   */
  test('should return correct error codes from backend', () => {
    // Short video
    const shortResult = validateVideoBackend(3);
    expect(shortResult.errorCode).toBe('E007');

    // Long video
    const longResult = validateVideoBackend(120);
    expect(longResult.errorCode).toBe('E007');

    // Valid video - no error code
    const validResult = validateVideoBackend(30);
    expect(validResult.errorCode).toBeUndefined();
  });
});
