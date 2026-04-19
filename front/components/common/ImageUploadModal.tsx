/**
 * ImageUploadModal Component
 * Complete image upload flow with picker, preview, and upload
 * 
 * Features:
 * - Choose from gallery or camera
 * - Image preview
 * - Upload progress
 * - Cancel upload
 * - Error handling
 * - Success feedback
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  StyleSheet,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';
import { useImagePicker, ImagePickerOptions, PickedImage } from '../../hooks/useImagePicker';
import { useImageUpload, UploadOptions } from '../../hooks/useImageUpload';

// Constants
const COLORS = {
  primary: '#FFD700',
  background: '#000000',
  backgroundCard: '#1C1C1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  success: '#34C759',
  error: '#FF3B30',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
};

export interface ImageUploadModalProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: (url: string) => void;
  uploadOptions: UploadOptions;
  pickerOptions?: ImagePickerOptions;
  title?: string;
}

export const ImageUploadModal: React.FC<ImageUploadModalProps> = ({
  visible,
  onClose,
  onSuccess,
  uploadOptions,
  pickerOptions,
  title,
}) => {
  const { language } = useLanguage();
  const isRTL = language === 'ar';

  const { pickFromGallery, pickFromCamera, isLoading: isPicking } = useImagePicker();
  const { upload, cancel, isUploading, progress } = useImageUpload();

  const [selectedImage, setSelectedImage] = useState<PickedImage | null>(null);
  const [showPicker, setShowPicker] = useState(true);

  const handlePickFromGallery = async () => {
    const image = await pickFromGallery(pickerOptions);
    if (image) {
      setSelectedImage(image);
      setShowPicker(false);
    }
  };

  const handlePickFromCamera = async () => {
    const image = await pickFromCamera(pickerOptions);
    if (image) {
      setSelectedImage(image);
      setShowPicker(false);
    }
  };

  const handleUpload = async () => {
    if (!selectedImage) return;

    const result = await upload(selectedImage.uri, {
      ...uploadOptions,
      onProgress: (prog) => {
        // Progress is already tracked in the hook
      },
    });

    if (result.success && result.url) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      onSuccess(result.url);
      handleClose();
    }
  };

  const handleClose = () => {
    if (isUploading) {
      cancel();
    }
    setSelectedImage(null);
    setShowPicker(true);
    onClose();
  };

  const handleRetry = () => {
    setSelectedImage(null);
    setShowPicker(true);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => !isUploading && handleClose()}
        />

        <View style={styles.container}>
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>
              {title || (isRTL ? 'رفع صورة' : 'Upload Image')}
            </Text>
            <TouchableOpacity
              onPress={handleClose}
              style={styles.closeButton}
              disabled={isUploading}
            >
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          {showPicker ? (
            // Picker Options
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={styles.pickerButton}
                onPress={handlePickFromGallery}
                disabled={isPicking}
                activeOpacity={0.7}
              >
                <View style={styles.pickerIconContainer}>
                  <Ionicons name="images-outline" size={32} color={COLORS.primary} />
                </View>
                <Text style={styles.pickerButtonText}>
                  {isRTL ? 'اختر من المعرض' : 'Choose from Gallery'}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.pickerButton}
                onPress={handlePickFromCamera}
                disabled={isPicking}
                activeOpacity={0.7}
              >
                <View style={styles.pickerIconContainer}>
                  <Ionicons name="camera-outline" size={32} color={COLORS.primary} />
                </View>
                <Text style={styles.pickerButtonText}>
                  {isRTL ? 'التقط صورة' : 'Take Photo'}
                </Text>
              </TouchableOpacity>

              {isPicking && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={COLORS.primary} />
                  <Text style={styles.loadingText}>
                    {isRTL ? 'جاري التحميل...' : 'Loading...'}
                  </Text>
                </View>
              )}
            </View>
          ) : selectedImage ? (
            // Preview & Upload
            <View style={styles.previewContainer}>
              <Image source={{ uri: selectedImage.uri }} style={styles.previewImage} />

              {/* Image Info */}
              <View style={styles.imageInfo}>
                <Text style={styles.imageInfoText}>
                  {`${Math.round(selectedImage.width)} × ${Math.round(selectedImage.height)}`}
                </Text>
                <Text style={styles.imageInfoText}>
                  {`${(selectedImage.size / 1024).toFixed(0)} KB`}
                </Text>
              </View>

              {/* Upload Progress */}
              {isUploading && (
                <View style={styles.progressContainer}>
                  <View style={styles.progressBar}>
                    <View style={[styles.progressFill, { width: `${progress}%` }]} />
                  </View>
                  <Text style={styles.progressText}>{`${Math.round(progress)}%`}</Text>
                </View>
              )}

              {/* Actions */}
              <View style={styles.actionsContainer}>
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={handleRetry}
                  disabled={isUploading}
                  activeOpacity={0.7}
                >
                  <Ionicons name="refresh-outline" size={20} color={COLORS.textPrimary} />
                  <Text style={styles.retryButtonText}>
                    {isRTL ? 'اختر صورة أخرى' : 'Choose Another'}
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.uploadButton, isUploading && styles.uploadButtonDisabled]}
                  onPress={handleUpload}
                  disabled={isUploading}
                  activeOpacity={0.7}
                >
                  <LinearGradient
                    colors={isUploading ? [COLORS.backgroundCard, COLORS.backgroundCard] : [COLORS.primary, '#FFA500']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.uploadButtonGradient}
                  >
                    {isUploading ? (
                      <ActivityIndicator color={COLORS.textPrimary} size="small" />
                    ) : (
                      <>
                        <Ionicons name="cloud-upload-outline" size={20} color={COLORS.background} />
                        <Text style={styles.uploadButtonText}>
                          {isRTL ? 'رفع' : 'Upload'}
                        </Text>
                      </>
                    )}
                  </LinearGradient>
                </TouchableOpacity>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '80%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textSecondary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  closeButton: {
    padding: 4,
  },
  pickerContainer: {
    padding: 20,
    gap: 16,
  },
  pickerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.background,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    gap: 16,
  },
  pickerIconContainer: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${COLORS.primary}20`,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerButtonText: {
    flex: 1,
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 12,
  },
  loadingText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  previewContainer: {
    padding: 20,
    gap: 16,
  },
  previewImage: {
    width: '100%',
    height: 300,
    borderRadius: 16,
    backgroundColor: COLORS.background,
  },
  imageInfo: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    backgroundColor: COLORS.background,
    borderRadius: 12,
  },
  imageInfoText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  progressContainer: {
    gap: 8,
  },
  progressBar: {
    height: 8,
    backgroundColor: COLORS.background,
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: COLORS.primary,
  },
  progressText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  actionsContainer: {
    flexDirection: 'row',
    gap: 12,
    paddingTop: 8,
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  uploadButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  uploadButtonDisabled: {
    opacity: 0.5,
  },
  uploadButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
    gap: 8,
  },
  uploadButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.background,
  },
});
