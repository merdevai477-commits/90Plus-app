/**
 * Mock for expo-file-system
 * Used in Jest tests to avoid importing the actual Expo module
 */

export const getInfoAsync = jest.fn(async (uri: string) => {
  return {
    exists: true,
    uri,
    size: 1024 * 1024, // 1MB default
    isDirectory: false,
    modificationTime: Date.now(),
  };
});

export const readAsStringAsync = jest.fn(async (uri: string) => {
  return '';
});

export const writeAsStringAsync = jest.fn(async (uri: string, content: string) => {
  return;
});

export const deleteAsync = jest.fn(async (uri: string) => {
  return;
});

export const moveAsync = jest.fn(async (options: any) => {
  return;
});

export const copyAsync = jest.fn(async (options: any) => {
  return;
});

export const makeDirectoryAsync = jest.fn(async (uri: string) => {
  return;
});

export const readDirectoryAsync = jest.fn(async (uri: string) => {
  return [];
});

export const downloadAsync = jest.fn(async (uri: string, fileUri: string) => {
  return {
    uri: fileUri,
    status: 200,
    headers: {},
    md5: '',
  };
});

export const uploadAsync = jest.fn(async (url: string, fileUri: string, options?: any) => {
  return {
    status: 200,
    headers: {},
    body: '',
  };
});

export const documentDirectory = 'file:///mock/document/';
export const cacheDirectory = 'file:///mock/cache/';

export default {
  getInfoAsync,
  readAsStringAsync,
  writeAsStringAsync,
  deleteAsync,
  moveAsync,
  copyAsync,
  makeDirectoryAsync,
  readDirectoryAsync,
  downloadAsync,
  uploadAsync,
  documentDirectory,
  cacheDirectory,
};
