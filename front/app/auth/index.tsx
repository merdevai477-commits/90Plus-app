import React, { useState } from 'react';
import {
  View,
  Text,
  Pressable,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Linking,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { CircleUserRound, Mail, Lock, Apple } from 'lucide-react-native';
import { AuthScreenShell, AuthTextField, AUTH_ACCENT } from '@/src/components/auth';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  TEXT_SECONDARY,
} from '@/constants/tokens';
import { useSignUp } from '@clerk/clerk-expo';

export default function RegisterScreen() {
  const router = useRouter();
  const { signUp, setActive, isLoaded } = useSignUp();
  const [terms, setTerms] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const submit = async () => {
    if (!terms) {
      Alert.alert('Notice', 'Please accept the Terms & Conditions.');
      return;
    }
    if (!name.trim() || !email.trim() || password.length < 6) {
      Alert.alert('Notice', 'Fill all fields (password at least 6 characters).');
      return;
    }
    if (!isLoaded) return;

    setIsSubmitting(true);
    try {
      const result = await signUp.create({
        emailAddress: email.trim(),
        password,
        firstName: name.trim().split(' ')[0],
        lastName: name.trim().split(' ').slice(1).join(' ') || undefined,
      });

      if (result.status === 'complete' && result.createdSessionId) {
        await setActive({ session: result.createdSessionId });
        router.replace('/(tabs)/Home');
      } else {
        // Email verification needed
        await signUp.prepareEmailAddressVerification({ strategy: 'email_code' });
        router.push('/auth/onboarding');
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
            onPress={() => Linking.openURL('https://90plus-app-production.up.railway.app/terms')}
          >
            Terms
          </Text>
          {' & '}
          <Text
            style={styles.termsLink}
            onPress={() => Linking.openURL('https://90plus-app-production.up.railway.app/privacy')}
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
        <TouchableOpacity activeOpacity={0.9} style={styles.social}>
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.socialTxt} numberOfLines={1}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.9} style={styles.social}>
          <Apple color={TEXT_PRIMARY} size={20} />
          <Text style={styles.socialTxt} numberOfLines={1}>Apple</Text>
        </TouchableOpacity>
      </View>

      <Pressable style={styles.footer} onPress={() => router.push('/auth/login')}>
        <Text style={styles.footerMuted}>
          Already have an account? <Text style={styles.linkBold}>Login</Text>
        </Text>
      </Pressable>
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
});
