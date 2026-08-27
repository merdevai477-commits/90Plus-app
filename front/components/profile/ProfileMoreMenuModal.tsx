import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  TextInput,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Alert,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  Easing,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n';
import { runSafeModalClose } from '../../utils/safeModalClose';
import { ProfileTheme } from '../../constants/ProfileTheme';
import {
  GlassWrapper,
  glassProps,
  ACCENT,
  ACCENT_DARK,
  SURFACE_BG,
  AppGradients,
} from '../../constants/ui';

type CooldownInfo = {
  canChange: boolean;
  daysRemaining?: number;
  hoursRemaining?: number;
};

interface ProfileMoreMenuModalProps {
  visible: boolean;
  onClose: () => void;
  onShareQR: () => void;
  onDeleteAccount: () => void;
  displayName: string;
  username: string;
  avatarUri?: string | null;
  userId?: string | null;
  usernameCooldown?: CooldownInfo | null;
  onSaveIdentity?: (data: {
    displayName: string;
    username: string;
  }) => Promise<void> | void;
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
            style={[
              styles.optionLabel,
              destructive && styles.optionLabelDestructive,
              isRTL && styles.textRtl,
            ]}
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
  usernameCooldown,
  onSaveIdentity,
}: ProfileMoreMenuModalProps) {
  const { t, isRTL } = useTranslation();
  const insets = useSafeAreaInsets();
  const prevUserIdRef = useRef(userId);

  const [editing, setEditing] = useState(false);
  const [draftName, setDraftName] = useState(displayName);
  const [draftUsername, setDraftUsername] = useState(username.replace(/^@/, ''));
  const [nameError, setNameError] = useState('');
  const [usernameError, setUsernameError] = useState('');
  const [saving, setSaving] = useState(false);
  const [focusedField, setFocusedField] = useState<'name' | 'username' | null>(null);

  const drawerProgress = useSharedValue(0);

  const canEditUsername = usernameCooldown ? usernameCooldown.canChange : true;
  const daysRemaining = usernameCooldown?.daysRemaining ?? 0;
  const hoursRemaining = usernameCooldown?.hoursRemaining ?? 0;

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

  const resetDraft = useCallback(() => {
    setDraftName(displayName);
    setDraftUsername((username || 'user').replace(/^@/, ''));
    setNameError('');
    setUsernameError('');
    setFocusedField(null);
    setEditing(false);
    drawerProgress.value = 0;
  }, [displayName, username, drawerProgress]);

  useEffect(() => {
    if (visible) {
      resetDraft();
    }
    // Reset only when the sheet opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

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

  // Keep draft in sync when save succeeds and parent props update (drawer closed).
  useEffect(() => {
    if (!editing) {
      setDraftName(displayName);
      setDraftUsername((username || 'user').replace(/^@/, ''));
    }
  }, [displayName, username, editing]);

  const openDrawer = useCallback(() => {
    setDraftName(displayName);
    setDraftUsername((username || 'user').replace(/^@/, ''));
    setNameError('');
    setUsernameError('');
    setEditing(true);
    drawerProgress.value = withTiming(1, {
      duration: 280,
      easing: Easing.out(Easing.cubic),
    });
  }, [displayName, username, drawerProgress]);

  const closeDrawer = useCallback(() => {
    drawerProgress.value = withTiming(0, {
      duration: 220,
      easing: Easing.in(Easing.cubic),
    });
    setTimeout(() => {
      setEditing(false);
      setNameError('');
      setUsernameError('');
      setFocusedField(null);
    }, 200);
  }, [drawerProgress]);

  const validateName = useCallback(
    (text: string): string => {
      if (!text.trim()) return t.profile.nameRequired;
      if (text.length < 2) return t.profile.nameTooShort;
      if (text.length > 30) return t.profile.nameMaxLength;
      return '';
    },
    [t.profile],
  );

  const validateUsername = useCallback(
    (text: string): string => {
      if (!text.trim()) return t.profile.usernameRequired;
      if (text.length < 3) return t.profile.usernameMinLength;
      if (text.length > 20) return t.profile.usernameMaxLength;
      if (!/^[a-zA-Z0-9_]+$/.test(text)) return t.profile.usernamePatternError;
      return '';
    },
    [t.profile],
  );

  const handleSave = useCallback(async () => {
    if (!onSaveIdentity || saving) return;

    const nameErr = validateName(draftName);
    const userErr = validateUsername(draftUsername);
    setNameError(nameErr);
    setUsernameError(userErr);
    if (nameErr) {
      Alert.alert(t.common.error, nameErr);
      return;
    }
    if (userErr) {
      Alert.alert(t.common.error, userErr);
      return;
    }

    const nextName = draftName.trim();
    const nextUsername = draftUsername.trim().toLowerCase();
    const currentUsername = (username || 'user').replace(/^@/, '');
    if (nextUsername !== currentUsername && !canEditUsername) {
      Alert.alert(
        t.common.error,
        `${t.profile.usernameChangeAfter} ${daysRemaining}d ${hoursRemaining}h`,
      );
      return;
    }

    setSaving(true);
    try {
      await onSaveIdentity({
        displayName: nextName,
        username: nextUsername,
      });
      closeDrawer();
    } finally {
      setSaving(false);
    }
  }, [
    onSaveIdentity,
    saving,
    validateName,
    validateUsername,
    draftName,
    draftUsername,
    username,
    canEditUsername,
    daysRemaining,
    hoursRemaining,
    t.common.error,
    t.profile.usernameChangeAfter,
    closeDrawer,
  ]);

  const drawerStyle = useAnimatedStyle(() => ({
    opacity: drawerProgress.value,
    maxHeight: drawerProgress.value * 260,
    marginTop: drawerProgress.value * 10,
    overflow: 'hidden' as const,
  }));

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
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 8 : 0}
        >
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

            <View style={styles.userCard}>
              <View style={[styles.userCardTop, isRTL && styles.userCardTopRtl]}>
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
                  <View style={[styles.handleRow, isRTL && styles.handleRowRtl]}>
                    <Text style={[styles.userHandle, isRTL && styles.textRtl]} numberOfLines={1}>
                      @{safeUsername}
                    </Text>
                    <Pressable
                      onPress={editing ? closeDrawer : openDrawer}
                      hitSlop={10}
                      style={({ pressed }) => [
                        styles.penBtn,
                        editing && styles.penBtnActive,
                        pressed && styles.optionPressed,
                      ]}
                      accessibilityRole="button"
                      accessibilityLabel={t.profile.editProfile}
                    >
                      <Ionicons
                        name={editing ? 'close' : 'pencil'}
                        size={14}
                        color={editing ? '#fff' : ProfileTheme.colors.avatarRing}
                      />
                    </Pressable>
                  </View>
                </View>
              </View>

              <Animated.View style={drawerStyle}>
                {editing ? (
                  <View style={styles.editDrawer}>
                    <Text style={[styles.fieldLabel, isRTL && styles.textRtl]}>
                      {t.profile.nameLabel}
                    </Text>
                    <TextInput
                      value={draftName}
                      onChangeText={(text) => {
                        setDraftName(text);
                        setNameError(validateName(text));
                      }}
                      onFocus={() => setFocusedField('name')}
                      onBlur={() => setFocusedField(null)}
                      placeholder={t.profile.namePlaceholder}
                      placeholderTextColor="rgba(255,255,255,0.35)"
                      style={[
                        styles.input,
                        isRTL && styles.textRtl,
                        focusedField === 'name' && styles.inputFocused,
                        !!nameError && styles.inputError,
                      ]}
                      maxLength={30}
                      autoCorrect={false}
                    />
                    {nameError ? <Text style={styles.errorTxt}>{nameError}</Text> : null}

                    <Text style={[styles.fieldLabel, isRTL && styles.textRtl]}>
                      {t.profile.usernameLabel}
                    </Text>
                    <View
                      style={[
                        styles.usernameWrap,
                        isRTL && styles.usernameWrapRtl,
                        focusedField === 'username' && styles.inputFocused,
                        !!usernameError && styles.inputError,
                        !canEditUsername && styles.inputDisabled,
                      ]}
                    >
                      <Text style={styles.atPrefix}>@</Text>
                      <TextInput
                        value={draftUsername}
                        onChangeText={(text) => {
                          const cleaned = text.replace(/[^a-zA-Z0-9_]/g, '');
                          setDraftUsername(cleaned);
                          setUsernameError(validateUsername(cleaned));
                        }}
                        onFocus={() => setFocusedField('username')}
                        onBlur={() => setFocusedField(null)}
                        placeholder="username"
                        placeholderTextColor="rgba(255,255,255,0.35)"
                        style={[styles.usernameInput, isRTL && styles.textRtl]}
                        maxLength={20}
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={canEditUsername}
                      />
                    </View>
                    {usernameError && canEditUsername ? (
                      <Text style={styles.errorTxt}>{usernameError}</Text>
                    ) : null}
                    {!canEditUsername ? (
                      <Text style={styles.cooldownTxt}>
                        {t.profile.usernameChangeAfter} {daysRemaining}d {hoursRemaining}h
                      </Text>
                    ) : null}

                    <Pressable
                      onPress={handleSave}
                      disabled={saving}
                      style={({ pressed }) => [
                        styles.saveBtnWrap,
                        pressed && styles.optionPressed,
                        saving && { opacity: 0.7 },
                      ]}
                    >
                      <LinearGradient
                        colors={[...AppGradients.purpleCTA]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                        style={styles.saveBtn}
                      >
                        {saving ? (
                          <ActivityIndicator color="#fff" size="small" />
                        ) : (
                          <Text style={styles.saveBtnText}>{t.profile.saveChanges}</Text>
                        )}
                      </LinearGradient>
                    </Pressable>
                  </View>
                ) : null}
              </Animated.View>
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
        </KeyboardAvoidingView>
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
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(139,92,246,0.08)',
    borderWidth: 0.5,
    borderColor: ProfileTheme.colors.profileCardBorder,
    marginBottom: 14,
  },
  userCardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  userCardTopRtl: {
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
  handleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  handleRowRtl: {
    flexDirection: 'row-reverse',
  },
  userHandle: {
    color: ProfileTheme.colors.avatarRing,
    fontSize: 13,
    fontWeight: '500',
    flexShrink: 1,
  },
  penBtn: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  penBtnActive: {
    backgroundColor: 'rgba(139,92,246,0.55)',
    borderColor: ProfileTheme.colors.profilePrimary,
  },
  editDrawer: {
    paddingTop: 4,
    gap: 6,
  },
  fieldLabel: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 12,
    fontWeight: '600',
    marginTop: 6,
  },
  input: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    backgroundColor: 'rgba(8,2,21,0.45)',
    paddingHorizontal: 12,
    color: '#fff',
    fontSize: 14,
  },
  usernameWrap: {
    height: 42,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.25)',
    backgroundColor: 'rgba(8,2,21,0.45)',
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
  },
  usernameWrapRtl: {
    flexDirection: 'row-reverse',
  },
  atPrefix: {
    color: ProfileTheme.colors.avatarRing,
    fontSize: 14,
    fontWeight: '600',
    marginRight: 2,
  },
  usernameInput: {
    flex: 1,
    color: '#fff',
    fontSize: 14,
    padding: 0,
  },
  inputFocused: {
    borderColor: ACCENT,
  },
  inputError: {
    borderColor: '#ef4444',
  },
  inputDisabled: {
    opacity: 0.55,
  },
  errorTxt: {
    color: '#f87171',
    fontSize: 11,
    marginTop: 2,
  },
  cooldownTxt: {
    color: 'rgba(255,255,255,0.45)',
    fontSize: 11,
    marginTop: 2,
  },
  saveBtnWrap: {
    marginTop: 10,
    borderRadius: 12,
    overflow: 'hidden',
  },
  saveBtn: {
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 12,
  },
  saveBtnText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '700',
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
