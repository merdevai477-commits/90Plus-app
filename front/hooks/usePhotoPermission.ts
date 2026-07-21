/**
 * usePhotoPermission Hook
 * Professional photo/camera permission management for iOS & Android
 * 
 * Features:
 * - Request permissions at the right time
 * - Handle all permission states (UNAVAILABLE, DENIED, LIMITED, GRANTED, BLOCKED)
 * - Guide users to Settings if needed
 * - iOS 14+ Limited access handling
 * - Android permission handling
 * - User-friendly error messages
 */

import { useState, useCallback, useEffect } from 'react';
import { Alert, Linking, AppState, AppStateStatus } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../contexts/LanguageContext';

export type PermissionStatus = 'undetermined' | 'denied' | 'limited' | 'granted' | 'blocked';

export interface PhotoPermissionState {
  camera: PermissionStatus;
  library: PermissionStatus;
  isLoading: boolean;
}

export interface UsePhotoPermissionReturn {
  permissionState: PhotoPermissionState;
  requestCameraPermission: () => Promise<boolean>;
  openSettings: () => void;
  checkPermissions: () => Promise<void>;
}

const mapPermissionStatus = (
  status: ImagePicker.PermissionStatus,
  canAskAgain?: boolean,
): PermissionStatus => {
  switch (status) {
    case ImagePicker.PermissionStatus.GRANTED:
      return 'granted';
    case ImagePicker.PermissionStatus.DENIED:
      return canAskAgain === false ? 'blocked' : 'denied';
    case ImagePicker.PermissionStatus.UNDETERMINED:
      return 'undetermined';
    default:
      return 'denied';
  }
};

const mapLibraryPermissionStatus = (
  permission: ImagePicker.MediaLibraryPermissionResponse,
): PermissionStatus => {
  if (permission.accessPrivileges === 'limited') return 'limited';
  if (permission.accessPrivileges === 'all') return 'granted';
  return mapPermissionStatus(permission.status, permission.canAskAgain);
};

export const usePhotoPermission = (): UsePhotoPermissionReturn => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const [permissionState, setPermissionState] = useState<PhotoPermissionState>({
    camera: 'undetermined',
    library: 'undetermined',
    isLoading: false,
  });

  // Check current permissions
  const checkPermissions = useCallback(async () => {
    try {
      setPermissionState(prev => ({ ...prev, isLoading: true }));

      const [cameraStatus, libraryStatus] = await Promise.all([
        ImagePicker.getCameraPermissionsAsync(),
        ImagePicker.getMediaLibraryPermissionsAsync(),
      ]);

      setPermissionState({
        camera: mapPermissionStatus(cameraStatus.status, cameraStatus.canAskAgain),
        library: mapLibraryPermissionStatus(libraryStatus),
        isLoading: false,
      });
    } catch (error) {
      console.error('Error checking permissions:', error);
      setPermissionState(prev => ({ ...prev, isLoading: false }));
    }
  }, []);

  // Request camera permission
  const requestCameraPermission = useCallback(async (): Promise<boolean> => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      const { status, canAskAgain } = await ImagePicker.requestCameraPermissionsAsync();

      const newStatus = mapPermissionStatus(status, canAskAgain);
      setPermissionState(prev => ({ ...prev, camera: newStatus }));

      if (status === ImagePicker.PermissionStatus.GRANTED) {
        return true;
      }

      // Permission denied
      if (!canAskAgain || status === ImagePicker.PermissionStatus.DENIED) {
        showPermissionDeniedAlert('camera');
        return false;
      }

      return false;
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  }, [isRTL]);

  // Show permission denied alert
  const showPermissionDeniedAlert = (type: 'camera' | 'library') => {
    const messages = {
      camera: {
        ar: {
          title: 'الوصول إلى الكاميرا مرفوض',
          message: '90Plus يحتاج إلى الوصول إلى الكاميرا لالتقاط الصور ومقاطع الفيديو. يرجى تفعيل الإذن من الإعدادات.',
          settings: 'فتح الإعدادات',
          cancel: 'إلغاء',
        },
        en: {
          title: 'Camera Access Denied',
          message: '90Plus needs camera access to capture photos and videos. Please enable it in Settings.',
          settings: 'Open Settings',
          cancel: 'Cancel',
        },
      },
      library: {
        ar: {
          title: 'الوصول إلى المعرض مرفوض',
          message: '90Plus يحتاج إلى الوصول إلى معرض الصور لاختيار الصور ومقاطع الفيديو. يرجى تفعيل الإذن من الإعدادات.',
          settings: 'فتح الإعدادات',
          cancel: 'إلغاء',
        },
        en: {
          title: 'Photo Library Access Denied',
          message: '90Plus needs photo library access to select photos and videos. Please enable it in Settings.',
          settings: 'Open Settings',
          cancel: 'Cancel',
        },
      },
    };

    const msg = messages[type][language];

    Alert.alert(
      msg.title,
      msg.message,
      [
        {
          text: msg.cancel,
          style: 'cancel',
        },
        {
          text: msg.settings,
          onPress: openSettings,
        },
      ],
      { cancelable: true }
    );
  };

  // Open app settings
  const openSettings = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    Linking.openSettings();
  }, []);

  // Check permissions on mount
  useEffect(() => {
    checkPermissions();
  }, [checkPermissions]);

  // Re-check permissions when app comes to foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active') {
        checkPermissions();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermissions]);

  return {
    permissionState,
    requestCameraPermission,
    openSettings,
    checkPermissions,
  };
};
