import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { useTranslation } from '@/src/i18n';
import { AUTH_V2_ASSETS } from './authV2Assets';

export function AuthHeroBlock() {
  const { isRTL } = useTranslation();

  return (
    <View style={[styles.hero, isRTL && styles.heroRtl]} pointerEvents="none">
      <Image source={AUTH_V2_ASSETS.logo} style={styles.logo} contentFit="contain" />
      <Text style={[styles.tagline, isRTL && styles.textRtl]}>
        {isRTL ? 'كل الكرة في تطبيق واحد' : 'All football in one app'}
      </Text>
      <Text style={[styles.headline, isRTL && styles.textRtl]}>
        {isRTL ? (
          <>
            <Text style={styles.headlineAccent}>عيش </Text>
            <Text style={styles.headlineWhite}>شغفك</Text>
          </>
        ) : (
          <>
            <Text style={styles.headlineAccent}>Live </Text>
            <Text style={styles.headlineWhite}>your passion</Text>
          </>
        )}
      </Text>
      <Text style={[styles.sub, isRTL && styles.textRtl]}>
        {isRTL
          ? 'توقع، شارك، اربح وانضم لعشاق كرة القدم'
          : 'Predict, share, win and join football fans'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 12,
    paddingHorizontal: 4,
    alignItems: 'flex-start',
    maxWidth: '72%',
  },
  heroRtl: {
    alignItems: 'flex-end',
    alignSelf: 'flex-end',
  },
  logo: {
    width: 64,
    height: 64,
    marginBottom: 6,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.82)',
    marginBottom: 10,
    textAlign: 'left',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 8,
    textAlign: 'left',
    lineHeight: 34,
  },
  headlineAccent: {
    color: '#c084fc',
    fontSize: 28,
    fontWeight: '800',
  },
  headlineWhite: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '800',
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    textAlign: 'left',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
