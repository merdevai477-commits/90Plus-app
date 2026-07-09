/**
 * Bottom sheet — edit group name and photo (opened from pencil only).
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Crown, LogOut, Shield, Trash2, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { useImagePicker } from '../../hooks/useImagePicker';
import { useImageUpload } from '../../hooks/useImageUpload';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';
import { GroupConfirmDialog } from './GroupConfirmDialog';
import { GroupImageSourceSheet } from './GroupImageSourceSheet';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

const SheetGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const SHEET_GLASS_PROPS = isLiquidGlassSupported
  ? { effect: 'regular' as const, tintColor: 'rgba(15,5,25,0.99)' }
  : { intensity: Platform.OS === 'android' ? 40 : 30, tint: 'dark' as const };

export interface GroupEditSheetProps {
  visible: boolean;
  onClose: () => void;
  groupId: string;
  groupName: string;
  groupImage: string | null;
  onSave: (name: string, imageUri: string | null) => void | Promise<void>;
  onLeaveGroup?: () => void | Promise<unknown>;
  onDeleteGroup?: () => void | Promise<unknown>;
  isRTL?: boolean;
  isAdmin?: boolean;
}

function isLocalImageUri(uri: string | null | undefined): boolean {
  if (!uri) return false;
  return uri.startsWith('file://') || uri.startsWith('content://') || uri.startsWith('ph://');
}

export function GroupEditSheet({
  visible,
  onClose,
  groupId,
  groupName,
  groupImage,
  onSave,
  onLeaveGroup,
  onDeleteGroup,
  isRTL = false,
  isAdmin = false,
}: GroupEditSheetProps) {
  const insets = useSafeAreaInsets();
  const { medium, bold, extra } = usePGFonts();
  const { pickFromGallery, pickFromCamera } = useImagePicker();
  const { upload, isUploading } = useImageUpload();
  const toast = useToast();
  const { t } = useTranslation();
  const es = t.predictionGroups.editSheet;
  const common = t.predictionGroups.common;

  const [draftName, setDraftName] = useState(groupName);
  const [draftImage, setDraftImage] = useState<string | null>(groupImage);
  const [dangerBusy, setDangerBusy] = useState(false);
  const [imageSourceOpen, setImageSourceOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [leaveConfirmOpen, setLeaveConfirmOpen] = useState(false);
  // While the OS image picker is presenting we must hide this RN Modal —
  // otherwise iOS refuses to present the picker over an open modal (the
  // gallery/camera never appears).
  const [pickerActive, setPickerActive] = useState(false);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const textAlign = isRTL ? 'right' : 'left';

  useEffect(() => {
    if (visible) {
      setDraftName(groupName);
      setDraftImage(groupImage);
      setDangerBusy(false);
      setImageSourceOpen(false);
      setDeleteConfirmOpen(false);
      setLeaveConfirmOpen(false);
    }
  }, [visible, groupName, groupImage]);

  const pickImage = useCallback(
    async (source: 'gallery' | 'camera') => {
      // The edit sheet is already hidden (pickerActive) — wait for the source
      // sheet dismiss animation to settle so the OS picker can present cleanly.
      setPickerActive(true);
      await new Promise((resolve) => setTimeout(resolve, Platform.OS === 'ios' ? 400 : 250));
      try {
        const result =
          source === 'gallery'
            ? await pickFromGallery({ type: 'avatar', allowsEditing: true, aspect: [1, 1] })
            : await pickFromCamera({ type: 'avatar', allowsEditing: true, aspect: [1, 1] });
        if (result?.uri) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setDraftImage(result.uri);
        }
      } finally {
        setPickerActive(false);
      }
    },
    [pickFromCamera, pickFromGallery],
  );

  const handlePickSource = useCallback(
    (source: 'gallery' | 'camera') => {
      // Close the source sheet but keep the edit sheet hidden (pickerActive)
      // until the picker returns — avoids any modal flashing back in.
      setImageSourceOpen(false);
      void pickImage(source);
    },
    [pickImage],
  );

  const openImagePicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // Keep the edit modal open and show the source picker as an embedded
    // overlay inside it — toggling two separate RN modals in one frame races
    // on Android and shows a dim backdrop with no content.
    setImageSourceOpen(true);
  }, []);

  const closeImageSource = useCallback(() => {
    setImageSourceOpen(false);
  }, []);

  const runDelete = useCallback(async () => {
    setDangerBusy(true);
    try {
      await onDeleteGroup?.();
      setDeleteConfirmOpen(false);
      onClose();
    } catch (e: any) {
      toast.showError(es.deleteFailed, e?.message ?? '');
    } finally {
      setDangerBusy(false);
    }
  }, [onClose, onDeleteGroup, toast]);

  const runLeave = useCallback(async () => {
    setDangerBusy(true);
    try {
      await onLeaveGroup?.();
      setLeaveConfirmOpen(false);
      onClose();
    } catch (e: any) {
      toast.showError(es.leaveFailed, e?.message ?? '');
    } finally {
      setDangerBusy(false);
    }
  }, [onClose, onLeaveGroup, toast]);

  const handleSave = useCallback(async () => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    try {
      let finalImage = draftImage;
      if (isLocalImageUri(draftImage)) {
        const result = await upload(draftImage!, {
          endpoint: '/upload/group-avatar',
          fieldName: 'file',
          additionalData: { groupId },
        });
        if (!result.success || !result.url) {
          toast.showError(es.uploadFailed, result.error ?? t.predictionGroups.onboarding.tryAgain);
          return;
        }
        finalImage = result.url;
      }
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      await onSave(trimmed, finalImage);
      onClose();
    } catch (e: any) {
      toast.showError(es.saveFailed, e?.message ?? '');
    }
  }, [draftName, draftImage, groupId, onClose, onSave, toast, upload]);

  return (
    <Modal
      visible={visible && !pickerActive}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <SheetBlurBackdrop onPress={onClose} />

      <View style={[styles.sheet, { paddingBottom: insets.bottom + 12 }]}>
        <SheetGlass {...SHEET_GLASS_PROPS} style={styles.sheetGlass}>
          <LinearGradient
            colors={['rgba(124,58,237,0.14)', 'transparent']}
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.sheetTint} pointerEvents="none" />

          <View style={styles.handle} />

          {isAdmin && (
            <View style={[styles.adminBadge, row]}>
              <Crown size={14} color={PG.gold} fill={PG.gold} />
              <Text style={[styles.adminText, { fontFamily: bold }]}>{common.groupAdmin}</Text>
            </View>
          )}

          <View style={[styles.header, row]}>
            <Text style={[styles.title, { fontFamily: extra, textAlign }]}>{es.title}</Text>
            <Pressable onPress={onClose} hitSlop={10} style={styles.closeBtn}>
              <X size={20} color={PG.textSecondary} />
            </Pressable>
          </View>

          <Pressable onPress={openImagePicker} style={styles.avatarWrap}>
            <View style={styles.avatarRing}>
              {draftImage ? (
                <Image source={{ uri: draftImage }} style={styles.avatar} contentFit="cover" />
              ) : (
                <View style={styles.avatarPlaceholder}>
                  <Shield size={40} color={PG.primaryLight} />
                </View>
              )}
            </View>
            <View style={[styles.changePhotoBtn, row]}>
              <Camera size={14} color={PG.primaryLight} />
              <Text style={[styles.changePhotoText, { fontFamily: medium }]}>{es.changePhoto}</Text>
            </View>
          </Pressable>

          <Text style={[styles.fieldLabel, { fontFamily: medium, textAlign }]}>{es.groupName}</Text>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder={es.groupNamePlaceholder}
            placeholderTextColor={PG.textMuted}
            style={[styles.input, { fontFamily: medium, textAlign }]}
            maxLength={32}
          />

          <View style={styles.dangerZone}>
            {isAdmin && onDeleteGroup ? (
              <Pressable
                onPress={() => setDeleteConfirmOpen(true)}
                disabled={dangerBusy || isUploading}
                style={({ pressed }) => [styles.dangerBtn, pressed && { opacity: 0.85 }]}
              >
                <Trash2 size={16} color="#F87171" />
                <Text style={[styles.dangerTxt, { fontFamily: bold }]}>{es.deleteGroup}</Text>
              </Pressable>
            ) : null}
            {onLeaveGroup ? (
              <Pressable
                onPress={() => setLeaveConfirmOpen(true)}
                disabled={dangerBusy || isUploading}
                style={({ pressed }) => [styles.leaveBtn, pressed && { opacity: 0.85 }]}
              >
                <LogOut size={15} color={PG.textSecondary} />
                <Text style={[styles.leaveTxt, { fontFamily: medium }]}>{common.leaveGroup}</Text>
              </Pressable>
            ) : null}
          </View>

          <Pressable
            onPress={() => void handleSave()}
            disabled={isUploading || dangerBusy}
            style={({ pressed }) => [styles.saveBtn, (pressed || isUploading) && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={[PG.primaryLight, PG.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGrad}
            >
              {isUploading ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <Text style={[styles.saveText, { fontFamily: bold }]}>{es.saveChanges}</Text>
              )}
            </LinearGradient>
          </Pressable>
        </SheetGlass>
      </View>

        <GroupImageSourceSheet
          visible={imageSourceOpen}
          embedded
          hasImage={Boolean(draftImage)}
          isRTL={isRTL}
          onClose={closeImageSource}
          onPickGallery={() => handlePickSource('gallery')}
          onPickCamera={() => handlePickSource('camera')}
          onRemoveImage={() => setDraftImage(null)}
        />

        <GroupConfirmDialog
          visible={deleteConfirmOpen}
          embedded
          title={es.deleteTitle}
          message={es.deleteMessage}
          confirmLabel={es.deleteConfirm}
          destructive
          loading={dangerBusy}
          isRTL={isRTL}
          onConfirm={() => void runDelete()}
          onCancel={() => setDeleteConfirmOpen(false)}
        />

        <GroupConfirmDialog
          visible={leaveConfirmOpen}
          embedded
          title={es.leaveTitle}
          message={es.leaveMessage}
          confirmLabel={common.leave}
          destructive
          loading={dangerBusy}
          isRTL={isRTL}
          onConfirm={() => void runLeave()}
          onCancel={() => setLeaveConfirmOpen(false)}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalRoot: { flex: 1, zIndex: 1000 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 12,
    zIndex: 2,
  },
  sheetGlass: {
    borderRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.heroGlassBorder,
    overflow: 'hidden',
    paddingHorizontal: PG_SPACING.lg,
    paddingTop: PG_SPACING.sm,
    paddingBottom: PG_SPACING.lg,
    backgroundColor: Platform.OS === 'android' ? 'rgba(4,2,8,0.98)' : undefined,
  },
  sheetTint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(4,2,8,0.5)',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PG.border,
    marginBottom: PG_SPACING.md,
  },
  adminBadge: {
    alignSelf: 'center',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: PG_RADII.pill,
    backgroundColor: 'rgba(245,185,66,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(245,185,66,0.35)',
    marginBottom: PG_SPACING.md,
  },
  adminText: {
    color: PG.gold,
    fontSize: PG_TYPE.caption,
  },
  header: {
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: PG_SPACING.lg,
  },
  title: { color: PG.text, fontSize: PG_TYPE.title, flex: 1 },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PG.glassStrong,
  },
  avatarWrap: {
    alignItems: 'center',
    gap: 10,
    marginBottom: PG_SPACING.lg,
  },
  avatarRing: {
    width: 96,
    height: 96,
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(167,139,250,0.45)',
    backgroundColor: PG.glassStrong,
  },
  avatar: { width: '100%', height: '100%' },
  avatarPlaceholder: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.12)',
  },
  changePhotoBtn: {
    alignItems: 'center',
    gap: 6,
    paddingVertical: 6,
    paddingHorizontal: 12,
  },
  changePhotoText: {
    color: PG.primaryLight,
    fontSize: PG_TYPE.caption,
  },
  fieldLabel: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.caption,
    marginBottom: 6,
  },
  input: {
    backgroundColor: PG.glassStrong,
    borderRadius: PG_RADII.md,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    paddingHorizontal: PG_SPACING.md,
    paddingVertical: 12,
    color: PG.text,
    fontSize: PG_TYPE.body,
    marginBottom: PG_SPACING.md,
  },
  dangerZone: { gap: 8, marginBottom: PG_SPACING.lg },
  dangerBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: PG_RADII.md,
    backgroundColor: 'rgba(248,113,113,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.35)',
  },
  dangerTxt: { color: '#F87171', fontSize: PG_TYPE.body },
  leaveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 10,
  },
  leaveTxt: { color: PG.textSecondary, fontSize: PG_TYPE.caption },
  saveBtn: {
    borderRadius: PG_RADII.lg,
    overflow: 'hidden',
  },
  saveGrad: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveText: {
    color: '#FFFFFF',
    fontSize: PG_TYPE.body,
  },
});
