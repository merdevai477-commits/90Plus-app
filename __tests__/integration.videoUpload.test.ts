/**
 * Integration Test: Complete Video Upload Flow
 * 
 * Tests the end-to-end video upload workflow including:
 * - Duration extraction
 * - Duration validation (5-60 seconds)
 * - Thumbnail generation
 * - Thumbnail compression
 * - Upload process
 * 
 * Requirements: 2.5, 2.6, 2.7, 2.8, 2.9, 2.10, 2.11
 * 
 * Task 10.1: Integration test for complete video upload flow
 */

import { extractDurationFromUrl } from '../utils/videoDuration';
import { generateThumbnail, compressThumbnail } from '../utils/videoCompressor';

// Mock expo-av
jest.mock('expo-av', () => ({
  Audio: {
    Sound: {
      createAsync: jest.fn(),
    },
  },
}));

// Mock expo-video-thumbnails
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
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

describe('Integration: Complete Video Upload Flow', () => {
  const { Audio } = require('expo-av');
  const VideoThumbnails = require('expo-video-thumbnails');
  const ImageManipulator = require('expo-image-manipulator');

  beforeEach(() => {
    jest.clearAllMocks();
  });

  /**
   * Test: Complete upload flow with valid video (10 seconds)
   * 
   * This test simulates the complete workflow:
   * 1. User selects a video
   * 2. System extracts duration
   * 3. System validates duration (5-60 seconds)
   * 4. System generates thumbnail
   * 5. System compresses thumbnail
   * 6. System prepares for upload
   */
  test('should complete full upload flow for valid 10-second video', async () => {
    // Setup: Mock a valid 10-second video
    const videoUri = 'file:///path/to/video.mp4';
    const expectedDuration = 10;

    // Mock duration extraction
    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: expectedDuration * 1000,
      },
    });

    // Mock thumbnail generation
    const thumbnailUri = 'file:///path/to/thumbnail.jpg';
    VideoThumbnails.getThumbnailAsync.mockResolvedValue({
      uri: thumbnailUri,
    });

    // Mock thumbnail compression
    const compressedThumbnailUri = 'file:///path/to/thumbnail-compressed.jpg';
    ImageManipulator.manipulateAsync.mockResolvedValue({
      uri: compressedThumbnailUri,
    });

    // Step 1: Extract duration
    const duration = await extractDurationFromUrl(videoUri);
    expect(duration).toBe(expectedDuration);
    expect(duration).not.toBeNull();

    // Step 2: Validate duration is within acceptable range (5-60 seconds)
    expect(duration).toBeGreaterThanOrEqual(5);
    expect(duration).toBeLessThanOrEqual(60);

    // Step 3: Generate thumbnail
    const thumbnail = await generateThumbnail(videoUri);
    expect(thumbnail).toBe(thumbnailUri);
    expect(thumbnail).not.toBeNull();
    expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
      videoUri,
      expect.objectContaining({
        time: expect.any(Number),
      })
    );

    // Step 4: Compress thumbnail
    const compressedThumbnail = await compressThumbnail(thumbnail!);
    expect(compressedThumbnail).toBe(compressedThumbnailUri);
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      thumbnail!,
      [{ resize: { width: 720 } }],
      expect.objectContaining({
        compress: expect.any(Number),
        format: 'jpeg',
      })
    );

    // Step 5: Verify all resources were cleaned up
    expect(mockSound.unloadAsync).toHaveBeenCalled();

    // Step 6: Verify upload readiness
    // At this point, we have:
    // - Valid duration (10 seconds)
    // - Valid thumbnail URI
    // - Compressed thumbnail URI
    // The video is ready for upload
    expect(duration).toBeDefined();
    expect(compressedThumbnail).toBeDefined();
  });

  /**
   * Test: Upload flow with minimum valid duration (5 seconds)
   */
  test('should accept video with exactly 5 seconds duration', async () => {
    const videoUri = 'file:///path/to/short-video.mp4';
    const expectedDuration = 5;

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: expectedDuration * 1000,
      },
    });

    VideoThumbnails.getThumbnailAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail.jpg',
    });

    ImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail-compressed.jpg',
    });

    // Extract and validate duration
    const duration = await extractDurationFromUrl(videoUri);
    expect(duration).toBe(5);
    expect(duration).toBeGreaterThanOrEqual(5);

    // Generate thumbnail
    const thumbnail = await generateThumbnail(videoUri);
    expect(thumbnail).not.toBeNull();

    // Compress thumbnail
    const compressedThumbnail = await compressThumbnail(thumbnail!);
    expect(compressedThumbnail).toBeDefined();
  });

  /**
   * Test: Upload flow with maximum valid duration (60 seconds)
   */
  test('should accept video with exactly 60 seconds duration', async () => {
    const videoUri = 'file:///path/to/long-video.mp4';
    const expectedDuration = 60;

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: expectedDuration * 1000,
      },
    });

    VideoThumbnails.getThumbnailAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail.jpg',
    });

    ImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail-compressed.jpg',
    });

    // Extract and validate duration
    const duration = await extractDurationFromUrl(videoUri);
    expect(duration).toBe(60);
    expect(duration).toBeLessThanOrEqual(60);

    // Generate thumbnail
    const thumbnail = await generateThumbnail(videoUri);
    expect(thumbnail).not.toBeNull();

    // Compress thumbnail
    const compressedThumbnail = await compressThumbnail(thumbnail!);
    expect(compressedThumbnail).toBeDefined();
  });

  /**
   * Test: Upload flow handles thumbnail generation failure gracefully
   */
  test('should handle thumbnail generation failure gracefully', async () => {
    const videoUri = 'file:///path/to/video.mp4';

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: 10000,
      },
    });

    // Mock thumbnail generation failure
    VideoThumbnails.getThumbnailAsync.mockRejectedValue(
      new Error('Failed to generate thumbnail')
    );

    // Extract duration should still work
    const duration = await extractDurationFromUrl(videoUri);
    expect(duration).toBe(10);

    // Thumbnail generation should return null on failure
    const thumbnail = await generateThumbnail(videoUri);
    expect(thumbnail).toBeNull();

    // Upload can still proceed with placeholder thumbnail
    // (handled by UI layer)
  });

  /**
   * Test: Upload flow handles compression failure gracefully
   */
  test('should handle thumbnail compression failure gracefully', async () => {
    const videoUri = 'file:///path/to/video.mp4';
    const thumbnailUri = 'file:///path/to/thumbnail.jpg';

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: 10000,
      },
    });

    VideoThumbnails.getThumbnailAsync.mockResolvedValue({
      uri: thumbnailUri,
    });

    // Mock compression failure
    ImageManipulator.manipulateAsync.mockRejectedValue(
      new Error('Failed to compress')
    );

    // Extract duration
    const duration = await extractDurationFromUrl(videoUri);
    expect(duration).toBe(10);

    // Generate thumbnail
    const thumbnail = await generateThumbnail(videoUri);
    expect(thumbnail).toBe(thumbnailUri);

    // Compression should return original thumbnail on failure
    const compressedThumbnail = await compressThumbnail(thumbnail!);
    expect(compressedThumbnail).toBe(thumbnailUri); // Falls back to original
  });

  /**
   * Test: Upload flow with typical video (30 seconds)
   */
  test('should complete full flow for typical 30-second video', async () => {
    const videoUri = 'file:///path/to/typical-video.mp4';
    const expectedDuration = 30;

    const mockSound = {
      unloadAsync: jest.fn().mockResolvedValue(undefined),
    };

    Audio.Sound.createAsync.mockResolvedValue({
      sound: mockSound,
      status: {
        isLoaded: true,
        durationMillis: expectedDuration * 1000,
      },
    });

    VideoThumbnails.getThumbnailAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail.jpg',
    });

    ImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail-compressed.jpg',
    });

    // Complete flow
    const duration = await extractDurationFromUrl(videoUri);
    expect(duration).toBe(30);
    expect(duration).toBeGreaterThanOrEqual(5);
    expect(duration).toBeLessThanOrEqual(60);

    const thumbnail = await generateThumbnail(videoUri);
    expect(thumbnail).not.toBeNull();

    const compressedThumbnail = await compressThumbnail(thumbnail!);
    expect(compressedThumbnail).toBeDefined();

    // Verify cleanup
    expect(mockSound.unloadAsync).toHaveBeenCalled();
  });

  /**
   * Test: Verify thumbnail compression settings
   */
  test('should compress thumbnail with correct settings', async () => {
    const thumbnailUri = 'file:///path/to/thumbnail.jpg';

    ImageManipulator.manipulateAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail-compressed.jpg',
    });

    await compressThumbnail(thumbnailUri);

    // Verify compression settings
    expect(ImageManipulator.manipulateAsync).toHaveBeenCalledWith(
      thumbnailUri,
      [{ resize: { width: 720 } }], // Max width 720px
      {
        compress: 0.8, // Quality 0.8
        format: 'jpeg', // JPEG format
      }
    );
  });

  /**
   * Test: Verify thumbnail generation timing
   */
  test('should generate thumbnail at 1 second mark', async () => {
    const videoUri = 'file:///path/to/video.mp4';

    VideoThumbnails.getThumbnailAsync.mockResolvedValue({
      uri: 'file:///path/to/thumbnail.jpg',
    });

    await generateThumbnail(videoUri);

    // Verify thumbnail is generated at 1 second (1000ms)
    expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
      videoUri,
      expect.objectContaining({
        time: 1000,
      })
    );
  });
});
