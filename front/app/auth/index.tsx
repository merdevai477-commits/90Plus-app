import React, { useState } from 'react';
import {
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Pressable,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useRouter } from 'expo-router';
import { UserRound, LogIn } from 'lucide-react-native';
import { useTranslation } from '@/src/i18n';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
import {
  AuthDivider,
  AuthSocialButtons,
} from '@/src/components/auth';
import { AuthThemeProvider, useAuthTheme } from '@/src/components/auth/useAuthTheme';
import { LEGAL_URLS, openLegalUrl } from '@/config/legal.config';

const LANDING_HERO = require('../../assets/images/auth/figma/auth-landing-hero.png');

/**
 * Auth landing — Figma 1620:5898.
 * First screen of /auth: stadium hero → Sign up / Log in → social.
 */
function AuthLandingInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const { colors } = useAuthTheme();
  const [oauthLoading, setOauthLoading] = useState<null | 'google' | 'apple'>(null);

  const copy = {
    signUp: isRTL ? 'إنشاء حساب جديد' : 'Create new account',
    login: isRTL ? 'تسجيل الدخول' : 'Log in',
    divider: isRTL ? 'أو تابع باستخدام' : 'Or continue with',
    agree: isRTL ? 'بمتابعتك، أنت توافق على' : 'By continuing, you agree to',
    terms: isRTL ? 'شروط الإستخدام' : 'Terms of Use',
    and: isRTL ? ' و ' : ' and ',
    privacy: isRTL ? 'سياسة الخصوصية' : 'Privacy Policy',
  };

  const { startGoogle, startApple } = useOAuthFlow({
    onError: () => setOauthLoading(null),
    legalAccepted: true,
  });

  const handleGoogle = async () => {
    if (oauthLoading) return;
    setOauthLoading('google');
    try {
      await startGoogle();
    } finally {
      setOauthLoading(null);
    }
  };

  const handleApple = async () => {
    if (oauthLoading) return;
    setOauthLoading('apple');
    try {
      await startApple();
    } finally {
      setOauthLoading(null);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.pageBg }]}>
      <StatusBar style="light" />
      <ImageBackground
        source={LANDING_HERO}
        style={styles.hero}
        resizeMode="cover"
      >
        <LinearGradient
          colors={['transparent', 'rgba(252,252,252,0)', '#FCFCFC']}
          locations={[0.55, 0.72, 1]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View
        style={[
          styles.actions,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            backgroundColor: '#FCFCFC',
          },
        ]}
      >
        <Pressable
          onPress={() => router.push('/auth/register')}
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[...colors.buttonGradient]}
            start={{ x: 0.1, y: 0 }}
            end={{ x: 0.9, y: 1 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryTxt}>{copy.signUp}</Text>
            <UserRound size={21} color="#fff" strokeWidth={2.25} />
          </LinearGradient>
        </Pressable>

        <Pressable
          onPress={() => router.push('/auth/login')}
          style={({ pressed }) => [
            styles.secondaryBtn,
            { borderColor: colors.inputBorder },
            pressed && { opacity: 0.9 },
          ]}
        >
          <Text style={[styles.secondaryTxt, { color: colors.textPrimary }]}>
            {copy.login}
          </Text>
          <LogIn size={21} color={colors.primary} strokeWidth={2.25} />
        </Pressable>

        <View style={styles.dividerWrap}>
          <AuthDivider label={copy.divider} />
        </View>

        <AuthSocialButtons
          onGoogle={handleGoogle}
          onApple={handleApple}
          loading={!!oauthLoading}
          googleLoading={oauthLoading === 'google'}
          appleLoading={oauthLoading === 'apple'}
        />

        <View style={[styles.legalRow, isRTL && styles.legalRowRtl]}>
          <Text style={[styles.legalMuted, { color: colors.textSecondary }]}>
            {copy.agree}{' '}
          </Text>
          <Text
            style={[styles.legalLink, { color: colors.primary }]}
            onPress={() => {
              void openLegalUrl(LEGAL_URLS.terms);
            }}
          >
            {copy.terms}
          </Text>
          <Text style={[styles.legalMuted, { color: colors.textSecondary }]}>
            {copy.and}
          </Text>
          <Text
            style={[styles.legalLink, { color: colors.primary }]}
            onPress={() => {
              void openLegalUrl(LEGAL_URLS.privacy);
            }}
          >
            {copy.privacy}
          </Text>
        </View>
      </View>

      {oauthLoading ? (
        <View style={styles.oauthOverlay} pointerEvents="none">
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : null}
    </View>
  );
}

export default function AuthLandingScreen() {
  return (
    <AuthThemeProvider>
      <AuthLandingInner />
    </AuthThemeProvider>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  hero: {
    flex: 1,
    width: '100%',
    minHeight: 420,
  },
  actions: {
    paddingHorizontal: 20,
    paddingTop: 8,
    gap: 12,
  },
  primaryBtn: {
    height: 54,
    borderRadius: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  primaryTxt: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryBtn: {
    height: 54,
    borderRadius: 18,
    borderWidth: 1,
    backgroundColor: '#fff',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  secondaryTxt: {
    fontSize: 16,
    fontWeight: '600',
  },
  dividerWrap: {
    marginTop: 4,
    marginBottom: 4,
  },
  legalRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 8,
    paddingHorizontal: 8,
  },
  legalRowRtl: {
    flexDirection: 'row-reverse',
  },
  legalMuted: {
    fontSize: 12,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
  },
  oauthOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
});
