import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, ShieldCheck } from 'lucide-react-native';
import { AuthScreenShell, AuthTextField, AUTH_ACCENT } from '@/src/components/auth';
import { TEXT_PRIMARY, TEXT_SECONDARY, TEXT_MUTED } from '@/constants/tokens';
import { useSignIn } from '@clerk/clerk-expo';

const OTP_LENGTH = 6;

type Step = 'email' | 'reset';

/**
 * Forgot-password flow (Clerk reset_password_email_code strategy):
 *  1. User enters email → we trigger Clerk to send a 6-digit code
 *  2. User enters the code + new password on the same screen
 *  3. We call attemptFirstFactor with both → on success, set the active
 *     session and route to /(tabs)/Home
 *
 * Previous version showed an Alert and dropped the user back to /auth/login,
 * which made it impossible to actually finish a password reset because Clerk
 * needs the code AND a new password in the same call.
 */
export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { signIn, setActive, isLoaded } = useSignIn();

  const [step, setStep] = useState<Step>('email');
  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState<string[]>(Array(OTP_LENGTH).fill(''));
  const [newPassword, setNewPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const otpRefs = useRef<(TextInput | null)[]>([]);

  const startResendCooldown = (): void => {
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

  // Auto-focus the first OTP cell once we move to the reset step.
  useEffect(() => {
    if (step === 'reset') {
      const t = setTimeout(() => otpRefs.current[0]?.focus(), 250);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [step]);

  // ───────────── Step 1: send code ─────────────
  const sendCode = async (): Promise<void> => {
    if (!email.includes('@')) {
      Alert.alert('Notice', 'Enter a valid email address.');
      return;
    }
    if (!isLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
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
    try {
      await signIn.create({
        strategy: 'reset_password_email_code',
        identifier: email.trim(),
      });
      startResendCooldown();
      Alert.alert('Sent', 'A new code has been sent to your email.');
    } catch (err: unknown) {
      const e = err as { message?: string };
      Alert.alert('Error', e?.message || 'Failed to resend code.');
    }
  };

  // ───────────── OTP input helpers ─────────────
  const handleOtpChange = (value: string, index: number): void => {
    // Paste handling: a multi-char value lands in the first cell, distribute it.
    if (value.length > 1) {
      const chars = value.replace(/\D/g, '').split('').slice(0, OTP_LENGTH);
      const next = [...otp];
      chars.forEach((c, i) => {
        if (index + i < OTP_LENGTH) next[index + i] = c;
      });
      setOtp(next);
      const focusIndex = Math.min(index + chars.length, OTP_LENGTH - 1);
      otpRefs.current[focusIndex]?.focus();
      return;
    }

    const cleaned = value.replace(/\D/g, '');
    const next = [...otp];
    next[index] = cleaned;
    setOtp(next);

    if (cleaned && index < OTP_LENGTH - 1) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyPress = (key: string, index: number): void => {
    if (key === 'Backspace' && !otp[index] && index > 0) {
      const next = [...otp];
      next[index - 1] = '';
      setOtp(next);
      otpRefs.current[index - 1]?.focus();
    }
  };

  // ───────────── Step 2: submit code + new password ─────────────
  const submitReset = async (): Promise<void> => {
    const code = otp.join('');
    if (code.length !== OTP_LENGTH) {
      Alert.alert('Notice', 'Enter the full verification code.');
      return;
    }
    if (newPassword.length < 8) {
      Alert.alert('Notice', 'New password must be at least 8 characters.');
      return;
    }
    if (!isLoaded || !signIn) return;

    setIsSubmitting(true);
    try {
      const result = await signIn.attemptFirstFactor({
        strategy: 'reset_password_email_code',
        code,
        password: newPassword,
      });

      if (result.status === 'complete' && result.createdSessionId && setActive) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/Home');
      } else {
        // Edge case: Clerk requires another factor (rare for email-code reset).
        Alert.alert(
          'More steps required',
          'Your email is reset, but we need another step to sign you in. Please log in with your new password.',
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
    <AuthScreenShell heroMode="none">
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
          {/* OTP cells */}
          <View style={styles.otpRow}>
            {otp.map((digit, i) => (
              <TextInput
                key={i}
                ref={(ref) => {
                  otpRefs.current[i] = ref;
                }}
                style={[styles.otpInput, digit ? styles.otpInputFilled : null]}
                value={digit}
                onChangeText={(v) => handleOtpChange(v, i)}
                onKeyPress={({ nativeEvent }) => handleOtpKeyPress(nativeEvent.key, i)}
                keyboardType="number-pad"
                // ✅ All cells use maxLength=1. Paste is handled in
                // handleOtpChange by inspecting `value.length > 1` (the first
                // press of a paste arrives as the full string regardless of
                // maxLength on iOS).
                maxLength={1}
                textContentType="oneTimeCode"
                autoComplete="sms-otp"
                returnKeyType="done"
                selectTextOnFocus
                allowFontScaling={false}
              />
            ))}
          </View>

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

  // OTP — same layout as the signup verification modal so users see a
  // consistent shape across both flows.
  otpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 24,
    marginBottom: 4,
  },
  otpInput: {
    width: 46,
    height: 54,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.04)',
    color: TEXT_PRIMARY,
    fontSize: 22,
    lineHeight: 26,
    fontWeight: '800',
    textAlign: 'center',
    padding: 0,
    includeFontPadding: false,
    textAlignVertical: 'center',
  },
  otpInputFilled: {
    borderColor: 'rgba(124,58,237,0.5)',
    backgroundColor: 'rgba(124,58,237,0.08)',
  },
});
