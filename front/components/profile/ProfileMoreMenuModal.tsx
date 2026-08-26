import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';
import { ProfileTheme } from '../../constants/ProfileTheme';

export function ProfileMoreMenuModal({
  visible,
  onClose,
  onShareQR,
  onDeleteAccount,
}: {
  visible: boolean;
  onClose: () => void;
  onShareQR: () => void;
  onDeleteAccount: () => void;
}) {
  const { t } = useTranslation();
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
          <View style={styles.handle} />
          <Text style={styles.title}>{t.profile.moreOptions}</Text>

          <Pressable
            style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            onPress={() => runAction(onShareQR)}
            accessibilityRole="button"
          >
            <View style={styles.optionIconWrap}>
              <Ionicons name="qr-code-outline" size={22} color="#D8AEFF" />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={styles.optionLabel}>{t.profile.shareQRCode}</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color="#8C8C8C" />
          </Pressable>

          <Pressable
            style={({ pressed }) => [styles.option, styles.optionDestructive, pressed && styles.optionPressed]}
            onPress={() => runAction(onDeleteAccount)}
            accessibilityRole="button"
          >
            <View style={[styles.optionIconWrap, styles.optionIconDestructive]}>
              <Ionicons name="trash-outline" size={22} color="#FF453A" />
            </View>
            <View style={styles.optionTextWrap}>
              <Text style={[styles.optionLabel, styles.optionLabelDestructive]}>
                {t.profile.deleteAccount}
              </Text>
              <Text style={styles.optionSub}>{t.profile.deleteAccountDesc}</Text>
            </View>
            <Ionicons name="chevron-back" size={18} color="#8C8C8C" />
          </Pressable>

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
    backgroundColor: '#07040D',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingTop: 10,
    paddingHorizontal: 20,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: ProfileTheme.colors.profileCardBorder,
    direction: 'rtl',
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
    fontWeight: '600',
    textAlign: 'right',
    marginBottom: 16,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(44,39,55,0.35)',
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    marginBottom: 10,
  },
  optionDestructive: {
    backgroundColor: 'rgba(255,69,58,0.08)',
    borderColor: 'rgba(255,69,58,0.22)',
  },
  optionPressed: {
    opacity: 0.88,
  },
  optionIconWrap: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: 'rgba(126,21,226,0.18)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionIconDestructive: {
    backgroundColor: 'rgba(255,69,58,0.12)',
  },
  optionTextWrap: {
    flex: 1,
    alignItems: 'stretch',
  },
  optionLabel: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'right',
  },
  optionLabelDestructive: {
    color: '#FF453A',
  },
  optionSub: {
    color: '#8C8C8C',
    fontSize: 12,
    marginTop: 4,
    textAlign: 'right',
  },
  cancelBtn: {
    marginTop: 6,
    paddingVertical: 16,
    alignItems: 'center',
  },
  cancelLabel: {
    color: '#8C8C8C',
    fontSize: 16,
    fontWeight: '500',
  },
});
