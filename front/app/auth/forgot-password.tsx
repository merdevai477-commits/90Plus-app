import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, ShieldCheck } from 'lucide-react-native';
import {
  AuthScreenShell,
  AuthTextField,
  AUTH_ACCENT,
  OtpInput,
  MIN_PASSWORD_LENGTH,
  normalizeAuthEmail,
} from '@/src/components/auth';
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '@/constants/tokens';
import { useAuth, useSignIn } from '@clerk/clerk-expo';
import { navigateAfterAuth } from '@/src/utils/postAuthNavigation';

const OTP_LENGTH = 6;

type Step = 'email' | 'reset';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();
  const { getToken } = useAuth();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
        resendIntervalRef.current = null;
      }
    };
  }, []);

  const startResendCooldown = (): void => {
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

  const sendCode = async (): Promise<void> => {
    const normalizedEmail = normalizeAuthEmail(email);
    if (!normalizedEmail.includes('@')) {
      Alert.alert('Notice', 'Enter a valid email address.');
      return;
    }
    if (!isLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: normalizedEmail,
      });
      setEmail(normalizedEmail);
      setOtp('');
      setStep('reset');
      startResendCooldown();
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string }>; message?: string };
      const msg = e?.errors?.[0]?.longMessage || e?.message || 'Failed to send reset email';
      Alert.alert('Error', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  const resendCode = async (): Promise<void> => {
    if (resendCooldown > 0 || !isLoaded || !signIn) return;
    const normalizedEmail = normalizeAuthEmail(email);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: normalizedEmail,
      });
      startResendCooldown();
      Alert.alert('Sent', 'A new code has been sent to your email.');
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Error', e?.message || 'Failed to resend code.');
    }
  };

  const submitReset = async (): Promise<void> => {
    if (otp.length !== OTP_LENGTH) {
      Alert.alert('Notice', 'Enter the full verification code.');
      return;
    }
    if (newPassword.length < MIN_PASSWORD_LENGTH) {
      Alert.alert('Notice', `New password must be at least ${MIN_PASSWORD_LENGTH} characters.`);
      return;
    }
    if (!isLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code: otp,
        password: newPassword,
      });

      if (result.status === 'complete' && result.createdSessionId && setActive) {
        await setActive({ session: result.createdSessionId });
        await navigateAfterAuth(router, getToken);
      } else {
        Alert.alert(
          'More steps required',
          'Your password is reset. Please log in with your new password.',
          [{ text: 'OK', onPress: () => router.replace('/auth/login') }],
        );
      }
    } catch (err: unknown) {
      const e = err as { errors?: Array<{ longMessage?: string }>; message?: string };
      const msg = e?.errors?.[0]?.longMessage || e?.message || 'Reset failed';
      Alert.alert('Reset failed', msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AuthScreenShell showHeroOverlay={false}>
      <Text style={styles.heroTitle}>
        {step === 'email' ? 'Forgot password' : 'Verify and reset'}
      </Text>
      <Text style={styles.sub}>
        {step === 'email'
          ? "We'll send a code to reset your password. Make sure the email is tied to your account."
          : `We sent a 6-digit code to ${email}. Enter it below with your new password.`}
      </Text>

      {step === 'email' ? (
        <>
          <AuthTextField
            icon={Mail}
            placeholder="Email"
            keyboardType="email-address"
            autoCapitalize="none"
            value={email}
            onChangeText={setEmail}
            containerStyle={styles.mt}
          />

          <TouchableOpacity
            style={[styles.primaryWrap, isSubmitting && { opacity: 0.6 }]}
            activeOpacity={0.92}
            onPress={sendCode}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={[AUTH_ACCENT, '#5b21b6']}
              style={styles.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={TEXT_PRIMARY} size="small" />
              ) : (
                <Text style={styles.primaryTxt}>Send reset code</Text>
              )}
            </LinearGradient>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <OtpInput
            value={otp}
            onChange={setOtp}
            autoFocus
            containerStyle={styles.otpRow}
          />

          <AuthTextField
            icon={Lock}
            placeholder="New password"
            secureTextEntry
            secureToggle
            value={newPassword}
            onChangeText={setNewPassword}
            containerStyle={styles.mt}
          />

          <TouchableOpacity
            style={[styles.primaryWrap, isSubmitting && { opacity: 0.6 }]}
            activeOpacity={0.92}
            onPress={submitReset}
            disabled={isSubmitting}
          >
            <LinearGradient
              colors={[AUTH_ACCENT, '#5b21b6']}
              style={styles.primary}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
            >
              {isSubmitting ? (
                <ActivityIndicator color={TEXT_PRIMARY} size="small" />
              ) : (
                <View style={styles.primaryRow}>
                  <ShieldCheck color={TEXT_PRIMARY} size={18} />
                  <Text style={styles.primaryTxt}>Reset password</Text>
                </View>
              )}
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.resend}
            onPress={resendCode}
            disabled={resendCooldown > 0}
          >
            <Text style={[styles.resendTxt, resendCooldown > 0 && { color: TEXT_MUTED }]}>
              {resendCooldown > 0
                ? `Resend code in ${resendCooldown}s`
                : 'Resend code'}
            </Text>
          </TouchableOpacity>
        </>
      )}

      <TouchableOpacity style={styles.back} onPress={() => router.replace('/auth/login')}>
        <Text style={styles.backTxt}>Back to login</Text>
      </TouchableOpacity>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  heroTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    marginBottom: 10,
    textAlign: 'left',
  },
  sub: { fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY, marginBottom: 8, textAlign: 'left' },
  mt: { marginTop: 16 },
  primaryWrap: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  primary: { paddingVertical: 16, alignItems: 'center', justifyContent: 'center' },
  primaryRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  primaryTxt: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  back: { marginTop: 20, alignItems: 'center', paddingBottom: 20 },
  backTxt: { fontSize: 14, fontWeight: '700', color: AUTH_ACCENT },
  resend: { marginTop: 14, alignItems: 'center' },
  resendTxt: { fontSize: 13, fontWeight: '700', color: AUTH_ACCENT },
  otpRow: {
    marginTop: 24,
    marginBottom: 4,
    justifyContent: 'center',
  },
});
