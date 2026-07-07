/**
 * Bottom sheet — edit group name and photo (opened from pencil only).
 */

import { BlurView } from 'expo-blur';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Camera, Crown, ImageIcon, Shield, X } from 'lucide-react-native';
import React, { useCallback, useEffect, useState } from 'react';
import {
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
import { LiquidGlassSurface } from './LiquidGlassSurface';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

const SheetGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const SHEET_GLASS_PROPS = isLiquidGlassSupported
  ? { effect: 'regular' as const, tintColor: 'rgba(15,5,25,0.99)' }
  : { intensity: Platform.OS === 'android' ? 40 : 30, tint: 'dark' as const };

export interface GroupEditSheetProps {
  visible: boolean;
  onClose: () => void;
  groupName: string;
  groupImage: string | null;
  onSave: (name: string, imageUri: string | null) => void;
  isRTL?: boolean;
  isAdmin?: boolean;
}

export function GroupEditSheet({
  visible,
  onClose,
  groupName,
  groupImage,
  onSave,
  isRTL = false,
  isAdmin = false,
}: GroupEditSheetProps) {
  const insets = useSafeAreaInsets();
  const { medium, bold, extra } = usePGFonts();
  const { pickFromGallery, pickFromCamera } = useImagePicker();

  const [draftName, setDraftName] = useState(groupName);
  const [draftImage, setDraftImage] = useState<string | null>(groupImage);
  const [sourcePickerOpen, setSourcePickerOpen] = useState(false);

  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const textAlign = isRTL ? 'right' : 'left';

  useEffect(() => {
    if (visible) {
      setDraftName(groupName);
      setDraftImage(groupImage);
      setSourcePickerOpen(false);
    }
  }, [visible, groupName, groupImage]);

  const pickImage = useCallback(
    async (source: 'gallery' | 'camera') => {
      const result =
        source === 'gallery'
          ? await pickFromGallery({ type: 'avatar', allowsEditing: true, aspect: [1, 1] })
          : await pickFromCamera({ type: 'avatar', allowsEditing: true, aspect: [1, 1] });
      if (result?.uri) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
        setDraftImage(result.uri);
      }
    },
    [pickFromCamera, pickFromGallery],
  );

  const handlePickSource = useCallback(
    (source: 'gallery' | 'camera') => {
      setSourcePickerOpen(false);
      setTimeout(() => {
        void pickImage(source);
      }, 160);
    },
    [pickImage],
  );

  const openImagePicker = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setSourcePickerOpen(true);
  }, []);

  const removeImage = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    setDraftImage(null);
    setSourcePickerOpen(false);
  }, []);

  const handleSave = useCallback(() => {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    onSave(trimmed, draftImage);
    onClose();
  }, [draftName, draftImage, onSave, onClose]);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.modalRoot}>
        <SheetBlurBackdrop onPress={sourcePickerOpen ? () => setSourcePickerOpen(false) : onClose} />

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
              <Text style={[styles.adminText, { fontFamily: bold }]}>مدير الجروب</Text>
            </View>
          )}

          <View style={[styles.header, row]}>
            <Text style={[styles.title, { fontFamily: extra, textAlign }]}>تعديل المجموعة</Text>
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
              <Text style={[styles.changePhotoText, { fontFamily: medium }]}>تغيير الصورة</Text>
            </View>
          </Pressable>

          <Text style={[styles.fieldLabel, { fontFamily: medium, textAlign }]}>اسم المجموعة</Text>
          <TextInput
            value={draftName}
            onChangeText={setDraftName}
            placeholder="اسم المجموعة"
            placeholderTextColor={PG.textMuted}
            style={[styles.input, { fontFamily: medium, textAlign }]}
            maxLength={32}
          />

          <Pressable
            onPress={handleSave}
            style={({ pressed }) => [styles.saveBtn, pressed && { opacity: 0.9 }]}
          >
            <LinearGradient
              colors={[PG.primaryLight, PG.primary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.saveGrad}
            >
              <Text style={[styles.saveText, { fontFamily: bold }]}>حفظ التعديلات</Text>
            </LinearGradient>
          </Pressable>
        </SheetGlass>
      </View>

      {sourcePickerOpen ? (
        <View style={styles.sourceOverlay} pointerEvents="box-none">
          <Pressable
            style={styles.sourceScrim}
            onPress={() => setSourcePickerOpen(false)}
            accessibilityRole="button"
            accessibilityLabel="إلغاء"
          />
          <View style={[styles.sourceSheet, { paddingBottom: insets.bottom + 16 }]}>
            <LiquidGlassSurface borderRadius={PG_RADII.xl} subtleShadow style={styles.sourceCard}>
              <View style={styles.sourceHandle} />
              <Text style={[styles.sourceTitle, { fontFamily: extra, textAlign }]}>صورة المجموعة</Text>
              <Text style={[styles.sourceSub, { fontFamily: medium, textAlign }]}>
                اختر مصدر الصورة
              </Text>

              <View style={styles.sourceOptions}>
                <Pressable
                  onPress={() => handlePickSource('gallery')}
                  style={({ pressed }) => [styles.sourceOption, pressed && styles.sourceOptionPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="المعرض"
                >
                  <View style={styles.sourceIconWrap}>
                    <ImageIcon size={22} color={PG.primaryLight} />
                  </View>
                  <Text style={[styles.sourceOptionText, { fontFamily: bold }]}>المعرض</Text>
                </Pressable>

                <Pressable
                  onPress={() => handlePickSource('camera')}
                  style={({ pressed }) => [styles.sourceOption, pressed && styles.sourceOptionPressed]}
                  accessibilityRole="button"
                  accessibilityLabel="الكاميرا"
                >
                  <View style={styles.sourceIconWrap}>
                    <Camera size={22} color={PG.primaryLight} />
                  </View>
                  <Text style={[styles.sourceOptionText, { fontFamily: bold }]}>الكاميرا</Text>
                </Pressable>
              </View>

              {draftImage ? (
                <Pressable
                  onPress={removeImage}
                  style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.85 }]}
                  accessibilityRole="button"
                  accessibilityLabel="إزالة الصورة"
                >
                  <Text style={[styles.removeBtnText, { fontFamily: medium }]}>إزالة الصورة</Text>
                </Pressable>
              ) : null}

              <Pressable
                onPress={() => setSourcePickerOpen(false)}
                style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
                accessibilityRole="button"
                accessibilityLabel="إلغاء"
              >
                <Text style={[styles.cancelBtnText, { fontFamily: medium }]}>إلغاء</Text>
              </Pressable>
            </LiquidGlassSurface>
          </View>
        </View>
      ) : null}
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
    marginBottom: PG_SPACING.lg,
  },
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
  sourceOverlay: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 20,
    justifyContent: 'flex-end',
  },
  sourceScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  sourceSheet: {
    paddingHorizontal: 12,
  },
  sourceCard: {
    paddingHorizontal: PG_SPACING.lg,
    paddingTop: PG_SPACING.sm,
    paddingBottom: PG_SPACING.md,
    overflow: 'hidden',
  },
  sourceHandle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PG.border,
    marginBottom: PG_SPACING.md,
  },
  sourceTitle: {
    color: PG.text,
    fontSize: PG_TYPE.title,
    marginBottom: 4,
  },
  sourceSub: {
    color: PG.textMuted,
    fontSize: PG_TYPE.caption,
    marginBottom: PG_SPACING.lg,
  },
  sourceOptions: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: PG_SPACING.md,
  },
  sourceOption: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
    paddingVertical: 16,
    paddingHorizontal: 12,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.glassStrong,
    borderWidth: 1,
    borderColor: PG.borderSoft,
  },
  sourceOptionPressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  sourceIconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  sourceOptionText: {
    color: PG.text,
    fontSize: PG_TYPE.body,
  },
  removeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  removeBtnText: {
    color: '#F87171',
    fontSize: PG_TYPE.body,
  },
  cancelBtn: {
    alignItems: 'center',
    paddingVertical: 14,
    marginTop: 4,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.glass,
  },
  cancelBtnText: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.body,
  },
});
