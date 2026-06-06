import React, { useState, useRef, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
  Modal,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { CircleUserRound, Mail, Lock, Apple, ShieldCheck, X, Check } from 'lucide-react-native';
import {
  AuthScreenShell,
  AuthTextField,
  AUTH_ACCENT,
  OtpInput,
  type OtpInputHandle,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
} from '@/src/components/auth';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
import { LEGAL_URLS } from '@/config/legal.config';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_SECONDARY,
  PURPLE_PRIMARY,
  PURPLE_SOFT,
  PURPLE_GLOW,
  BG_BASE,
  BORDER_ARENA,
  RADIUS_LG,
} from '@/constants/tokens';
import { useAuth, useSignUp } from '@clerk/clerk-expo';
import { useTranslation } from '@/src/i18n';
import { confirmMinimumAgeWithBackend } from '@/hooks/useAgeVerification';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';
import { waitForClerkToken } from '@/src/utils/authSession';

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
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await completeAuth(result.createdSessionId);
      } else {
        // Email verification needed — show glass modal
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setShowVerification(true);
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell heroMode="full" panelOffset={-55}>
      <AuthTextField
        icon={CircleUserRound}
        placeholder="Full Name"
        value={name}
        onChangeText={setName}
        autoCapitalize="words"
        autoCorrect={false}
      />
      <AuthTextField
        icon={Mail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        containerStyle={styles.gapTop}
      />
      <AuthTextField
        icon={Lock}
        placeholder="Password"
        secureTextEntry
        secureToggle
        value={password}
        onChangeText={setPassword}
        containerStyle={StyleSheet.flatten([styles.gapTop, styles.passwordField])}
      />

      {!showVerification && (
        <RegisterTermsConsent
          checked={terms}
          onToggle={toggleTerms}
          isRTL={isRTL}
          tCommon={tCommon}
        />
      )}

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
          <Text style={styles.primaryTxt}>{isSubmitting ? 'Creating...' : 'Sign Up'}</Text>
        </LinearGradient>
      </TouchableOpacity>

      <Divider />

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
              <Text style={styles.socialTxt} numberOfLines={1}>Google</Text>
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
              <Text style={styles.socialTxt} numberOfLines={1}>Apple</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      <Pressable style={styles.footer} onPress={() => router.push('/auth/login')}>
        <Text style={styles.footerMuted}>
          Already have an account? <Text style={styles.linkBold}>Login</Text>
        </Text>
      </Pressable>

      <RegisterEmailVerificationModal
        visible={showVerification}
        email={email}
        signUp={signUp}
        onClose={() => setShowVerification(false)}
        onVerified={async (sessionId) => {
          setShowVerification(false);
          await completeAuth(sessionId);
        }}
      />
    </AuthScreenShell>
  );
}

function Divider() {
  return (
    <View style={styles.divWrap}>
      <View style={styles.divLine} />
      <Text style={styles.divTxt}>or continue with</Text>
      <View style={styles.divLine} />
    </View>
  );
}

const styles = StyleSheet.create({
  gapTop: { marginTop: 12 },
  passwordField: { marginBottom: 10 },
  termsPressable: {
    width: '100%',
    marginTop: 28,
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  termsRow: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'nowrap',
    alignItems: 'flex-start',
    gap: 12,
  },
  termsRowRtl: {
    flexDirection: 'row-reverse',
  },
  termsRowActive: {
    backgroundColor: 'rgba(124,58,237,0.1)',
    borderColor: 'rgba(124,58,237,0.35)',
  },
  termsTextWrap: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    paddingLeft: 2,
  },
  termsTextWrapRtl: {
    paddingLeft: 0,
    paddingRight: 2,
  },
  termsCheckBox: {
    width: 24,
    height: 24,
    flexShrink: 0,
    marginTop: 2,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  termsCheckBoxOn: {
    borderColor: AUTH_ACCENT,
    backgroundColor: AUTH_ACCENT,
  },
  termsLine: {
    fontSize: 13.5,
    color: 'rgba(255,255,255,0.78)',
    lineHeight: 21,
    fontWeight: '400',
    letterSpacing: 0.15,
  },
  termsLineRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  termsLink: {
    color: AUTH_ACCENT,
    fontSize: 13.5,
    fontWeight: '600',
    lineHeight: 21,
    textDecorationLine: 'underline',
    textDecorationColor: 'rgba(124,58,237,0.5)',
  },
  primaryWrap: { marginTop: 22, borderRadius: 14, overflow: 'hidden' },
  primary: { paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  divWrap: { flexDirection: 'row', alignItems: 'center', marginVertical: 22, gap: 12 },
  divLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.12)' },
  divTxt: { fontSize: 12, color: TEXT_MUTED, fontWeight: '600' },
  socialRow: { flexDirection: 'row', gap: 10 },
  social: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, borderRadius: 14, paddingVertical: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  socialTxt: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  footer: { marginTop: 5, alignItems: 'center', paddingBottom: 12 },
  footerMuted: { fontSize: 14, color: TEXT_MUTED },
  linkBold: { color: AUTH_ACCENT, fontWeight: '800' },

  // ── Verification Modal ────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
  },
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
    // Depth shadow
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

  // Verify button
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

  // Resend
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

type RegisterTermsCopy = {
  registerAgreementPrefix: string;
  registerTermsLink: string;
  registerPrivacyLink: string;
  registerAgreementAfterLinks: string;
};

const RegisterTermsConsent = memo(function RegisterTermsConsent({
  checked,
  onToggle,
  isRTL,
  tCommon,
}: {
  checked: boolean;
  onToggle: () => void;
  isRTL: boolean;
  tCommon: RegisterTermsCopy;
}) {
  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={onToggle}
      style={[styles.termsPressable, checked && styles.termsRowActive]}
    >
      <View style={[styles.termsRow, isRTL && styles.termsRowRtl]}>
        <View style={[styles.termsCheckBox, checked && styles.termsCheckBoxOn]}>
          {checked ? <Check size={15} color="#fff" strokeWidth={3} /> : null}
        </View>
        <View style={[styles.termsTextWrap, isRTL && styles.termsTextWrapRtl]}>
          <Text style={[styles.termsLine, isRTL && styles.termsLineRtl]}>
            {tCommon.registerAgreementPrefix}{' '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL(LEGAL_URLS.terms)}
            >
              {tCommon.registerTermsLink}
            </Text>
            {isRTL ? ' و' : ' & '}
            <Text
              style={styles.termsLink}
              onPress={() => Linking.openURL(LEGAL_URLS.privacy)}
            >
              {tCommon.registerPrivacyLink}
            </Text>
            {tCommon.registerAgreementAfterLinks}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );
});
RegisterTermsConsent.displayName = 'RegisterTermsConsent';

const RegisterEmailVerificationModal = memo(function RegisterEmailVerificationModal({
  visible,
  email,
  signUp,
  onClose,
  onVerified,
}: {
  visible: boolean;
  email: string;
  signUp: ReturnType<typeof useSignUp>['signUp'];
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
      if (result.status === 'complete' && result.createdSessionId) {
        await onVerified(result.createdSessionId);
      } else {
        Alert.alert('Error', 'Verification incomplete. Please try again.');
      }
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
