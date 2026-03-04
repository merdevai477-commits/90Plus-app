import {
  generateThumbnail,
  compressThumbnail,
  getFileSize,
  shouldCompress,
  formatFileSize,
  prepareVideoForUpload,
} from '../utils/videoCompressor';
import * as VideoThumbnails from 'expo-video-thumbnails';
import * as FileSystem from 'expo-file-system';

// Mock expo-video-thumbnails
jest.mock('expo-video-thumbnails', () => ({
  getThumbnailAsync: jest.fn(),
}));

// Mock expo-file-system
jest.mock('expo-file-system', () => ({
  getInfoAsync: jest.fn(),
}));

// Mock expo-image-manipulator
jest.mock('expo-image-manipulator', () => ({
  manipulateAsync: jest.fn(),
  SaveFormat: {
    JPEG: 'jpeg',
    PNG: 'png',
  },
}));

// Mock logger
jest.mock('../services/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
  },
}));

describe('Video Thumbnail Generation Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Property 1: generateThumbnail works with valid videos', () => {
    test('should generate thumbnail from valid video URI', async () => {
      const mockThumbnailUri = 'file:///path/to/thumbnail.jpg';
      
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
        uri: mockThumbnailUri,
      });

      const result = await generateThumbnail('file:///path/to/video.mp4');

      expect(result).toBe(mockThumbnailUri);
      expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
        'file:///path/to/video.mp4',
        {
          time: 1000,
          quality: 0.8,
        }
      );
    });

    test('should use custom time parameter', async () => {
      const mockThumbnailUri = 'file:///path/to/thumbnail.jpg';
      
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
        uri: mockThumbnailUri,
      });

      const result = await generateThumbnail('file:///path/to/video.mp4', 5000);

      expect(result).toBe(mockThumbnailUri);
      expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
        'file:///path/to/video.mp4',
        {
          time: 5000,
          quality: 0.8,
        }
      );
    });

    test('should use default time of 1000ms when not specified', async () => {
      const mockThumbnailUri = 'file:///path/to/thumbnail.jpg';
      
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
        uri: mockThumbnailUri,
      });

      await generateThumbnail('file:///path/to/video.mp4');

      expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ time: 1000 })
      );
    });

    test('should use quality of 0.8', async () => {
      const mockThumbnailUri = 'file:///path/to/thumbnail.jpg';
      
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
        uri: mockThumbnailUri,
      });

      await generateThumbnail('file:///path/to/video.mp4');

      expect(VideoThumbnails.getThumbnailAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ quality: 0.8 })
      );
    });
  });

  describe('Property 2: generateThumbnail returns null for invalid videos', () => {
    test('should return null when getThumbnailAsync fails', async () => {
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('Failed to generate thumbnail')
      );

      const result = await generateThumbnail('file:///invalid/video.mp4');

      expect(result).toBeNull();
    });

    test('should return null when video file does not exist', async () => {
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('File not found')
      );

      const result = await generateThumbnail('file:///nonexistent/video.mp4');

      expect(result).toBeNull();
    });

    test('should return null when video format is unsupported', async () => {
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('Unsupported format')
      );

      const result = await generateThumbnail('file:///path/to/video.avi');

      expect(result).toBeNull();
    });
  });

  describe('Property 3: compressThumbnail reduces image size', () => {
    test('should compress thumbnail with default max width of 720px', async () => {
      const mockCompressedUri = 'file:///path/to/compressed-thumbnail.jpg';
      
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: mockCompressedUri,
      });

      const result = await compressThumbnail('file:///path/to/thumbnail.jpg');

      expect(result).toBe(mockCompressedUri);
      expect(manipulateAsync).toHaveBeenCalledWith(
        'file:///path/to/thumbnail.jpg',
        [{ resize: { width: 720 } }],
        {
          compress: 0.8,
          format: 'jpeg',
        }
      );
    });

    test('should use custom max width', async () => {
      const mockCompressedUri = 'file:///path/to/compressed-thumbnail.jpg';
      
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: mockCompressedUri,
      });

      await compressThumbnail('file:///path/to/thumbnail.jpg', 1080);

      expect(manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { width: 1080 } }],
        expect.any(Object)
      );
    });

    test('should use JPEG format', async () => {
      const mockCompressedUri = 'file:///path/to/compressed-thumbnail.jpg';
      
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: mockCompressedUri,
      });

      await compressThumbnail('file:///path/to/thumbnail.jpg');

      expect(manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ format: 'jpeg' })
      );
    });

    test('should use compression quality of 0.8', async () => {
      const mockCompressedUri = 'file:///path/to/compressed-thumbnail.jpg';
      
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: mockCompressedUri,
      });

      await compressThumbnail('file:///path/to/thumbnail.jpg');

      expect(manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({ compress: 0.8 })
      );
    });

    test('should return original URI if compression fails', async () => {
      const originalUri = 'file:///path/to/thumbnail.jpg';
      
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockRejectedValue(
        new Error('Compression failed')
      );

      const result = await compressThumbnail(originalUri);

      expect(result).toBe(originalUri);
    });
  });

  describe('Property 4: Thumbnail width does not exceed maxWidth', () => {
    test('should resize to max width of 720px by default', async () => {
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///compressed.jpg',
      });

      await compressThumbnail('file:///thumbnail.jpg');

      expect(manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { width: 720 } }],
        expect.any(Object)
      );
    });

    test('should maintain aspect ratio when resizing', async () => {
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///compressed.jpg',
      });

      await compressThumbnail('file:///thumbnail.jpg', 1080);

      // Verify only width is specified (height is calculated automatically)
      expect(manipulateAsync).toHaveBeenCalledWith(
        expect.any(String),
        [{ resize: { width: 1080 } }],
        expect.any(Object)
      );
    });
  });

  describe('Property 5: Helper functions work correctly', () => {
    test('getFileSize should return file size in bytes', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 1024000, // 1MB
      });

      const size = await getFileSize('file:///path/to/video.mp4');

      expect(size).toBe(1024000);
    });

    test('getFileSize should return 0 for non-existent files', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: false,
      });

      const size = await getFileSize('file:///nonexistent.mp4');

      expect(size).toBe(0);
    });

    test('getFileSize should return 0 on error', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockRejectedValue(
        new Error('File system error')
      );

      const size = await getFileSize('file:///error.mp4');

      expect(size).toBe(0);
    });

    test('shouldCompress should return true for files > 2MB', () => {
      const threeMB = 3 * 1024 * 1024;
      expect(shouldCompress(threeMB)).toBe(true);
    });

    test('shouldCompress should return false for files <= 2MB', () => {
      const oneMB = 1 * 1024 * 1024;
      expect(shouldCompress(oneMB)).toBe(false);
    });

    test('shouldCompress should return false for exactly 2MB', () => {
      const twoMB = 2 * 1024 * 1024;
      expect(shouldCompress(twoMB)).toBe(false);
    });

    test('formatFileSize should format bytes correctly', () => {
      expect(formatFileSize(500)).toBe('500 B');
      expect(formatFileSize(1024)).toBe('1.0 KB');
      expect(formatFileSize(1536)).toBe('1.5 KB');
      expect(formatFileSize(1024 * 1024)).toBe('1.0 MB');
      expect(formatFileSize(2.5 * 1024 * 1024)).toBe('2.5 MB');
    });
  });

  describe('Property 6: prepareVideoForUpload workflow', () => {
    test('should generate thumbnail and return video info', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 5000000, // 5MB
      });

      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///thumbnail.jpg',
      });

      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///compressed-thumbnail.jpg',
      });

      const result = await prepareVideoForUpload('file:///video.mp4');

      expect(result.videoUri).toBe('file:///video.mp4');
      expect(result.thumbnailUri).toBe('file:///compressed-thumbnail.jpg');
      expect(result.originalSize).toBe(5000000);
      expect(result.finalSize).toBe(5000000);
    });

    test('should handle thumbnail generation failure gracefully', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 5000000,
      });

      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('Thumbnail generation failed')
      );

      const result = await prepareVideoForUpload('file:///video.mp4');

      expect(result.videoUri).toBe('file:///video.mp4');
      expect(result.thumbnailUri).toBeNull();
      expect(result.originalSize).toBe(5000000);
    });

    test('should call progress callback with correct stages', async () => {
      (FileSystem.getInfoAsync as jest.Mock).mockResolvedValue({
        exists: true,
        size: 5000000,
      });

      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///thumbnail.jpg',
      });

      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///compressed-thumbnail.jpg',
      });

      const progressCallback = jest.fn();

      await prepareVideoForUpload('file:///video.mp4', progressCallback);

      expect(progressCallback).toHaveBeenCalledWith({
        stage: 'analyzing',
        progress: 10,
      });
      expect(progressCallback).toHaveBeenCalledWith({
        stage: 'generating-thumbnail',
        progress: 30,
      });
      expect(progressCallback).toHaveBeenCalledWith({
        stage: 'generating-thumbnail',
        progress: 50,
      });
      expect(progressCallback).toHaveBeenCalledWith({
        stage: 'complete',
        progress: 100,
      });
    });
  });

  describe('Property 7: Error handling and edge cases', () => {
    test('should handle empty video URI gracefully', async () => {
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('Invalid URI')
      );

      const result = await generateThumbnail('');

      expect(result).toBeNull();
    });

    test('should handle corrupted video files', async () => {
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('Corrupted file')
      );

      const result = await generateThumbnail('file:///corrupted.mp4');

      expect(result).toBeNull();
    });

    test('should handle very large thumbnails', async () => {
      const { manipulateAsync } = await import('expo-image-manipulator');
      (manipulateAsync as jest.Mock).mockResolvedValue({
        uri: 'file:///compressed.jpg',
      });

      // Should still compress even if original is very large
      await compressThumbnail('file:///large-thumbnail.jpg', 720);

      expect(manipulateAsync).toHaveBeenCalled();
    });

    test('should handle permission errors', async () => {
      (VideoThumbnails.getThumbnailAsync as jest.Mock).mockRejectedValue(
        new Error('Permission denied')
      );

      const result = await generateThumbnail('file:///video.mp4');

      expect(result).toBeNull();
    });
  });
});
