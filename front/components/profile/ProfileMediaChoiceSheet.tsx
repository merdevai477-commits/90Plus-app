import React, { useCallback } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';

export interface ProfileMediaChoiceSheetProps {
  visible: boolean;
  title: string;
  subtitle?: string;
  onView: () => void;
  onChange: () => void;
  onClose: () => void;
}

/**
 * Purple glass sheet replacing native Alert for avatar actions.
 */
export function ProfileMediaChoiceSheet({
  visible,
  title,
  subtitle,
  onView,
  onChange,
  onClose,
}: ProfileMediaChoiceSheetProps) {
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();

  const run = useCallback(
    (action: () => void) => {
      onClose();
      setTimeout(action, 160);
    },
    [onClose],
  );

  if (!visible) return null;

  return (
    <Modal
      visible
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 14) + 6 }]}>
          <LinearGradient
            colors={['#1A0B33', '#0B0614', '#050308']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />
          <Text style={[styles.title, isRTL && styles.rtl]}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subtitle, isRTL && styles.rtl]}>{subtitle}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.option, isRTL && styles.rowRtl]}
            onPress={() => run(onView)}
            activeOpacity={0.8}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="eye-outline" size={20} color={ProfileTheme.colors.avatarRing} />
            </View>
            <Text style={styles.optionText}>{t.profile.viewImage}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.option, isRTL && styles.rowRtl]}
            onPress={() => run(onChange)}
            activeOpacity={0.8}
          >
            <View style={styles.iconWrap}>
              <Ionicons name="image-outline" size={20} color={ProfileTheme.colors.avatarRing} />
            </View>
            <Text style={styles.optionText}>{t.profile.changeImage}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.cancelBtn} onPress={onClose} activeOpacity={0.8}>
            <Text style={styles.cancelText}>{t.profile.cancel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  sheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.32)',
    paddingHorizontal: 16,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(216,174,255,0.35)',
    marginBottom: 14,
  },
  title: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '800',
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 13,
    textAlign: 'center',
    marginBottom: 14,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    paddingHorizontal: 10,
    borderRadius: 14,
    backgroundColor: 'rgba(14,7,28,0.85)',
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
    marginBottom: 8,
  },
  rowRtl: { flexDirection: 'row-reverse' },
  rtl: { textAlign: 'right', writingDirection: 'rtl' },
  iconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(139,92,246,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  cancelBtn: {
    marginTop: 4,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  cancelText: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 15,
    fontWeight: '600',
  },
});

export default ProfileMediaChoiceSheet;
