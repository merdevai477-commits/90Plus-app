import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { GlassWrapper, glassProps, ACCENT, ACCENT_DARK, SURFACE_BG } from '../../constants/ui';

interface ProfilePublicMoreModalProps {
  visible: boolean;
  onClose: () => void;
  displayName: string;
  username: string;
  avatarUri?: string | null;
  isBlocked?: boolean;
  onReport: () => void;
  onBlock: () => void;
}

export function ProfilePublicMoreModal({
  visible,
  onClose,
  displayName,
  username,
  avatarUri,
  isBlocked = false,
  onReport,
  onBlock,
}: ProfilePublicMoreModalProps) {
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();

  const safeClose = useCallback(() => {
    runSafeModalClose(onClose);
  }, [onClose]);

  const runAction = useCallback(
    (action: () => void) => {
      safeClose();
      setTimeout(action, 180);
    },
    [safeClose],
  );

  if (!visible) return null;

  const safeName = displayName?.trim() || username || 'User';
  const safeUsername = (username || 'user').replace(/^@/, '');

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      presentationStyle="overFullScreen"
      statusBarTranslucent
      onRequestClose={safeClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={safeClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 16) + 8 }]}>
          <GlassWrapper {...(glassProps.modal as any)} style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={[ACCENT, ACCENT_DARK, 'transparent']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.topAccent}
          />

          <View style={styles.handle} />
          <Text style={[styles.title, isRTL && styles.textRtl]}>{t.profile.moreOptions}</Text>

          <View style={[styles.userCard, isRTL && styles.rowRtl]}>
            <View style={styles.avatarFallback}>
              <Ionicons name="person" size={20} color={ProfileTheme.colors.avatarRing} />
            </View>
            <View style={[styles.userTextWrap, isRTL && styles.alignEnd]}>
              <Text style={[styles.userName, isRTL && styles.textRtl]} numberOfLines={1}>
                {safeName}
              </Text>
              <Text style={[styles.userHandle, isRTL && styles.textRtl]} numberOfLines={1}>
                @{safeUsername}
              </Text>
            </View>
          </View>

          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.pressed]}
            onPress={() => runAction(onReport)}
          >
            <View style={[styles.optionRow, isRTL && styles.rowRtl]}>
              <View style={[styles.iconWrap, styles.iconWarn]}>
                <Ionicons name="flag-outline" size={18} color="#FBBF24" />
              </View>
              <Text style={[styles.optionLabel, isRTL && styles.textRtl, { flex: 1 }]}>
                {t.publicProfile.report}
              </Text>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color="#8C8C8C"
              />
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.option,
              styles.optionDestructive,
              pressed && styles.pressed,
            ]}
            onPress={() => runAction(onBlock)}
          >
            <View style={[styles.optionRow, isRTL && styles.rowRtl]}>
              <View style={[styles.iconWrap, styles.iconDanger]}>
                <Ionicons
                  name={isBlocked ? 'checkmark-circle-outline' : 'ban-outline'}
                  size={18}
                  color={isBlocked ? ACCENT : '#FF453A'}
                />
              </View>
              <Text
                style={[
                  styles.optionLabel,
                  isBlocked ? styles.optionAccent : styles.optionDanger,
                  isRTL && styles.textRtl,
                  { flex: 1 },
                ]}
              >
                {isBlocked ? t.publicProfile.unblock : t.publicProfile.block}
              </Text>
              <Ionicons
                name={isRTL ? 'chevron-back' : 'chevron-forward'}
                size={18}
                color="#8C8C8C"
              />
            </View>
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.pressed]}
            onPress={safeClose}
          >
            <Text style={styles.cancelLabel}>{t.publicProfile.cancel}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.72)',
  },
  sheet: {
    backgroundColor: SURFACE_BG,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: 'rgba(168,85,247,0.2)',
    overflow: 'hidden',
  },
  topAccent: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 2,
  },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.18)',
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 14,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    marginBottom: 14,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  alignEnd: { alignItems: 'flex-end' },
  avatarFallback: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(44,39,55,0.55)',
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTextWrap: { flex: 1, minWidth: 0 },
  userName: { color: '#fff', fontSize: 15, fontWeight: '700' },
  userHandle: {
    color: ProfileTheme.colors.avatarRing,
    fontSize: 12,
    marginTop: 2,
  },
  option: {
    borderRadius: 16,
    backgroundColor: 'rgba(44,39,55,0.35)',
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    marginBottom: 10,
    overflow: 'hidden',
  },
  optionDestructive: {
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderColor: 'rgba(255,69,58,0.22)',
  },
  pressed: { opacity: 0.88 },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconWarn: { backgroundColor: 'rgba(251,191,36,0.12)' },
  iconDanger: { backgroundColor: 'rgba(255,69,58,0.12)' },
  optionLabel: { color: '#fff', fontSize: 15, fontWeight: '600' },
  optionDanger: { color: '#FF453A' },
  optionAccent: { color: ACCENT },
  textRtl: { textAlign: 'right', writingDirection: 'rtl' },
  cancelBtn: { marginTop: 4, paddingVertical: 14, alignItems: 'center' },
  cancelLabel: { color: '#8C8C8C', fontSize: 16, fontWeight: '500' },
});
