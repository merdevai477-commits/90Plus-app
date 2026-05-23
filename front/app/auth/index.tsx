import React, { useState } from 'react';
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
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useRouter } from 'expo-router';
import { CircleUserRound, Mail, Lock, Apple, ShieldCheck, X } from 'lucide-react-native';
import {
  AuthScreenShell,
  AuthTextField,
  AUTH_ACCENT,
  OtpInput,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
} from '@/src/components/auth';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
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
import { useSignUp } from '@clerk/clerk-expo';

const OTP_LENGTH = 6;

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const [terms, setTerms] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(null);

  const { startGoogle, startApple } = useOAuthFlow({
    onError: () => setOauthLoading(null),
  });

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

  // Verification modal state
  const [showVerification, setShowVerification] = useState(false);
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const submit = async () => {
    if (!terms) {
      Alert.alert('Notice', 'Please accept the Terms & Conditions.');
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
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      const result = await signUp.create({
        emailAddress: normalizedEmail,
        password,
        firstName: name.trim().split(' ')[0],
        lastName: name.trim().split(' ').slice(1).join(' ') || undefined,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/Home');
      } else {
        // Email verification needed — show glass modal
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        setOtp('');
        setShowVerification(true);
        startResendCooldown();
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Registration failed';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

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

  const handleVerify = async () => {
    const code = otp;
    if (code.length !== OTP_LENGTH) {
      Alert.alert('Notice', 'Please enter the full verification code.');
      return;
    }

    setIsVerifying(true);
    try {
      const result = await signUp!.attemptEmailAddressVerification({ code });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        setShowVerification(false);
        router.replace('/(tabs)/Home');
      } else {
        Alert.alert('Error', 'Verification incomplete. Please try again.');
      }
    } catch (err: any) {
      const msg = err?.errors?.[0]?.longMessage || err?.message || 'Invalid code';
      Alert.alert('Verification Failed', msg);
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      await signUp!.prepareEmailAddressVerification({ strategy: 'email_code' });
      startResendCooldown();
      Alert.alert('Sent', 'A new verification code has been sent to your email.');
    } catch (err: any) {
      Alert.alert('Error', 'Failed to resend code. Try again.');
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
        containerStyle={styles.gapTop}
      />

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setTerms((v) => !v)}
        style={[styles.termsRow, terms && styles.termsRowActive]}
      >
        <View style={[styles.termsCircle, terms && styles.termsCircleOn]}>
          {terms && <Text style={styles.termsCheck}>✓</Text>}
        </View>
        <Text style={styles.termsTxt}>
          By signing up, I agree to the{' '}
          <Text
            style={styles.termsLink}
            onPress={() => Linking.openURL('https://90plus-app-production-1808.up.railway.app/terms')}
          >
            Terms
          </Text>
          {' & '}
          <Text
            style={styles.termsLink}
            onPress={() => Linking.openURL('https://90plus-app-production-1808.up.railway.app/privacy')}
          >
            Privacy Policy
          </Text>
        </Text>
      </TouchableOpacity>

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

      {/* ── Email Verification Glass Modal ───────────────────────────────── */}
      <Modal
        visible={showVerification}
        transparent
        animationType="fade"
        statusBarTranslucent
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <BlurView intensity={40} tint="dark" style={StyleSheet.absoluteFill} />
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              {/* Glow effect behind card */}
              <LinearGradient
                colors={['rgba(124,58,237,0.15)', 'rgba(59,130,246,0.08)', 'transparent']}
                style={styles.modalGlow}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
              />

              {/* Close button */}
              <TouchableOpacity
                style={styles.modalClose}
                onPress={() => setShowVerification(false)}
                activeOpacity={0.7}
              >
                <X size={20} color={TEXT_MUTED} strokeWidth={2} />
              </TouchableOpacity>

              {/* Icon */}
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

              {/* Title */}
              <Text style={styles.modalTitle}>Verify your email</Text>
              <Text style={styles.modalSubtitle}>
                We sent a {OTP_LENGTH}-digit code to{'\n'}
                <Text style={styles.modalEmail}>{email}</Text>
              </Text>

              <OtpInput
                value={otp}
                onChange={setOtp}
                autoFocus
                containerStyle={styles.otpRow}
              />

              {/* Verify button */}
              <TouchableOpacity
                activeOpacity={0.92}
                onPress={handleVerify}
                disabled={isVerifying || otp.length !== OTP_LENGTH}
                style={[
                  styles.verifyWrap,
                  otp.length !== OTP_LENGTH && { opacity: 0.5 },
                ]}
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

              {/* Resend */}
              <TouchableOpacity
                onPress={handleResend}
                disabled={resendCooldown > 0}
                activeOpacity={0.7}
                style={styles.resendRow}
              >
                <Text style={styles.resendTxt}>
                  {resendCooldown > 0
                    ? `Resend code in ${resendCooldown}s`
                    : "Didn't receive it? Resend code"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
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
  termsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 20,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    gap: 12,
  },
  termsRowActive: {
    backgroundColor: 'rgba(124,58,237,0.08)',
    borderColor: 'rgba(124,58,237,0.3)',
  },
  termsCircle: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  termsCircleOn: {
    borderColor: AUTH_ACCENT,
    backgroundColor: AUTH_ACCENT,
  },
  termsCheck: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '900',
    marginTop: -1,
  },
  termsTxt: { flex: 1, fontSize: 13, color: TEXT_MUTED, lineHeight: 19 },
  termsLink: { color: AUTH_ACCENT, fontWeight: '700', textDecorationLine: 'underline' },
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
    paddingVertical: 6,
  },
  resendTxt: {
    fontSize: 13,
    color: TEXT_MUTED,
    fontWeight: '600',
  },
});
