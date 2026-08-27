/**
 * ImagePreviewModal
 *
 * Preview selected image before upload + cross-platform source sheet.
 * Styled to match the purple profile glass theme.
 */

import React from 'react';
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
import { ProfileTheme } from '../../constants/ProfileTheme';

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
          <LinearGradient
            colors={['#1A0B33', '#0B0614', '#12081F']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.header}>
            <Text style={styles.title}>
              {isAvatar ? t.profile.previewAvatarTitle : t.profile.previewCoverTitle}
            </Text>
            <TouchableOpacity onPress={onCancel} style={styles.closeBtn} disabled={isUploading}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
          </View>

          <View style={[styles.previewWrapper, { alignItems: 'center' }]}>
            {isAvatar ? (
              <View
                style={[
                  styles.avatarCircle,
                  { width: previewSize, height: previewSize, borderRadius: previewSize / 2 },
                ]}
              >
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

          {isUploading ? (
            <View style={styles.progressContainer}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${uploadProgress}%` }]} />
              </View>
              <Text style={styles.progressText}>{Math.round(uploadProgress)}%</Text>
            </View>
          ) : null}

          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={onCancel}
              disabled={isUploading}
              activeOpacity={0.7}
            >
              <Text style={styles.cancelText}>{t.profile.cancel}</Text>
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
                colors={['#8B5CF6', '#5B21B6']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.confirmGradient}
              >
                {isUploading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <>
                    <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
                    <Text style={styles.confirmText}>{t.profile.confirmUpload}</Text>
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

export interface ImageSourceSheetOptions {
  title?: string;
  hasExistingImage?: boolean;
  onGallery: () => void;
  onCamera: () => void;
  onRemove?: () => void;
  onCancel?: () => void;
  labels?: {
    gallery: string;
    camera: string;
    remove: string;
    cancel: string;
  };
}

export function showImageSourceSheet(
  options: ImageSourceSheetOptions,
  setAndroidSheetVisible: (v: boolean) => void,
  setAndroidSheetOptions: (o: ImageSourceSheetOptions) => void,
): void {
  if (Platform.OS === 'ios') {
    const gallery = options.labels?.gallery ?? 'Choose from gallery';
    const camera = options.labels?.camera ?? 'Take a photo';
    const remove = options.labels?.remove ?? 'Remove photo';
    const cancel = options.labels?.cancel ?? 'Cancel';

    const iosOptions: string[] = [gallery, camera];
    if (options.hasExistingImage && options.onRemove) iosOptions.push(remove);
    iosOptions.push(cancel);

    ActionSheetIOS.showActionSheetWithOptions(
      {
        options: iosOptions,
        cancelButtonIndex: iosOptions.length - 1,
        destructiveButtonIndex:
          options.hasExistingImage && options.onRemove ? iosOptions.length - 2 : undefined,
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

interface AndroidSheetProps {
  visible: boolean;
  options: ImageSourceSheetOptions | null;
  onClose: () => void;
}

export const AndroidImageSourceSheet: React.FC<AndroidSheetProps> = ({
  visible,
  options,
  onClose,
}) => {
  const { t } = useTranslation();
  if (!options) return null;

  const handleOption = (fn: () => void) => {
    onClose();
    setTimeout(fn, 150);
  };

  const gallery = options.labels?.gallery ?? t.profile.chooseFromGallery;
  const camera = options.labels?.camera ?? t.profile.takePhoto;
  const remove = options.labels?.remove ?? t.profile.removePhoto;
  const cancel = options.labels?.cancel ?? t.profile.cancel;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <TouchableOpacity style={styles.sheetOverlay} activeOpacity={1} onPress={onClose} />
      <View style={styles.sheetContainer}>
        <LinearGradient colors={['#1A0B33', '#0B0614']} style={StyleSheet.absoluteFill} />
        <View style={styles.sheetHandle} />
        {options.title ? <Text style={styles.sheetTitle}>{options.title}</Text> : null}

        <TouchableOpacity
          style={styles.sheetOption}
          onPress={() => handleOption(options.onGallery)}
          activeOpacity={0.7}
        >
          <Ionicons name="images-outline" size={22} color={ProfileTheme.colors.avatarRing} />
          <Text style={styles.sheetOptionText}>{gallery}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.sheetOption}
          onPress={() => handleOption(options.onCamera)}
          activeOpacity={0.7}
        >
          <Ionicons name="camera-outline" size={22} color={ProfileTheme.colors.avatarRing} />
          <Text style={styles.sheetOptionText}>{camera}</Text>
        </TouchableOpacity>

        {options.hasExistingImage && options.onRemove ? (
          <TouchableOpacity
            style={[styles.sheetOption, styles.sheetOptionDestructive]}
            onPress={() => handleOption(options.onRemove!)}
            activeOpacity={0.7}
          >
            <Ionicons name="trash-outline" size={22} color="#FF3B30" />
            <Text style={[styles.sheetOptionText, { color: '#FF3B30' }]}>{remove}</Text>
          </TouchableOpacity>
        ) : null}

        <TouchableOpacity style={[styles.sheetOption, styles.sheetCancel]} onPress={onClose} activeOpacity={0.7}>
          <Text style={[styles.sheetOptionText, { color: 'rgba(255,255,255,0.5)' }]}>{cancel}</Text>
        </TouchableOpacity>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  container: {
    backgroundColor: ProfileTheme.colors.profileCard,
    borderRadius: 22,
    width: '100%',
    padding: 20,
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.32)',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  title: { fontSize: 17, fontWeight: '800', color: '#fff', flex: 1, paddingRight: 8 },
  closeBtn: {
    padding: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    width: 28,
    height: 28,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
  },
  previewWrapper: { marginBottom: 20 },
  avatarCircle: {
    overflow: 'hidden',
    borderWidth: 2.5,
    borderColor: ProfileTheme.colors.avatarRing,
  },
  coverPreview: {
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  progressContainer: { marginBottom: 16 },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: {
    height: '100%',
    backgroundColor: ProfileTheme.colors.profilePrimary,
    borderRadius: 3,
  },
  progressText: { color: 'rgba(255,255,255,0.6)', fontSize: 12, textAlign: 'center' },
  actions: { flexDirection: 'row', gap: 12 },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  cancelText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  confirmBtn: { flex: 1, borderRadius: 12, overflow: 'hidden' },
  btnDisabled: { opacity: 0.5 },
  confirmGradient: {
    height: 48,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  confirmText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.65)' },
  sheetContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: ProfileTheme.colors.profileBg,
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingBottom: 34,
    paddingTop: 12,
    paddingHorizontal: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  sheetHandle: {
    width: 40,
    height: 4,
    backgroundColor: 'rgba(216,174,255,0.35)',
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sheetTitle: {
    color: ProfileTheme.colors.profileMuted,
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
  sheetOptionText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
