import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Mail, Lock, Apple, ShieldCheck, X } from 'lucide-react-native';
import { AuthScreenShell, AuthTextField, AUTH_ACCENT, OtpInput } from '@/src/components/auth';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
import {
  attemptSignInSecondFactor,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
  prepareSignInSecondFactor,
  resolveSecondFactor,
  signInNeedsVerification,
  type SecondFactorKind,
} from '@/src/components/auth/clerkSignInFlow';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_SECONDARY,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
} from '@/constants/tokens';
import { useSignIn } from '@clerk/clerk-expo';
import { useTranslation } from '@/src/i18n';

const OTP_LENGTH = 6;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { t } = useTranslation();
  const tCommon = t.common;

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(null);

  const [showVerification, setShowVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [secondFactorKind, setSecondFactorKind] = useState<SecondFactorKind>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const { startGoogle, startApple } = useOAuthFlow({
    onError: () => setOauthLoading(null),
  });

  const startResendCooldown = () => {
    setResendCooldown(60);
    const interval = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishSignIn = async (sessionId: string) => {
    await setActive({ session: sessionId });
    router.replace('/(tabs)/Home');
  };

  const openVerificationStep = async (
    factor: ReturnType<typeof resolveSecondFactor>,
  ): Promise<boolean> => {
    if (!signIn || !factor.kind) {
      Alert.alert(tCommon.error, tCommon.loginMfaNoMethods);
      return false;
    }

    setSecondFactorKind(factor.kind);
    setOtp('');

    if (factor.kind === 'email_code' || factor.kind === 'phone_code') {
      try {
        await prepareSignInSecondFactor(signIn, factor);
        if (factor.kind === 'email_code') {
          Alert.alert(tCommon.success, tCommon.loginMfaEmailSent);
        } else {
          Alert.alert(tCommon.success, tCommon.loginMfaSmsSent);
        }
        startResendCooldown();
      } catch (err: unknown) {
        const e = err as { errors?: Array<{ longMessage?: string }>; message?: string };
        const msg = e?.errors?.[0]?.longMessage || e?.message || tCommon.operationFailed;
        Alert.alert(tCommon.error, msg);
        return false;
      }
    }

    setShowVerification(true);
    return true;
  };

  const handleGooglePress = async (): Promise<void> => {
    if (oauthLoading) return;
    setOauthLoading('google');
    try {
      await startGoogle();
    } finally {
      setOauthLoading(null);
    }
  };

  const handleApplePress = async (): Promise<void> => {
    if (oauthLoading) return;
    setOauthLoading('apple');
    try {
      await startApple();
    } finally {
      setOauthLoading(null);
    }
  };

  const submit = async () => {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail.includes('@') || password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        tCommon.alert,
        tCommon.loginCouldNotComplete,
      );
      return;
    }
    if (!isLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.create({
        identifier: normalizedEmail,
        password,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await finishSignIn(result.createdSessionId);
        return;
      }

      if (signInNeedsVerification(result.status)) {
        const factor = resolveSecondFactor(result);
        await openVerificationStep(factor);
        return;
      }

      if (result.status === 'needs_first_factor') {
        Alert.alert(tCommon.error, tCommon.loginNeedsFirstFactor);
        return;
      }

      Alert.alert(tCommon.error, tCommon.loginCouldNotComplete);
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string }>; message?: string };
      const msg = e?.errors?.[0]?.longMessage || e?.message || tCommon.loginCouldNotComplete;
      Alert.alert(tCommon.loginError, msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert(tCommon.alert, tCommon.loginMfaCodePlaceholder);
      return;
    }
    if (!isLoaded || !signIn || !secondFactorKind) return;

    setIsVerifying(true);
    try {
      const result = await attemptSignInSecondFactor(signIn, secondFactorKind, otp);

      if (result.status === 'complete' && result.createdSessionId) {
        setShowVerification(false);
        await finishSignIn(result.createdSessionId);
      } else {
        Alert.alert(tCommon.error, tCommon.loginCouldNotComplete);
      }
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string }>; message?: string };
      const msg = e?.errors?.[0]?.longMessage || e?.message || tCommon.operationFailed;
      Alert.alert(tCommon.loginError, msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !signIn || !secondFactorKind) return;
    if (secondFactorKind !== 'email_code' && secondFactorKind !== 'phone_code') return;

    try {
      const factor = resolveSecondFactor(signIn);
      await prepareSignInSecondFactor(signIn, factor);
      startResendCooldown();
      Alert.alert(
        tCommon.success,
        secondFactorKind === 'email_code'
          ? tCommon.loginMfaEmailSent
          : tCommon.loginMfaSmsSent,
      );
    } catch {
      Alert.alert(tCommon.error, tCommon.operationFailed);
    }
  };

  const verificationHint =
    secondFactorKind === 'totp'
      ? tCommon.loginMfaTotpHint
      : secondFactorKind === 'backup_code'
        ? tCommon.loginMfaBackupHint
        : secondFactorKind === 'phone_code'
          ? tCommon.loginMfaSmsHint
          : tCommon.loginMfaEmailHint;

  return (
    <AuthScreenShell heroMode="compact" panelOffset={60}>
      <Text style={styles.subMuted}>Sign in to keep your picks, alerts, and AI history in sync.</Text>

      <AuthTextField
        icon={Mail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        containerStyle={styles.mt}
      />
      <AuthTextField
        icon={Lock}
        placeholder="Password"
        secureToggle
        value={password}
        onChangeText={setPassword}
        containerStyle={styles.gap}
      />

      <Pressable hitSlop={8} style={styles.forgot} onPress={() => router.push('/auth/forgot-password')}>
        <Text style={styles.forgotTxt}>Forgot password?</Text>
      </Pressable>

      <TouchableOpacity
        style={[styles.primaryWrap, isSubmitting && { opacity: 0.6 }]}
        activeOpacity={0.92}
        onPress={submit}
        disabled={isSubmitting}
      >
        <LinearGradient
          colors={[AUTH_ACCENT, '#5b21b6']}
          style={styles.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.primaryTxt}>
            {isSubmitting ? tCommon.loggingIn : 'Login'}
          </Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.divWrap}>
        <View style={styles.divLine} />
        <Text style={styles.divTxt}>or continue with</Text>
        <View style={styles.divLine} />
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.social, oauthLoading && { opacity: 0.6 }]}
          onPress={handleGooglePress}
          disabled={!!oauthLoading}
        >
          {oauthLoading === 'google' ? (
            <ActivityIndicator color={TEXT_PRIMARY} size="small" />
          ) : (
            <>
              <Text style={styles.googleG}>G</Text>
              <Text style={styles.socialTxt}>Google</Text>
            </>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          activeOpacity={0.9}
          style={[styles.social, oauthLoading && { opacity: 0.6 }]}
          onPress={handleApplePress}
          disabled={!!oauthLoading}
        >
          {oauthLoading === 'apple' ? (
            <ActivityIndicator color={TEXT_PRIMARY} size="small" />
          ) : (
            <>
              <Apple color={TEXT_PRIMARY} size={20} />
              <Text style={styles.socialTxt}>Apple</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Pressable style={styles.footer} onPress={() => router.replace('/auth')}>
        <Text style={styles.footerMuted}>
          Don&apos;t have an account? <Text style={styles.linkBold}>Sign up</Text>
        </Text>
      </Pressable>

      <Modal visible={showVerification} transparent animationType="fade" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.modalOverlay}
          enabled={Platform.OS === 'ios'}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowVerification(false)}
                activeOpacity={0.7}
              >
                <X size={20} color={TEXT_MUTED} strokeWidth={2} />
              </TouchableOpacity>

              <View style={styles.modalIconWrap}>
                <LinearGradient
                  colors={[PURPLE_PRIMARY, '#5b21b6']}
                  style={styles.modalIcon}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                >
                  <ShieldCheck size={28} color="#fff" strokeWidth={2} />
                </LinearGradient>
              </View>

              <Text style={styles.modalTitle}>{tCommon.loginMfaTitle}</Text>
              <Text style={styles.modalSubtitle}>{verificationHint}</Text>

              <OtpInput
                value={otp}
                onChange={setOtp}
                autoFocus
                containerStyle={styles.otpWrap}
              />

              <TouchableOpacity
                activeOpacity={0.92}
                onPress={handleVerify}
                disabled={isVerifying || otp.length !== OTP_LENGTH}
                style={[styles.verifyWrap, otp.length !== OTP_LENGTH && { opacity: 0.5 }]}
              >
                <LinearGradient
                  colors={[PURPLE_PRIMARY, '#5b21b6']}
                  style={styles.verifyBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  {isVerifying ? (
                    <ActivityIndicator color="#fff" size="small" />
                  ) : (
                    <Text style={styles.verifyTxt}>{tCommon.confirm}</Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>

              {(secondFactorKind === 'email_code' || secondFactorKind === 'phone_code') && (
                <TouchableOpacity
                  onPress={handleResend}
                  disabled={resendCooldown > 0}
                  activeOpacity={0.7}
                  style={styles.resendRow}
                >
                  <Text style={styles.resendTxt}>
                    {resendCooldown > 0
                      ? `${tCommon.loginMfaResendSms} (${resendCooldown}s)`
                      : tCommon.loginMfaResendSms}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  subMuted: { marginTop: 9, marginBottom: 20, fontSize: 14, color: TEXT_SECONDARY, lineHeight: 20, textAlign: 'left' },
  mt: { marginTop: 4 },
  gap: { marginTop: 12 },
  forgot: { alignSelf: 'flex-end', marginTop: 10 },
  forgotTxt: { fontSize: 13, fontWeight: '700', color: AUTH_ACCENT },
  primaryWrap: { marginTop: 22, borderRadius: 14, overflow: 'hidden' },
  primary: { paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  divWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  divTxt: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },
  socialRow: { flexDirection: 'row', gap: 10 },
  social: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderRadius: 14, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  socialTxt: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  footer: { marginTop: 20, alignItems: 'center', paddingBottom: 16 },
  footerMuted: { fontSize: 14, color: TEXT_MUTED },
  linkBold: { color: AUTH_ACCENT, fontWeight: '800' },
  modalOverlay: { flex: 1 },
  modalBackdrop: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    minHeight: 420,
    backgroundColor: 'rgba(12,8,20,0.97)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
  },
  modalClose: {
    position: 'absolute',
    top: 14,
    right: 14,
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalIconWrap: { marginBottom: 18 },
  modalIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 8,
    textAlign: 'center',
  },
  modalSubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  otpWrap: { marginBottom: 24, justifyContent: 'center' },
  verifyWrap: { width: '100%', borderRadius: 14, overflow: 'hidden', marginBottom: 12 },
  verifyBtn: { paddingVertical: 16, alignItems: 'center' },
  verifyTxt: { fontSize: 16, fontWeight: '800', color: TEXT_PRIMARY },
  resendRow: { paddingVertical: 6 },
  resendTxt: { fontSize: 13, color: PURPLE_SOFT, fontWeight: '600' },
});
