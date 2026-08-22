/**
 * Glass-styled confirmation dialog for group actions (leave, delete, etc.).
 */

import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertTriangle } from 'lucide-react-native';
import React from 'react';
import {
  ActivityIndicator,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { isLiquidGlassSupported, LiquidGlassView } from '../../utils/liquidGlassSafe';
import { SheetBlurBackdrop } from './SheetBlurBackdrop';
import { PG, PG_RADII, PG_SPACING, PG_TYPE, usePGFonts } from './theme';
import { useTranslation } from '../../src/i18n';

const DialogGlass = isLiquidGlassSupported ? LiquidGlassView : BlurView;
const DIALOG_GLASS_PROPS = isLiquidGlassSupported
  ? { effect: 'regular' as const, tintColor: 'rgba(15,5,25,0.99)' }
  : { intensity: Platform.OS === 'android' ? 40 : 30, tint: 'dark' as const };

export interface GroupConfirmDialogProps {
  visible: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  loading?: boolean;
  isRTL?: boolean;
  /**
   * When true, renders as an in-place absolute overlay instead of a native
   * Modal. Use this when the dialog is opened from inside another Modal
   * (nested Modals render as a black screen on Android/iOS).
   */
  embedded?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function GroupConfirmDialog({
  visible,
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive = false,
  loading = false,
  isRTL = false,
  embedded = false,
  onConfirm,
  onCancel,
}: GroupConfirmDialogProps) {
  const { medium, bold, extra } = usePGFonts();
  const { t } = useTranslation();
  const resolvedCancel = cancelLabel ?? t.predictionGroups.common.cancel;
  const textAlign = isRTL ? 'right' : 'left';

  if (!visible) return null;

  const content = (
    <>
      <SheetBlurBackdrop onPress={loading ? undefined : onCancel} />
      <View style={styles.center}>
        <DialogGlass {...DIALOG_GLASS_PROPS} style={styles.card}>
          <LinearGradient
            colors={
              destructive
                ? ['rgba(248,113,113,0.12)', 'rgba(124,58,237,0.06)']
                : ['rgba(124,58,237,0.14)', 'transparent']
            }
            style={StyleSheet.absoluteFillObject}
            pointerEvents="none"
          />
          <View style={styles.tint} pointerEvents="none" />

          <View style={[styles.iconWrap, destructive && styles.iconWrapDanger]}>
            <AlertTriangle size={22} color={destructive ? '#F87171' : PG.primaryLight} />
          </View>

          <Text style={[styles.title, { fontFamily: extra, textAlign }]}>{title}</Text>
          <Text style={[styles.message, { fontFamily: medium, textAlign }]}>{message}</Text>

          <View style={styles.actions}>
            <Pressable
              onPress={onCancel}
              disabled={loading}
              style={({ pressed }) => [styles.cancelBtn, pressed && { opacity: 0.85 }]}
            >
              <Text style={[styles.cancelTxt, { fontFamily: medium }]}>{resolvedCancel}</Text>
            </Pressable>

            <Pressable
              onPress={onConfirm}
              disabled={loading}
              style={({ pressed }) => [
                styles.confirmBtn,
                destructive && styles.confirmBtnDanger,
                pressed && { opacity: 0.9 },
              ]}
            >
              {loading ? (
                <ActivityIndicator color="#fff" size="small" />
              ) : (
                <Text style={[styles.confirmTxt, { fontFamily: bold }]}>{confirmLabel}</Text>
              )}
            </Pressable>
          </View>
        </DialogGlass>
      </View>
    </>
  );

  if (embedded) {
    return <View style={[StyleSheet.absoluteFillObject, styles.root, styles.embeddedRoot]}>{content}</View>;
  }

  return (
    <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={onCancel}>
      <View style={styles.root}>{content}</View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'center', padding: 24 },
  embeddedRoot: { justifyContent: 'center', alignItems: 'stretch', zIndex: 3000, elevation: 3000 },
  center: { zIndex: 2 },
  card: {
    borderRadius: PG_RADII.xl,
    borderWidth: 1,
    borderColor: PG.heroGlassBorder,
    overflow: 'hidden',
    padding: PG_SPACING.lg,
    backgroundColor: Platform.OS === 'android' ? PG.card : undefined,
  },
  tint: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(3,3,3,0.55)',
  },
  iconWrap: {
    alignSelf: 'center',
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(168,85,247,0.18)',
    borderWidth: 1,
    borderColor: PG.border,
    marginBottom: PG_SPACING.md,
  },
  iconWrapDanger: {
    backgroundColor: 'rgba(248,113,113,0.12)',
    borderColor: 'rgba(248,113,113,0.35)',
  },
  title: {
    color: PG.text,
    fontSize: PG_TYPE.title,
    marginBottom: 8,
  },
  message: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.body,
    lineHeight: 22,
    marginBottom: PG_SPACING.lg,
  },
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  cancelBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.glassStrong,
    borderWidth: 1,
    borderColor: PG.borderSoft,
  },
  cancelTxt: {
    color: PG.textSecondary,
    fontSize: PG_TYPE.body,
  },
  confirmBtn: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.primary,
  },
  confirmBtnDanger: {
    backgroundColor: 'rgba(220,38,38,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(248,113,113,0.45)',
  },
  confirmTxt: {
    color: '#FFFFFF',
    fontSize: PG_TYPE.body,
  },
});
