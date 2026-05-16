import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Mail } from 'lucide-react-native';
import { AuthScreenShell, AuthTextField, AUTH_ACCENT } from '@/src/components/auth';
import { TEXT_PRIMARY, TEXT_SECONDARY } from '@/constants/tokens';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');

  const submit = () => {
    if (!email.includes('@')) {
      Alert.alert('Notice', 'Enter a valid email address.');
      return;
    }
    Alert.alert(
      'Coming soon',
      `A reset link will be sent to ${email} when the API is enabled.`,
      [{ text: 'OK', onPress: () => router.back() }]
    );
  };

  return (
    <AuthScreenShell heroMode="none">
      <Text style={styles.heroTitle}>Forgot password</Text>
      <Text style={styles.sub}>
        We&apos;ll send a link to choose a new password. Make sure the email is tied to your
        account.
      </Text>

      <AuthTextField
        icon={Mail}
        placeholder="Email"
        keyboardType="email-address"
        autoCapitalize="none"
        value={email}
        onChangeText={setEmail}
        containerStyle={styles.mt}
      />

      <TouchableOpacity style={styles.primaryWrap} activeOpacity={0.92} onPress={submit}>
        <LinearGradient
          colors={[AUTH_ACCENT, '#5b21b6']}
          style={styles.primary}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        >
          <Text style={styles.primaryTxt}>Send reset link</Text>
        </LinearGradient>
      </TouchableOpacity>

      <TouchableOpacity style={styles.back} onPress={() => router.replace('/login')}>
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
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    marginBottom: 8,
    textAlign: 'left',
  },
  mt: { marginTop: 16 },
  primaryWrap: { marginTop: 24, borderRadius: 14, overflow: 'hidden' },
  primary: { paddingVertical: 16, alignItems: 'center' },
  primaryTxt: { fontSize: 17, fontWeight: '800', color: TEXT_PRIMARY },
  back: { marginTop: 20, alignItems: 'center', paddingBottom: 20 },
  backTxt: { fontSize: 14, fontWeight: '700', color: AUTH_ACCENT },
});
