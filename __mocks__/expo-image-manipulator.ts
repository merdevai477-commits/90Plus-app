/**
 * Mock for expo-image-manipulator
 * Used in Jest tests to avoid module import issues
 */

export enum SaveFormat {
  JPEG = 'jpeg',
  PNG = 'png',
  WEBP = 'webp',
}

export const manipulateAsync = jest.fn().mockImplementation(
  async (uri: string, actions: any[], options: any) => {
    // Return a different URI to simulate compression
    return {
      uri: uri.replace('.jpg', '-compressed.jpg'),
      width: 720,
      height: 405,
    };
  }
);

export default {
  manipulateAsync,
  SaveFormat,
};
