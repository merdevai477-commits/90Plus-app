/**
 * Mock for expo-video-thumbnails
 * Used in Jest tests to avoid module import issues
 */

export const getThumbnailAsync = jest.fn().mockResolvedValue({
  uri: 'file:///mock-thumbnail.jpg',
  width: 1920,
  height: 1080,
});

export default {
  getThumbnailAsync,
};
