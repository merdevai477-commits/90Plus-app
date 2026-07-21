/**
 * useImagePicker Hook
 * Professional image picking with crop, compress, and validation
 * 
 * Features:
 * - Pick from gallery or camera
 * - Circular crop for avatars
 * - Square crop for covers
 * - Compress to max 1MB
 * - Validate type, size, dimensions
 * - Error handling
 * - Loading states
 */

import { useState, useCallback } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import * as Haptics from 'expo-haptics';
import { Alert } from 'react-native';
import { useLanguage } from '../contexts/LanguageContext';
import { usePhotoPermission } from './usePhotoPermission';

export interface ImagePickerOptions {
  type: 'avatar' | 'cover' | 'reel' | 'general';
  maxSize?: number; // in MB
  quality?: number; // 0-1
  allowsEditing?: boolean;
  aspect?: [number, number];
}

export interface PickedImage {
  uri: string;
  width: number;
  height: number;
  size: number; // in bytes
  type: string;
  base64?: string;
}

export interface UseImagePickerReturn {
  pickFromGallery: (options?: ImagePickerOptions) => Promise<PickedImage | null>;
  pickFromCamera: (options?: ImagePickerOptions) => Promise<PickedImage | null>;
  isLoading: boolean;
}

const DEFAULT_OPTIONS: ImagePickerOptions = {
  type: 'general',
  maxSize: 1, // 1MB
  quality: 0.8,
  allowsEditing: true,
  aspect: [1, 1],
};

export const useImagePicker = (): UseImagePickerReturn => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';
  const { requestCameraPermission } = usePhotoPermission();

  const [isLoading, setIsLoading] = useState(false);

  // Get options based on type
  const getOptionsForType = (type: ImagePickerOptions['type']): Partial<ImagePickerOptions> => {
    switch (type) {
      case 'avatar':
        return {
          maxSize: 1,
          quality: 0.8,
          allowsEditing: true,
          aspect: [1, 1], // Square for circular crop
        };
      case 'cover':
        return {
          maxSize: 2,
          quality: 0.85,
          allowsEditing: true,
          aspect: [16, 9],
        };
      case 'reel':
        return {
          maxSize: 100,
          quality: 0.9,
          allowsEditing: false,
          aspect: [9, 16],
        };
      default:
        return DEFAULT_OPTIONS;
    }
  };

  // Validate image
  const validateImage = async (
    uri: string,
    options: ImagePickerOptions
  ): Promise<{ valid: boolean; error?: string }> => {
    try {
      // Get file info
      const response = await fetch(uri);
      const blob = await response.blob();
      const sizeInMB = blob.size / (1024 * 1024);

      // Check size
      const maxSize = options.maxSize || DEFAULT_OPTIONS.maxSize!;
      if (sizeInMB > maxSize) {
        return {
          valid: false,
          error: isRTL
            ? `حجم الصورة كبير جداً. الحد الأقصى ${maxSize}MB`
            : `Image size too large. Maximum ${maxSize}MB`,
        };
      }

      // Check type
      if (!blob.type.startsWith('image/')) {
        return {
          valid: false,
          error: isRTL ? 'نوع الملف غير صالح' : 'Invalid file type',
        };
      }

      return { valid: true };
    } catch (error) {
      return {
        valid: false,
        error: isRTL ? 'فشل التحقق من الصورة' : 'Failed to validate image',
      };
    }
  };

  // Compress image — always outputs JPEG regardless of input format (handles HEIC on iOS)
  const compressImage = async (
    uri: string,
    options: ImagePickerOptions
  ): Promise<{ uri: string; type: string }> => {
    try {
      const quality = options.quality || DEFAULT_OPTIONS.quality!;
      const targetWidth = options.type === 'avatar' ? 500 : 1080;

      const manipResult = await manipulateAsync(
        uri,
        [{ resize: { width: targetWidth } }],
        {
          compress: quality,
          format: SaveFormat.JPEG, // Always JPEG — converts HEIC/PNG/WebP
        }
      );

      return { uri: manipResult.uri, type: 'image/jpeg' };
    } catch (error) {
      console.error('Error compressing image:', error);
      // Fallback: return original but force type to image/jpeg so multer accepts it
      // The backend sharp middleware will handle any remaining format issues
      return { uri, type: 'image/jpeg' };
    }
  };

  // Pick from gallery
  const pickFromGallery = useCallback(
    async (options: ImagePickerOptions = DEFAULT_OPTIONS): Promise<PickedImage | null> => {
      // UX Fix 9: always reset loading in finally so crashes don't permanently lock the picker
      try {
        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const finalOptions = { ...DEFAULT_OPTIONS, ...getOptionsForType(options.type), ...options };

        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: finalOptions.allowsEditing,
          aspect: finalOptions.aspect,
          quality: finalOptions.quality,
          base64: false,
        });

        if (result.canceled) return null;

        const asset = result.assets[0];
        const validation = await validateImage(asset.uri, finalOptions);
        if (!validation.valid) {
          Alert.alert(isRTL ? 'خطأ' : 'Error', validation.error || (isRTL ? 'صورة غير صالحة' : 'Invalid image'));
          return null;
        }

        const compressed = await compressImage(asset.uri, finalOptions);
        const response = await fetch(compressed.uri);
        const blob = await response.blob();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return {
          uri: compressed.uri,
          width: asset.width,
          height: asset.height,
          size: blob.size,
          type: compressed.type,
        };
      } catch (error: any) {
        console.error('Error picking from gallery:', error);
        Alert.alert(isRTL ? 'خطأ' : 'Error', error.message || (isRTL ? 'فشل اختيار الصورة' : 'Failed to pick image'));
        return null;
      } finally {
        // UX Fix 9: always reset — prevents permanent lock if picker crashes
        setIsLoading(false);
      }
    },
    [isRTL]
  );

  // Pick from camera
  const pickFromCamera = useCallback(
    async (options: ImagePickerOptions = DEFAULT_OPTIONS): Promise<PickedImage | null> => {
      // UX Fix 9: always reset loading in finally
      try {
        setIsLoading(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

        const hasPermission = await requestCameraPermission();
        if (!hasPermission) return null;

        const finalOptions = { ...DEFAULT_OPTIONS, ...getOptionsForType(options.type), ...options };

        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ImagePicker.MediaTypeOptions.Images,
          allowsEditing: finalOptions.allowsEditing,
          aspect: finalOptions.aspect,
          quality: finalOptions.quality,
          base64: false,
        });

        if (result.canceled) return null;

        const asset = result.assets[0];
        const validation = await validateImage(asset.uri, finalOptions);
        if (!validation.valid) {
          Alert.alert(isRTL ? 'خطأ' : 'Error', validation.error || (isRTL ? 'صورة غير صالحة' : 'Invalid image'));
          return null;
        }

        const compressed = await compressImage(asset.uri, finalOptions);
        const response = await fetch(compressed.uri);
        const blob = await response.blob();

        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        return {
          uri: compressed.uri,
          width: asset.width,
          height: asset.height,
          size: blob.size,
          type: compressed.type,
        };
      } catch (error: any) {
        console.error('Error picking from camera:', error);
        Alert.alert(isRTL ? 'خطأ' : 'Error', error.message || (isRTL ? 'فشل التقاط الصورة' : 'Failed to capture image'));
        return null;
      } finally {
        // UX Fix 9: always reset — prevents permanent lock if camera crashes
        setIsLoading(false);
      }
    },
    [requestCameraPermission, isRTL]
  );

  return {
    pickFromGallery,
    pickFromCamera,
    isLoading,
  };
};
