/**
 * useImagePicker Hook
 * Wraps image picking + automatic compression
 * 
 * Features:
 * - Pick from gallery or take photo
 * - Automatic compression before returning
 * - Progress tracking
 * - Permission handling (Android + iOS)
 * - Caching to avoid re-compression
 */

import { useState, useCallback, useRef } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Platform, Alert } from 'react-native';
import { compressImage, CompressedImage, CompressionOptions } from '../utils/imageCompressor';
import { logger } from '../services/logger';

export interface UseImagePickerOptions {
  allowsEditing?: boolean;
  aspect?: [number, number];
  compressionOptions?: CompressionOptions;
  onProgress?: (progress: number) => void;
  skipCompression?: boolean; // Skip compression if needed
}

export interface UseImagePickerResult {
  pickImage: () => Promise<CompressedImage | null>;
  takePhoto: () => Promise<CompressedImage | null>;
  isCompressing: boolean;
  progress: number;
  error: string | null;
}

/**
 * Custom hook for image picking with automatic compression
 */
export function useImagePicker(options?: UseImagePickerOptions): UseImagePickerResult {
  const [isCompressing, setIsCompressing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  
  // Cache to avoid re-compressing the same image
  const compressionCache = useRef<Map<string, CompressedImage>>(new Map());
  
  /**
   * Request camera permissions
   */
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Camera permission is required to take photos. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('[useImagePicker] Failed to request camera permission', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }, []);
  
  /**
   * Request media library permissions
   */
  const requestMediaLibraryPermission = useCallback(async (): Promise<boolean> => {
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      
      if (status !== 'granted') {
        Alert.alert(
          'Permission Required',
          'Media library permission is required to select photos. Please enable it in your device settings.',
          [{ text: 'OK' }]
        );
        return false;
      }
      
      return true;
    } catch (error) {
      logger.error('[useImagePicker] Failed to request media library permission', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      return false;
    }
  }, []);
  
  /**
   * Compress image with caching
   */
  const compressWithCache = useCallback(async (uri: string): Promise<CompressedImage> => {
    // Check cache first
    if (compressionCache.current.has(uri)) {
      logger.info('[useImagePicker] Using cached compressed image');
      return compressionCache.current.get(uri)!;
    }
    
    setIsCompressing(true);
    setProgress(0);
    setError(null);
    
    try {
      setProgress(30);
      
      const compressed = await compressImage(uri, options?.compressionOptions);
      
      setProgress(80);
      
      // Cache the result
      compressionCache.current.set(uri, compressed);
      
      // Limit cache size to 10 items
      if (compressionCache.current.size > 10) {
        const firstKey = compressionCache.current.keys().next().value;
        compressionCache.current.delete(firstKey);
      }
      
      setProgress(100);
      
      options?.onProgress?.(100);
      
      return compressed;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Compression failed';
      setError(errorMessage);
      logger.error('[useImagePicker] Compression failed', { error: errorMessage });
      throw err;
    } finally {
      setIsCompressing(false);
    }
  }, [options]);
  
  /**
   * Pick image from gallery
   */
  const pickImage = useCallback(async (): Promise<CompressedImage | null> => {
    try {
      // Request permission
      const hasPermission = await requestMediaLibraryPermission();
      if (!hasPermission) {
        return null;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect,
        quality: 1, // Pick at full quality, we'll compress later
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }
      
      const asset = result.assets[0];
      
      // Skip compression if requested
      if (options?.skipCompression) {
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          size: 0, // Unknown
          originalSize: 0,
          compressionRatio: 0,
          mimeType: 'image/jpeg',
        };
      }
      
      // Compress image
      const compressed = await compressWithCache(asset.uri);
      
      return compressed;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to pick image';
      setError(errorMessage);
      logger.error('[useImagePicker] Failed to pick image', { error: errorMessage });
      return null;
    }
  }, [options, requestMediaLibraryPermission, compressWithCache]);
  
  /**
   * Take photo with camera
   */
  const takePhoto = useCallback(async (): Promise<CompressedImage | null> => {
    try {
      // Request permission
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) {
        return null;
      }
      
      // Launch camera
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: options?.allowsEditing ?? true,
        aspect: options?.aspect,
        quality: 1, // Capture at full quality, we'll compress later
      });
      
      if (result.canceled || !result.assets || result.assets.length === 0) {
        return null;
      }
      
      const asset = result.assets[0];
      
      // Skip compression if requested
      if (options?.skipCompression) {
        return {
          uri: asset.uri,
          width: asset.width,
          height: asset.height,
          size: 0, // Unknown
          originalSize: 0,
          compressionRatio: 0,
          mimeType: 'image/jpeg',
        };
      }
      
      // Compress image
      const compressed = await compressWithCache(asset.uri);
      
      return compressed;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to take photo';
      setError(errorMessage);
      logger.error('[useImagePicker] Failed to take photo', { error: errorMessage });
      return null;
    }
  }, [options, requestCameraPermission, compressWithCache]);
  
  return {
    pickImage,
    takePhoto,
    isCompressing,
    progress,
    error,
  };
}

export default useImagePicker;
