import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { Mail, Lock, ShieldCheck, X } from 'lucide-react-native';
import {
  AuthScreenShell,
  AuthTextField,
  AuthPanelHeader,
  AuthPrimaryButton,
  AuthDivider,
  AuthSocialButtons,
  AuthFooterLink,
  AuthTermsConsent,
  OtpInput,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
} from '@/src/components/auth';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
import {
  attemptSignInSecondFactor,
  prepareSignInSecondFactor,
  resolveSecondFactor,
  signInNeedsVerification,
  type SecondFactorKind,
} from '@/src/components/auth/clerkSignInFlow';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
} from '@/constants/tokens';
import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { useTranslation } from '@/src/i18n';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';

const OTP_LENGTH = 6;

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { getToken } = useAuth();
  const { t, isRTL } = useTranslation();
  const tCommon = t.common;

  const [terms, setTerms] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(null);

  const [showVerification, setShowVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [secondFactorKind, setSecondFactorKind] = useState<SecondFactorKind>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const completingAuthRef = useRef(false);

  const copy = {
    title: isRTL ? 'تسجيل الدخول' : 'Log in',
    subtitle: isRTL ? 'مرحبا بعودتك' : 'Welcome back',
    email: isRTL ? 'البريد الإلكتروني' : 'Email',
    password: isRTL ? 'كلمة المرور' : 'Password',
    submit: isRTL ? 'تسجيل الدخول' : 'Log in',
    divider: isRTL ? 'أو المتابعة باستخدام' : 'Or continue with',
    footerMuted: isRTL ? 'ليس لديك حساب؟' : "Don't have an account?",
    footerLink: isRTL ? 'إنشاء حساب' : 'Sign up',
  };

  const toggleTerms = useCallback(() => setTerms((v) => !v), []);

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
    };
  }, []);

  const { startGoogle, startApple } = useOAuthFlow({
    onError: () => setOauthLoading(null),
    legalAccepted: terms,
  });

  const requireTerms = (): boolean => {
    if (!terms) {
      Alert.alert('Notice', tCommon.registerMustAgree);
      return false;
    }
    return true;
  };

  const startResendCooldown = () => {
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
    }
    setResendCooldown(60);
    resendIntervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          if (resendIntervalRef.current) {
            clearInterval(resendIntervalRef.current);
            resendIntervalRef.current = null;
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const finishSignIn = async (sessionId: string) => {
    if (completingAuthRef.current || isSubmitting) return;
    completingAuthRef.current = true;
    setIsSubmitting(true);
    try {
      await setActive({ session: sessionId });
      await navigateAfterAuth(router, getToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : tCommon.loginCouldNotComplete;
      Alert.alert(tCommon.loginError, msg);
    } finally {
      completingAuthRef.current = false;
      setIsSubmitting(false);
    }
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
    if (!requireTerms()) return;
    setOauthLoading('google');
    try {
      await startGoogle();
    } finally {
      setOauthLoading(null);
    }
  };

  const handleApplePress = async (): Promise<void> => {
    if (oauthLoading) return;
    if (!requireTerms()) return;
    setOauthLoading('apple');
    try {
      await startApple();
    } finally {
      setOauthLoading(null);
    }
  };

  const submit = async () => {
    if (!requireTerms()) return;
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail.includes('@') || password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(tCommon.alert, tCommon.loginCouldNotComplete);
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
        const factor = resolveSecondFactor(signIn);
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
    <AuthScreenShell>
      <AuthPanelHeader title={copy.title} subtitle={copy.subtitle} />

      <View style={styles.fields}>
        <AuthTextField
          icon={Mail}
          placeholder={copy.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          value={email}
          onChangeText={setEmail}
          isRTL={isRTL}
        />
        <AuthTextField
          icon={Lock}
          placeholder={copy.password}
          secureToggle
          value={password}
          onChangeText={setPassword}
          isRTL={isRTL}
          containerStyle={styles.fieldGap}
        />
      </View>

      <AuthTermsConsent
        checked={terms}
        onToggle={toggleTerms}
        isRTL={isRTL}
        tCommon={tCommon}
      />

      <AuthPrimaryButton
        label={copy.submit}
        loadingLabel={tCommon.loggingIn}
        loading={isSubmitting}
        onPress={submit}
        style={styles.submitGap}
      />

      <AuthDivider label={copy.divider} />

      <AuthSocialButtons
        onGoogle={handleGooglePress}
        onApple={handleApplePress}
        loading={!!oauthLoading}
        googleLoading={oauthLoading === 'google'}
        appleLoading={oauthLoading === 'apple'}
      />

      <AuthFooterLink
        muted={copy.footerMuted}
        link={copy.footerLink}
        onPress={() => router.replace('/auth')}
        isRTL={isRTL}
      />

      <Modal visible={showVerification} transparent animationType="fade" statusBarTranslucent>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          keyboardVerticalOffset={Platform.OS === 'ios' ? 24 : 0}
          style={styles.modalOverlay}
          enabled
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => {
                  setShowVerification(false);
                  setOtp('');
                  setSecondFactorKind(null);
                }}
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
  fields: { gap: 16, width: '100%' },
  fieldGap: { marginTop: 0 },
  submitGap: { marginTop: 42 },
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
