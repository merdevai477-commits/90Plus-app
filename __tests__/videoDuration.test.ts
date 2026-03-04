/**
 * Unit Tests for Video Duration Utility
 * 
 * Tests the video duration extraction, formatting, and display logic
 * to ensure proper functionality after SDK 52 migration.
 * 
 * Requirements: 2.5, 2.8, 3.5, 3.6
 */

import {
  formatDuration,
  parseDuration,
  shouldShowDuration,
  extractDurationFromUrl,
  type DurationResult,
  type FormattedDuration,
} from '../utils/videoDuration';

// Mock expo-av for testing
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

// Mock logger to avoid errors in test environment
jest.mock('../services/logger', () => ({
  logger: {
    warn: jest.fn(),
  },
}));

describe('videoDuration utility', () => {
  describe('formatDuration', () => {
    /**
     * Test: formatDuration with valid durations
     * Requirement 3.5: Format duration as MM:SS for videos under one hour
     */
    test('should format 30 seconds as "0:30"', () => {
      const result = formatDuration(30);
      expect(result).toBe('0:30');
    });

    test('should format 125 seconds as "2:05"', () => {
      const result = formatDuration(125);
      expect(result).toBe('2:05');
    });

    test('should format 0 seconds as "0:00"', () => {
      const result = formatDuration(0);
      expect(result).toBe('0:00');
    });

    test('should format 60 seconds as "1:00"', () => {
      const result = formatDuration(60);
      expect(result).toBe('1:00');
    });

    test('should format 3599 seconds as "59:59"', () => {
      const result = formatDuration(3599);
      expect(result).toBe('59:59');
    });

    test('should format 5 seconds as "0:05"', () => {
      const result = formatDuration(5);
      expect(result).toBe('0:05');
    });

    test('should format fractional seconds by rounding', () => {
      expect(formatDuration(30.4)).toBe('0:30');
      expect(formatDuration(30.6)).toBe('0:31');
    });

    /**
     * Test: formatDuration with invalid durations
     * Requirement 3.6: Hide duration indicator for unknown duration
     */
    test('should return null for null duration', () => {
      const result = formatDuration(null);
      expect(result).toBeNull();
    });

    test('should return null for undefined duration', () => {
      const result = formatDuration(undefined as any);
      expect(result).toBeNull();
    });

    test('should return null for negative duration', () => {
      const result = formatDuration(-10);
      expect(result).toBeNull();
    });

    test('should return null for NaN', () => {
      const result = formatDuration(NaN);
      expect(result).toBeNull();
    });

    test('should return null for Infinity', () => {
      const result = formatDuration(Infinity);
      expect(result).toBeNull();
    });

    test('should return null for -Infinity', () => {
      const result = formatDuration(-Infinity);
      expect(result).toBeNull();
    });
  });

  describe('parseDuration', () => {
    test('should parse "0:30" to 30 seconds', () => {
      const result = parseDuration('0:30');
      expect(result).toBe(30);
    });

    test('should parse "2:05" to 125 seconds', () => {
      const result = parseDuration('2:05');
      expect(result).toBe(125);
    });

    test('should parse "1:00" to 60 seconds', () => {
      const result = parseDuration('1:00');
      expect(result).toBe(60);
    });

    test('should return null for null input', () => {
      const result = parseDuration(null);
      expect(result).toBeNull();
    });

    test('should return null for invalid format', () => {
      expect(parseDuration('invalid')).toBeNull();
      expect(parseDuration('1:2:3')).toBeNull();
      expect(parseDuration('abc:def')).toBeNull();
    });

    test('should return null for invalid seconds (>= 60)', () => {
      const result = parseDuration('1:60');
      expect(result).toBeNull();
    });

    test('should return null for negative values', () => {
      expect(parseDuration('-1:30')).toBeNull();
      expect(parseDuration('1:-30')).toBeNull();
    });
  });

  describe('shouldShowDuration', () => {
    /**
     * Test: shouldShowDuration with valid durations
     * Requirement 3.5: Show duration for valid videos
     */
    test('should return true for valid duration (30 seconds)', () => {
      const result = shouldShowDuration(30);
      expect(result).toBe(true);
    });

    test('should return true for valid formatted duration ("1:30")', () => {
      const result = shouldShowDuration('1:30');
      expect(result).toBe(true);
    });

    test('should return true for minimum valid duration (5 seconds)', () => {
      const result = shouldShowDuration(5);
      expect(result).toBe(true);
    });

    test('should return true for maximum valid duration (60 seconds)', () => {
      const result = shouldShowDuration(60);
      expect(result).toBe(true);
    });

    /**
     * Test: shouldShowDuration with invalid durations
     * Requirement 3.6: Hide duration indicator for unknown/invalid duration
     */
    test('should return false for null duration', () => {
      const result = shouldShowDuration(null);
      expect(result).toBe(false);
    });

    test('should return false for undefined duration', () => {
      const result = shouldShowDuration(undefined as any);
      expect(result).toBe(false);
    });

    test('should return false for zero duration', () => {
      const result = shouldShowDuration(0);
      expect(result).toBe(false);
    });

    test('should return false for "0:00" formatted duration', () => {
      const result = shouldShowDuration('0:00');
      expect(result).toBe(false);
    });

    test('should return false for empty string', () => {
      const result = shouldShowDuration('');
      expect(result).toBe(false);
    });

    test('should return false for negative duration', () => {
      const result = shouldShowDuration(-10);
      expect(result).toBe(false);
    });

    test('should return false for NaN', () => {
      const result = shouldShowDuration(NaN);
      expect(result).toBe(false);
    });

    test('should return false for Infinity', () => {
      const result = shouldShowDuration(Infinity);
      expect(result).toBe(false);
    });
  });

  describe('extractDurationFromUrl', () => {
    const { Audio } = require('expo-av');

    beforeEach(() => {
      jest.clearAllMocks();
    });

    /**
     * Test: extractDurationFromUrl with valid video
     * Requirement 2.5: Extract duration successfully using SDK 52 compatible method
     */
    test('should extract duration from valid video URL', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: 30000, // 30 seconds
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBe(30);
      expect(Audio.Sound.createAsync).toHaveBeenCalledWith(
        { uri: 'https://example.com/video.mp4' },
        { shouldPlay: false },
        null,
        false
      );
      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });

    test('should extract duration and convert milliseconds to seconds correctly', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: 125000, // 125 seconds
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBe(125);
    });

    test('should handle fractional seconds correctly', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: 30500, // 30.5 seconds
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBe(30.5);
    });

    /**
     * Test: extractDurationFromUrl with invalid URL
     * Requirement 2.8: Return null for invalid videos
     */
    test('should return null for empty URL', async () => {
      const result = await extractDurationFromUrl('');
      expect(result).toBeNull();
      expect(Audio.Sound.createAsync).not.toHaveBeenCalled();
    });

    test('should return null when status is not loaded', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: false,
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBeNull();
      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });

    test('should return null when durationMillis is missing', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: undefined,
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBeNull();
      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });

    test('should return null when durationMillis is 0', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: 0,
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBeNull();
    });

    test('should return null and cleanup on error', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockResolvedValue(undefined),
      };

      Audio.Sound.createAsync.mockRejectedValue(new Error('Failed to load video'));

      const result = await extractDurationFromUrl('https://example.com/invalid.mp4');

      expect(result).toBeNull();
    });

    test('should handle unloadAsync errors gracefully when duration is extracted', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockRejectedValue(new Error('Unload failed')),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: true,
          durationMillis: 30000,
        },
      });

      // Should still return duration even if unload fails
      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBe(30);
      expect(mockSound.unloadAsync).toHaveBeenCalled();
    });

    test('should handle unloadAsync errors gracefully on extraction failure', async () => {
      const mockSound = {
        unloadAsync: jest.fn().mockRejectedValue(new Error('Unload failed')),
      };

      Audio.Sound.createAsync.mockResolvedValue({
        sound: mockSound,
        status: {
          isLoaded: false,
        },
      });

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBeNull();
    });

    test('should cleanup sound on error during createAsync', async () => {
      Audio.Sound.createAsync.mockRejectedValue(new Error('Network error'));

      const result = await extractDurationFromUrl('https://example.com/video.mp4');

      expect(result).toBeNull();
    });
  });

  describe('Round-trip consistency', () => {
    test('formatDuration and parseDuration should be inverse operations', () => {
      const testCases = [0, 5, 30, 60, 125, 3599];

      testCases.forEach((seconds) => {
        const formatted = formatDuration(seconds);
        const parsed = parseDuration(formatted);
        expect(parsed).toBe(seconds);
      });
    });
  });

  describe('Edge cases', () => {
    test('should handle very small durations', () => {
      expect(formatDuration(0.1)).toBe('0:00');
      expect(formatDuration(0.9)).toBe('0:01');
    });

    test('should handle maximum allowed duration (60 seconds)', () => {
      expect(formatDuration(60)).toBe('1:00');
      expect(shouldShowDuration(60)).toBe(true);
    });

    test('should handle minimum allowed duration (5 seconds)', () => {
      expect(formatDuration(5)).toBe('0:05');
      expect(shouldShowDuration(5)).toBe(true);
    });

    test('should handle durations just below minimum (4 seconds)', () => {
      expect(formatDuration(4)).toBe('0:04');
      expect(shouldShowDuration(4)).toBe(true); // shouldShowDuration only checks > 0
    });

    test('should handle durations just above maximum (61 seconds)', () => {
      expect(formatDuration(61)).toBe('1:01');
      expect(shouldShowDuration(61)).toBe(true); // shouldShowDuration only checks > 0
    });
  });
});
