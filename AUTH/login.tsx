import React, { useState } from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail, Lock, Apple } from 'lucide-react-native';
import { AuthScreenShell, AuthTextField, AUTH_ACCENT } from '@/src/components/auth';
import { TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY } from '@/constants/tokens';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const submit = () => {
    if (!email.trim() || password.length < 6) {
      Alert.alert('Notice', 'Enter a valid email and password (min. 6 characters).');
      return;
    }
    Alert.alert(
      'Coming soon',
      'Authentication will hit the backend. Ready to wire up /api/auth/login.'
    );
  };

  return (
    <AuthScreenShell heroMode="compact" panelOffset={60}>
      <Text style={styles.subMuted}>Sign in to keep your picks, alerts, and AI history in sync.</Text>

      <AuthTextField
        icon={Mail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
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

      <Pressable hitSlop={8} style={styles.forgot} onPress={() => router.push('/forgot-password')}>
        <Text style={styles.forgotTxt}>Forgot password?</Text>
      </Pressable>

      <TouchableOpacity style={styles.primaryWrap} activeOpacity={0.92} onPress={submit}>
        <LinearGradient
          colors={[AUTH_ACCENT, '#5b21b6']}
          style={styles.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.primaryTxt}>Login</Text>
        </LinearGradient>
      </TouchableOpacity>

      <View style={styles.divWrap}>
        <View style={styles.divLine} />
        <Text style={styles.divTxt}>or continue with</Text>
        <View style={styles.divLine} />
      </View>

      <View style={styles.socialRow}>
        <TouchableOpacity activeOpacity={0.9} style={styles.social}>
          <Text style={styles.googleG}>G</Text>
          <Text style={styles.socialTxt}>Google</Text>
        </TouchableOpacity>
        <TouchableOpacity activeOpacity={0.9} style={styles.social}>
          <Apple color={TEXT_PRIMARY} size={20} />
          <Text style={styles.socialTxt}>Apple</Text>
        </TouchableOpacity>
      </View>

      <Pressable style={styles.footer} onPress={() => router.replace('/register')}>
        <Text style={styles.footerMuted}>
          Don&apos;t have an account? <Text style={styles.linkBold}>Sign up</Text>
        </Text>
      </Pressable>
    </AuthScreenShell>
  );
}

const styles = StyleSheet.create({
  subMuted: {
    marginTop: 9,
    marginBottom: 20,
    fontSize: 14,
    color: TEXT_SECONDARY,
    lineHeight: 20,
    textAlign: 'left',
  },
  title: { fontSize: 26, fontWeight: '800', color: TEXT_PRIMARY, textAlign: 'left', marginTop: -12 },
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
  social: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 14,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  googleG: { fontSize: 18, fontWeight: '800', color: '#4285F4' },
  socialTxt: { fontSize: 14, fontWeight: '700', color: TEXT_SECONDARY },
  footer: { marginTop: 20, alignItems: 'center', paddingBottom: 16 },
  footerMuted: { fontSize: 14, color: TEXT_MUTED },
  linkBold: { color: AUTH_ACCENT, fontWeight: '800' },
});