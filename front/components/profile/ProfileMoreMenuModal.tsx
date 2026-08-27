import React, { useCallback, useEffect, useRef } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { GlassWrapper, glassProps, ACCENT, ACCENT_DARK, SURFACE_BG } from '../../constants/ui';

interface ProfileMoreMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShareQR: () => void;
  onDeleteAccount: () => void;
  displayName: string;
  username: string;
  avatarUri?: string | null;
  userId?: string | null;
}

function MenuOption({
  icon,
  iconColor,
  iconBg,
  label,
  subLabel,
  destructive,
  isRTL,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  iconBg: string;
  label: string;
  subLabel?: string;
  destructive?: boolean;
  isRTL: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.option,
        destructive && styles.optionDestructive,
        pressed && styles.optionPressed,
      ]}
      onPress={onPress}
      accessibilityRole="button"
    >
      <View style={[styles.optionRow, isRTL && styles.optionRowRtl]}>
        <View style={[styles.optionIconWrap, { backgroundColor: iconBg }]}>
          <Ionicons name={icon} size={20} color={iconColor} />
        </View>
        <View style={[styles.optionTextWrap, isRTL && styles.optionTextWrapRtl]}>
          <Text
            style={[styles.optionLabel, destructive && styles.optionLabelDestructive, isRTL && styles.textRtl]}
            numberOfLines={1}
          >
            {label}
          </Text>
          {subLabel ? (
            <Text style={[styles.optionSub, isRTL && styles.textRtl]} numberOfLines={2}>
              {subLabel}
            </Text>
          ) : null}
        </View>
        <Ionicons
          name={isRTL ? 'chevron-back' : 'chevron-forward'}
          size={18}
          color="#8C8C8C"
        />
      </View>
    </Pressable>
  );
}

export function ProfileMoreMenuModal({
  visible,
  onClose,
  onShareQR,
  onDeleteAccount,
  displayName,
  username,
  avatarUri,
  userId,
}: ProfileMoreMenuModalProps) {
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const prevUserIdRef = useRef(userId);

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

  useEffect(() => {
    if (
      visible &&
      prevUserIdRef.current &&
      userId &&
      prevUserIdRef.current !== userId
    ) {
      onClose();
    }
    prevUserIdRef.current = userId;
  }, [userId, visible, onClose]);

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

          <View style={[styles.userCard, isRTL && styles.userCardRtl]}>
            {avatarUri ? (
              <Image source={{ uri: avatarUri }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={22} color={ProfileTheme.colors.avatarRing} />
              </View>
            )}
            <View style={[styles.userTextWrap, isRTL && styles.userTextWrapRtl]}>
              <Text style={[styles.userName, isRTL && styles.textRtl]} numberOfLines={1}>
                {safeName}
              </Text>
              <Text style={[styles.userHandle, isRTL && styles.textRtl]} numberOfLines={1}>
                @{safeUsername}
              </Text>
            </View>
          </View>

          <MenuOption
            icon="qr-code-outline"
            iconColor={ProfileTheme.colors.avatarRing}
            iconBg="rgba(126,21,226,0.18)"
            label={t.profile.shareQRCode}
            isRTL={isRTL}
            onPress={() => runAction(onShareQR)}
          />

          <MenuOption
            icon="trash-outline"
            iconColor="#FF453A"
            iconBg="rgba(255,69,58,0.12)"
            label={t.profile.deleteAccount}
            subLabel={t.profile.deleteAccountDesc}
            destructive
            isRTL={isRTL}
            onPress={() => runAction(onDeleteAccount)}
          />

          <Pressable
            style={({ pressed }) => [styles.cancelBtn, pressed && styles.optionPressed]}
            onPress={safeClose}
            accessibilityRole="button"
          >
            <Text style={styles.cancelLabel}>{t.common.cancel}</Text>
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
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
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
  userCardRtl: {
    flexDirection: 'row-reverse',
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(216,174,255,0.45)',
  },
  avatarFallback: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(44,39,55,0.55)',
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  userTextWrapRtl: {
    alignItems: 'flex-end',
  },
  userName: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  userHandle: {
    color: ProfileTheme.colors.avatarRing,
    fontSize: 13,
    fontWeight: '500',
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
  optionPressed: {
    opacity: 0.88,
  },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  optionRowRtl: {
    flexDirection: 'row-reverse',
  },
  optionIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  optionTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  optionTextWrapRtl: {
    alignItems: 'flex-end',
  },
  optionLabel: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
  },
  optionLabelDestructive: {
    color: '#FF453A',
  },
  optionSub: {
    color: '#8C8C8C',
    fontSize: 12,
    marginTop: 3,
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cancelBtn: {
    marginTop: 4,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelLabel: {
    color: '#8C8C8C',
    fontSize: 16,
    fontWeight: '500',
  },
});
