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
import { UserRound } from 'lucide-react-native';
import { useTranslation } from '@/src/i18n';
import { useOAuthFlow } from '@/src/components/auth/useOAuthFlow';
import {
  AuthDivider,
  AuthSecondaryButton,
  AuthSocialButtons,
} from '@/src/components/auth';
import { AuthThemeProvider, useAuthTheme } from '@/src/components/auth/useAuthTheme';
import { LEGAL_URLS, openLegalUrl } from '@/config/legal.config';

const LANDING_HERO = require('../../assets/images/auth/figma/auth-landing-hero.jpg');

/**
 * Auth landing — Figma 1620:5898 (light) + dark adaptation of the same layout.
 * Stadium hero → Sign up / Log in → social → legal.
 */
function AuthLandingInner() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { language } = useTranslation();
  const isRTL = language === 'ar';
  const { colors, isDark } = useAuthTheme();
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

  const pageBg = colors.pageBg;
  const muted = colors.textSecondary;
  const primary = colors.primary;

  const fadeColors = isDark
    ? (['transparent', 'rgba(8,6,15,0)', pageBg] as const)
    : (['transparent', 'rgba(252,252,252,0)', pageBg] as const);

  return (
    <View style={[styles.root, { backgroundColor: pageBg }]}>
      <StatusBar style="light" />
      <ImageBackground
        source={LANDING_HERO}
        style={styles.hero}
        resizeMode="cover"
      >
        {isDark ? (
          <View style={styles.darkHeroScrim} pointerEvents="none" />
        ) : null}
        <LinearGradient
          colors={[...fadeColors]}
          locations={[0.55, 0.72, 0.9]}
          style={StyleSheet.absoluteFill}
        />
      </ImageBackground>

      <View
        style={[
          styles.actions,
          {
            paddingBottom: Math.max(insets.bottom, 16) + 12,
            backgroundColor: pageBg,
          },
        ]}
      >
        <Pressable
          onPress={() => router.push('/auth/register')}
          style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        >
          <LinearGradient
            colors={[...colors.buttonGradient]}
            start={{ x: 0.15, y: 0 }}
            end={{ x: 0.85, y: 1 }}
            style={styles.primaryBtn}
          >
            <Text style={styles.primaryTxt}>{copy.signUp}</Text>
            <UserRound size={21} color="#fff" strokeWidth={2.25} />
          </LinearGradient>
        </Pressable>

        {/* Figma 1620:6000 — outlined login CTA (theme-aware) */}
        <AuthSecondaryButton
          label={copy.login}
          onPress={() => router.push('/auth/login')}
        />

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
          <Text style={[styles.legalMuted, { color: muted }]}>
            {copy.agree}{' '}
          </Text>
          <Text
            style={[styles.legalLink, { color: primary }]}
            onPress={() => {
              void openLegalUrl(LEGAL_URLS.terms);
            }}
          >
            {copy.terms}
          </Text>
          <Text style={[styles.legalMuted, { color: muted }]}>
            {copy.and}
          </Text>
          <Text
            style={[styles.legalLink, { color: primary }]}
            onPress={() => {
              void openLegalUrl(LEGAL_URLS.privacy);
            }}
          >
            {copy.privacy}
          </Text>
        </View>
      </View>

      {oauthLoading ? (
        <View
          style={[
            styles.oauthOverlay,
            {
              backgroundColor: isDark
                ? 'rgba(8,6,15,0.35)'
                : 'rgba(255,255,255,0.25)',
            },
          ]}
          pointerEvents="none"
        >
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
  darkHeroScrim: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(8, 6, 15, 0.42)',
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
  },
});
