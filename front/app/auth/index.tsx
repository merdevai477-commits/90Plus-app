import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { ShieldCheck, X } from 'lucide-react-native';
import { AUTH_V2_ASSETS } from '@/src/components/auth/authV2Assets';
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
  type OtpInputHandle,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
} from '@/src/components/auth';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
} from '@/constants/tokens';
import { useAuth, useSignUp } from '@clerk/clerk-expo';
import { useTranslation } from '@/src/i18n';
import { confirmMinimumAgeWithBackend } from '@/hooks/useAgeVerification';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';
import { waitForClerkToken } from '@/src/utils/authSession';
import { completeOAuthMissingRequirements } from '@/src/utils/oauthSignUpCompletion';

const OTP_LENGTH = 6;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const { getToken } = useAuth();
  const { t, isRTL } = useTranslation();
  const tCommon = t.common;
  const [terms, setTerms] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(null);
  const completingAuthRef = useRef(false);

  const copy = {
    title: isRTL ? 'إنشاء حساب' : 'Create account',
    subtitle: isRTL ? 'مرحبا بك' : 'Welcome',
    fullName: isRTL ? 'الاسم كامل' : 'Full name',
    email: isRTL ? 'البريد الإلكتروني' : 'Email',
    password: isRTL ? 'كلمة المرور' : 'Password',
    submit: isRTL ? 'إنشاء حساب' : 'Sign up',
    submitting: isRTL ? 'جاري الإنشاء...' : 'Creating...',
    divider: isRTL ? 'أو المتابعة باستخدام' : 'Or continue with',
    footerMuted: isRTL ? 'لديك حساب بالفعل؟' : "Already have an account?",
    footerLink: isRTL ? 'تسجيل الدخول' : 'Log in',
  };

  const recordSignupAgeAttestation = async (): Promise<void> => {
    const token = await waitForClerkToken(getToken);
    if (!token) {
      throw new Error('Session not ready. Please try again.');
    }
    const result = await confirmMinimumAgeWithBackend(token);
    if (result.ok === false) {
      throw new Error(result.message ?? 'Failed to record age confirmation');
    }
  };

  const { startGoogle, startApple } = useOAuthFlow({
    onError: () => setOauthLoading(null),
    beforeNavigate: recordSignupAgeAttestation,
    legalAccepted: terms,
    onEmailVerificationNeeded: () => {
      if (signUp?.emailAddress) {
        setEmail(signUp.emailAddress);
      }
      setShowVerification(true);
    },
  });

  const requireTermsForOAuth = (): boolean => {
    if (!terms) {
      Alert.alert('Notice', tCommon.registerMustAgree);
      return false;
    }
    return true;
  };

  const handleGooglePress = async (): Promise<void> => {
    if (oauthLoading) return;
    if (!requireTermsForOAuth()) return;
    setOauthLoading('google');
    try {
      await startGoogle();
    } finally {
      setOauthLoading(null);
    }
  };

  const handleApplePress = async (): Promise<void> => {
    if (oauthLoading) return;
    if (!requireTermsForOAuth()) return;
    setOauthLoading('apple');
    try {
      await startApple();
    } finally {
      setOauthLoading(null);
    }
  };

  const [showVerification, setShowVerification] = useState(false);
  const toggleTerms = useCallback(() => setTerms((v) => !v), []);

  const completeAuth = async (sessionId: string) => {
    if (completingAuthRef.current || isSubmitting) return;
    completingAuthRef.current = true;
    setIsSubmitting(true);
    try {
      await setActive({ session: sessionId });
      await recordSignupAgeAttestation();
      await navigateAfterAuth(router, getToken);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Could not complete sign up';
      Alert.alert('Error', msg);
    } finally {
      completingAuthRef.current = false;
      setIsSubmitting(false);
    }
  };

  const submit = async () => {
    if (isSubmitting || !isLoaded) return;
    if (!terms) {
      Alert.alert('Notice', tCommon.registerMustAgree);
      return;
    }
    const normalizedEmail = normalizeAuthEmail(email);
    if (!name.trim() || !normalizedEmail.includes('@') || password.length < MIN_PASSWORD_LENGTH) {
      Alert.alert(
        'Notice',
        `Fill all fields (password at least ${MIN_PASSWORD_LENGTH} characters).`,
      );
      return;
    }
    if (!isLoaded) {
      Alert.alert('Notice', 'Please wait while we connect…');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await signUp.create({
        emailAddress: normalizedEmail,
        password,
        firstName: name.trim().split(' ')[0],
        lastName: name.trim().split(' ').slice(1).join(' ') || undefined,
        legalAccepted: true,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await completeAuth(result.createdSessionId);
      } else if (
        result.status === 'missing_requirements' ||
        (signUp.unverifiedFields?.includes('email_address') ?? false)
      ) {
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setShowVerification(true);
      } else {
        Alert.alert(
          'Error',
          'We could not finish registration. Check your details or try signing in.',
        );
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell showHeroOverlay={false}>
      <AuthPanelHeader title={copy.title} subtitle={copy.subtitle} />

      <View style={styles.formBlock}>
        <View style={styles.fields}>
          <AuthTextField
            iconSource={AUTH_V2_ASSETS.iconUser}
            placeholder={copy.fullName}
            value={name}
            onChangeText={setName}
            autoCapitalize="words"
            autoCorrect={false}
            isRTL={isRTL}
            filled
          />
          <AuthTextField
            iconSource={AUTH_V2_ASSETS.iconEmail}
            placeholder={copy.email}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            isRTL={isRTL}
          />
          <AuthTextField
            iconSource={AUTH_V2_ASSETS.iconLock}
            placeholder={copy.password}
            secureTextEntry
            secureToggle
            value={password}
            onChangeText={setPassword}
            isRTL={isRTL}
          />
        </View>

        {!showVerification && (
          <AuthTermsConsent
            checked={terms}
            onToggle={toggleTerms}
            isRTL={isRTL}
            tCommon={tCommon}
          />
        )}
      </View>

      <View style={styles.ctaBlock}>
        <AuthPrimaryButton
          label={copy.submit}
          loadingLabel={copy.submitting}
          loading={isSubmitting}
          onPress={submit}
        />
        <AuthDivider label={copy.divider} />
      </View>

      <View style={styles.bottomBlock}>
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
          onPress={() => router.push('/auth/login')}
          isRTL={isRTL}
        />
      </View>

      <RegisterEmailVerificationModal
        visible={showVerification}
        email={email}
        signUp={signUp}
        legalAccepted={terms}
        onClose={() => setShowVerification(false)}
        onVerified={async (sessionId) => {
          setShowVerification(false);
          await completeAuth(sessionId);
        }}
      />
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  formBlock: { width: '100%' },
  fields: { gap: 16, width: '100%' },
  ctaBlock: { marginTop: 55, width: '100%' },
  bottomBlock: { marginTop: 42, width: '100%' },
  modalOverlay: { flex: 1 },
  modalBackdrop: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  modalCard: {
    width: '100%',
    maxWidth: 380,
    height: 420,
    backgroundColor: 'rgba(12,8,20,0.97)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.25)',
    paddingHorizontal: 24,
    paddingTop: 36,
    paddingBottom: 28,
    alignItems: 'center',
    overflow: 'hidden',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 40,
    elevation: 24,
  },
  modalGlow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 120,
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
  modalIconWrap: {
    marginBottom: 18,
    borderRadius: 22,
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 16,
    elevation: 10,
  },
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
    letterSpacing: -0.3,
    marginBottom: 8,
  },
  modalSubtitle: {
    fontSize: 14,
    color: TEXT_MUTED,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  modalEmail: {
    color: PURPLE_SOFT,
    fontWeight: '700',
  },
  otpRow: {
    marginBottom: 24,
    justifyContent: 'center',
  },
  verifyWrap: {
    width: '100%',
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 16,
  },
  verifyBtn: {
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  verifyTxt: {
    fontSize: 16,
    fontWeight: '800',
    color: TEXT_PRIMARY,
  },
  resendRow: {
    width: '100%',
    minHeight: 40,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },
  resendTxt: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '600',
    textAlign: 'center',
    lineHeight: 18,
    minWidth: 220,
  },
});

const RegisterEmailVerificationModal = memo(function RegisterEmailVerificationModal({
  visible,
  email,
  signUp,
  legalAccepted,
  onClose,
  onVerified,
}: {
  visible: boolean;
  email: string;
  signUp: ReturnType<typeof useSignUp>['signUp'];
  legalAccepted: boolean;
  onClose: () => void;
  onVerified: (sessionId: string) => Promise<void>;
}) {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const otpInputRef = useRef<OtpInputHandle>(null);
  const didFocusOtpRef = useRef(false);

  const clearResendInterval = useCallback(() => {
    if (resendIntervalRef.current) {
      clearInterval(resendIntervalRef.current);
      resendIntervalRef.current = null;
    }
  }, []);

  const startResendCooldown = useCallback(() => {
    clearResendInterval();
    setResendCooldown(60);
    resendIntervalRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearResendInterval();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [clearResendInterval]);

  useEffect(() => {
    if (visible) {
      setOtp('');
      didFocusOtpRef.current = false;
      startResendCooldown();
    } else {
      clearResendInterval();
      setResendCooldown(0);
      didFocusOtpRef.current = false;
    }
    return clearResendInterval;
  }, [visible, startResendCooldown, clearResendInterval]);

  const focusOtpOnce = useCallback(() => {
    if (didFocusOtpRef.current) return;
    didFocusOtpRef.current = true;
    otpInputRef.current?.focus();
  }, []);

  const handleVerify = async () => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('Notice', 'Please enter the full verification code.');
      return;
    }
    if (!signUp) return;

    setIsVerifying(true);
    try {
      const result = await signUp.attemptEmailAddressVerification({ code: otp });
      const sessionId =
        result.createdSessionId ?? signUp.createdSessionId ?? null;

      if (result.status === 'complete' && sessionId) {
        await onVerified(sessionId);
        return;
      }

      const reportedMissing = result.missingFields ?? signUp.missingFields ?? [];
      const freshMissing =
        reportedMissing.length > 0
          ? reportedMissing
          : result.status === 'missing_requirements' && email
            ? ['username']
            : [];

      if (
        result.status === 'missing_requirements' ||
        freshMissing.length > 0
      ) {
        const completion = await completeOAuthMissingRequirements(result, {
          legalAccepted,
          missingFields: freshMissing,
          email,
        });
        if (completion.kind === 'session') {
          await onVerified(completion.sessionId);
          return;
        }
        if (completion.kind === 'email_verification') {
          Alert.alert('Notice', 'Check your email for a new verification code.');
          return;
        }
      } else if (sessionId) {
        await onVerified(sessionId);
        return;
      }

      Alert.alert(
        'Error',
        freshMissing.length > 0
          ? `Could not finish sign-up (missing: ${freshMissing.join(', ')}). Try again or contact support.`
          : 'Verification incomplete. Please try again.',
      );
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string }>; message?: string };
      const msg = e?.errors?.[0]?.longMessage || e?.message || 'Invalid code';
      Alert.alert('Verification Failed', msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0 || !signUp) return;
    try {
      await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
      startResendCooldown();
      Alert.alert('Sent', 'A new verification code has been sent to your email.');
    } catch {
      Alert.alert('Error', 'Failed to resend code. Try again.');
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onShow={() => {
        setTimeout(focusOtpOnce, Platform.OS === 'android' ? 400 : 200);
      }}
    >
      <View style={styles.modalOverlay}>
        <BlurView
          intensity={40}
          tint="dark"
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <LinearGradient
              colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.08)', 'transparent']}
              style={styles.modalGlow}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
            />

            <TouchableOpacity
              style={styles.modalClose}
              onPress={onClose}
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

            <Text style={styles.modalTitle}>Verify your email</Text>
            <Text style={styles.modalSubtitle}>
              We sent a {OTP_LENGTH}-digit code to{'\n'}
              <Text style={styles.modalEmail}>{email}</Text>
            </Text>

            <OtpInput
              ref={otpInputRef}
              value={otp}
              onChange={setOtp}
              containerStyle={styles.otpRow}
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
                  <Text style={styles.verifyTxt}>Verify & Continue</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <TouchableOpacity
                onPress={handleResend}
                disabled={resendCooldown > 0}
                activeOpacity={0.7}
              >
                <Text style={styles.resendTxt} numberOfLines={1}>
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive it? Resend code"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
});
RegisterEmailVerificationModal.displayName = 'RegisterEmailVerificationModal';
