/**
 * ImagePreviewModal
 *
 * UX Fix 1: Shows a preview of the selected image before uploading.
 * UX Fix 2: Provides a cross-platform bottom-sheet action sheet for
 *           choosing gallery vs camera (replaces Alert.alert on Android).
 *
 * Usage:
 *   <ImagePreviewModal
 *     visible={visible}
 *     imageUri={uri}
 *     type="avatar" | "cover"
 *     onConfirm={() => startUpload()}
 *     onCancel={() => setVisible(false)}
 *   />
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Platform,
  ActionSheetIOS,
  Dimensions,
  ActivityIndicator,
} from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../../src/i18n';

const { width: SCREEN_W } = Dimensions.get('window');

export type ImagePreviewType = 'avatar' | 'cover';

interface ImagePreviewModalProps {
  visible: boolean;
  imageUri: string | null;
  type: ImagePreviewType;
  isUploading?: boolean;
  uploadProgress?: number;
  onConfirm: () => void;
  onCancel: () => void;
}

export const ImagePreviewModal: React.FC<ImagePreviewModalProps> = ({
  visible,
  imageUri,
  type,
  isUploading = false,
  uploadProgress = 0,
  onConfirm,
  onCancel,
}) => {
  const { t } = useTranslation();

  if (!imageUri) return null;

  const isAvatar = type === 'avatar';
  const previewSize = isAvatar ? Math.min(SCREEN_W * 0.6, 240) : SCREEN_W - 48;
  const previewHeight = isAvatar ? previewSize : previewSize * (9 / 16);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent
      onRequestClose={onCancel}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {isAvatar ? 'معاينة صورة البروفايل' : 'معاينة صورة الغلاف'}
            </Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} disabled={isUploading}>
              <Ionicons name="close" size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {/* Preview */}
          <View style={[styles.previewWrapper, { alignItems: 'center' }]}>
            {isAvatar ? (
              <View style={[styles.avatarCircle, { width: previewSize, height: previewSize, borderRadius: previewSize / 2 }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: previewSize, height: previewSize, borderRadius: previewSize / 2 }}
                  contentFit="cover"
                />
              </View>
            ) : (
              <View style={[styles.coverPreview, { width: previewSize, height: previewHeight }]}>
                <Image
                  source={{ uri: imageUri }}
                  style={{ width: '100%', height: '100%' }}
                  contentFit="cover"
                />
              </View>
            )}
          </View>

          {/* Upload progress */}
          {isUploading && (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
            </View>
          )}

          {/* Actions */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>إلغاء</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, isUploading && styles.btnDisabled]}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
                onConfirm();
              }}
              disabled={isUploading}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FFD700', '#FFA500']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                {isUploading ? (
                  <ActivityIndicator color="#000" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#000" />
                    <Text style={styles.confirmText}>رفع</Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

// ─── Cross-platform action sheet (UX Fix 2) ───────────────────────────────────

export interface ImageSourceSheetOptions {
  title?: string;
  hasExistingImage?: boolean;
  onGallery: () => void;
  onCamera: () => void;
  onRemove?: () => void;
  onCancel?: () => void;
}

/**
 * showImageSourceSheet
 * Shows iOS ActionSheet or Android Modal bottom sheet for picking image source.
 * Pass `setAndroidSheetVisible` to control the Android fallback modal.
 */
export function showImageSourceSheet(
  options: ImageSourceSheetOptions,
  setAndroidSheetVisible: (v: boolean) => void,
  setAndroidSheetOptions: (o: ImageSourceSheetOptions) => void,
): void {
  if (Platform.OS === 'ios') {
    const iosOptions: string[] = ['اختر من المعرض', 'التقط صورة'];
    if (options.hasExistingImage && options.onRemove) iosOptions.push('إزالة الصورة');
    iosOptions.push('إلغاء');

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: iosOptions,
        cancelButtonIndex: iosOptions.length - 1,
        destructiveButtonIndex: options.hasExistingImage && options.onRemove ? iosOptions.length - 2 : undefined,
        title: options.title,
      },
      (idx) => {
        if (idx === 0) options.onGallery();
        else if (idx === 1) options.onCamera();
        else if (idx === 2 && options.hasExistingImage && options.onRemove) options.onRemove();
      },
    );
  } else {
    setAndroidSheetOptions(options);
    setAndroidSheetVisible(true);
  }
}

/**
 * AndroidImageSourceSheet
 * Bottom-sheet modal for Android that matches iOS ActionSheet style.
 */
interface AndroidSheetProps {
  visible: boolean;
  options: ImageSourceSheetOptions | null;
  onClose: () => void;
}

export const AndroidImageSourceSheet: React.FC<AndroidSheetProps> = ({ visible, options, onClose }) => {
  if (!options) return null;

  const handleOption = (fn: () => void) => {
    onClose();
    setTimeout(fn, 150); // small delay so modal closes before picker opens
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <View style={styles.sheetHandle} />
        {options.title && <Text style={styles.sheetTitle}>{options.title}</Text>}

        <TouchableOpacity style={styles.sheetOption} onPress={() => handleOption(options.onGallery)} activeOpacity={0.7}>
          <Ionicons name="images-outline" size={22} color="#FFD700" />
          <Text style={styles.sheetOptionText}>اختر من المعرض</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.sheetOption} onPress={() => handleOption(options.onCamera)} activeOpacity={0.7}>
          <Ionicons name="camera-outline" size={22} color="#FFD700" />
          <Text style={styles.sheetOptionText}>التقط صورة</Text>
        </TouchableOpacity>

        {options.hasExistingImage && options.onRemove && (
          <TouchableOpacity
            style={[styles.sheetOption, styles.sheetOptionDestructive]}
            onPress={() => handleOption(options.onRemove!)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            <Text style={[styles.sheetOptionText, { color: '#FF3B30' }]}>إزالة الصورة</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.sheetOption, styles.sheetCancel]} onPress={onClose} activeOpacity={0.7}>
          <Text style={[styles.sheetOptionText, { color: 'rgba(255,255,255,0.5)' }]}>إلغاء</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: '#1C1C1E',
    borderRadius: 20,
    width: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 18, fontWeight: 'bold', color: '#fff' },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewWrapper: { marginBottom: 20 },
  avatarCircle: {
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: '#FFD700',
  },
  coverPreview: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
  },
  progressContainer: { marginBottom: 16 },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: '100%', backgroundColor: '#FFD700', borderRadius: 3 },
  progressText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelText: { color: '#fff', fontSize: 16, fontWeight: '600' },
  confirmBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  confirmGradient: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmText: { color: '#000', fontSize: 16, fontWeight: 'bold' },
  // Android sheet
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1C1C1E',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(255,255,255,0.3)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 8,
  },
  sheetOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 16,
    paddingHorizontal: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  sheetOptionDestructive: { borderBottomColor: 'rgba(255,59,48,0.15)' },
  sheetCancel: { borderBottomWidth: 0, marginTop: 8 },
  sheetOptionText: { color: '#fff', fontSize: 17 },
});
