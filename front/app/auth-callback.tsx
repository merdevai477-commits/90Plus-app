import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useTranslation } from '@/src/i18n';
import {
  GATE_THEME,
  useResolvedAppScheme,
} from '@/hooks/useResolvedAppScheme';

/**
 * OAuth redirect target for Google/Apple sign-in.
 * Clerk completes the session via maybeCompleteAuthSession() in _layout.tsx.
 */
export default function AuthCallbackScreen() {
  const router = useRouter();
  const { language } = useTranslation();
  const { isDark } = useResolvedAppScheme();
  const theme = isDark ? GATE_THEME.dark : GATE_THEME.light;
  const label =
    language === 'ar' ? 'جاري تسجيل الدخول…' : 'Signing you in…';

  useEffect(() => {
    WebBrowser.maybeCompleteAuthSession();
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/auth/login');
      }
    }, 8000);
    return () => clearTimeout(t);
  }, [router]);

  return (
    <View style={[styles.container, { backgroundColor: theme.bg }]}>
      <StatusBar style={theme.statusBar} />
      <ActivityIndicator size="large" color={theme.primary} />
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
});
