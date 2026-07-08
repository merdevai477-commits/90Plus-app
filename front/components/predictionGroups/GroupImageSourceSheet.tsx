/**
 * Bottom sheet — pick group image from gallery or camera.
 */

import * as Haptics from 'expo-haptics';
import { Camera, ImageIcon } from 'lucide-react-native';
import React from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { LiquidGlassSurface } from './LiquidGlassSurface';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';

export interface GroupImageSourceSheetProps {
  visible: boolean;
  hasImage?: boolean;
  isRTL?: boolean;
  /**
   * When true, renders as an in-place absolute overlay instead of a native
   * Modal. Use this when opened from inside another Modal (nested Modals
   * render as a black screen on Android/iOS).
   */
  embedded?: boolean;
  onClose: () => void;
  onPickGallery: () => void;
  onPickCamera: () => void;
  onRemoveImage?: () => void;
}

export function GroupImageSourceSheet({
  visible,
  hasImage = false,
  isRTL = false,
  embedded = false,
  onClose,
  onPickGallery,
  onPickCamera,
  onRemoveImage,
}: GroupImageSourceSheetProps) {
  const insets = useSafeAreaInsets();
  const { medium, bold, extra } = usePGFonts();
  const textAlign = isRTL ? 'right' : 'left';

  const pick = (source: 'gallery' | 'camera') => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    // The parent closes this sheet and launches the picker — calling onClose
    // here too would reset its keep-hidden state and flash the edit sheet back.
    if (source === 'gallery') onPickGallery();
    else onPickCamera();
  };

  if (!visible) return null;

  const cardInner = (
    <>
      {!embedded ? <View style={styles.handle} /> : null}
      <Text style={[styles.title, { fontFamily: extra, textAlign }]}>صورة المجموعة</Text>
      <Text style={[styles.sub, { fontFamily: medium, textAlign }]}>اختر مصدر الصورة</Text>

      <View style={styles.options}>
        <Pressable
          onPress={() => pick('gallery')}
          style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        >
          <View style={styles.iconWrap}>
            <ImageIcon size={22} color={PG.primaryLight} />
          </View>
          <Text style={[styles.optionText, { fontFamily: bold }]}>المعرض</Text>
        </Pressable>

        <Pressable
          onPress={() => pick('camera')}
          style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
        >
          <View style={styles.iconWrap}>
            <Camera size={22} color={PG.primaryLight} />
          </View>
          <Text style={[styles.optionText, { fontFamily: bold }]}>الكاميرا</Text>
        </Pressable>
      </View>

      {hasImage && onRemoveImage ? (
        <Pressable
          onPress={() => {
            onClose();
            onRemoveImage();
          }}
          style={({ pressed }) => [styles.removeBtn, pressed && { opacity: 0.85 }]}
        >
          <Text style={[styles.removeTxt, { fontFamily: medium }]}>إزالة الصورة</Text>
        </Pressable>
      ) : null}

      <Pressable
        onPress={onClose}
        style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
      >
        <Text style={[styles.cancelTxt, { fontFamily: medium }]}>إلغاء</Text>
      </Pressable>
    </>
  );

  // Embedded (opened from inside another modal): render as a centered popup on
  // a solid surface. A second BlurView over the parent's BlurView renders
  // behind the backdrop on Android (native blur ignores RN z-order), and a
  // bottom-sheet layout collides with the parent sheet — so center a solid card.
  if (embedded) {
    return (
      <View style={[StyleSheet.absoluteFillObject, styles.embeddedRoot]}>
        <Pressable style={[StyleSheet.absoluteFill, styles.embeddedDim]} onPress={onClose} />
        <View style={[styles.card, styles.solidCard, styles.popupCard]}>{cardInner}</View>
      </View>
    );
  }

  return (
    <Modal visible transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        <SheetBlurBackdrop onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + 16 }]}>
          <LiquidGlassSurface borderRadius={PG_RADII.xl} subtleShadow style={styles.card}>
            {cardInner}
          </LiquidGlassSurface>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  embeddedRoot: {
    justifyContent: 'center',
    alignItems: 'stretch',
    paddingHorizontal: 20,
    zIndex: 3000,
    elevation: 3000,
  },
  embeddedDim: { backgroundColor: 'rgba(0,0,0,0.6)' },
  popupCard: { zIndex: 2, paddingTop: PG_SPACING.lg },
  sheet: { paddingHorizontal: 12, zIndex: 2 },
  card: {
    paddingHorizontal: PG_SPACING.lg,
    paddingTop: PG_SPACING.sm,
    paddingBottom: PG_SPACING.md,
    overflow: 'hidden',
  },
  solidCard: {
    borderRadius: PG_RADII.xl,
    backgroundColor: 'rgba(15,5,25,0.98)',
    borderWidth: 1,
    borderColor: PG.heroGlassBorder,
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
      },
      android: { elevation: 12 },
      default: {},
    }),
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: PG.border,
    marginBottom: PG_SPACING.md,
  },
  title: {
    color: PG.text,
    fontSize: PG_TYPE.title,
    marginBottom: 4,
  },
  sub: {
    color: PG.textMuted,
    fontSize: PG_TYPE.caption,
    marginBottom: PG_SPACING.lg,
  },
  options: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: PG_SPACING.md,
  },
  option: {
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
  optionPressed: {
    opacity: 0.88,
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderColor: 'rgba(167,139,250,0.35)',
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167,139,250,0.28)',
  },
  optionText: {
    color: PG.text,
    fontSize: PG_TYPE.body,
  },
  removeBtn: {
    alignItems: 'center',
    paddingVertical: 12,
    marginBottom: 4,
  },
  removeTxt: {
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
  cancelTxt: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.body,
  },
});
