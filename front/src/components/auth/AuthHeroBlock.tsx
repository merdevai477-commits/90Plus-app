import React from 'react';
import { View, Text, Image, StyleSheet } from 'react-native';
import { useTranslation } from '@/src/i18n';

const logoImg = require('../../../assets/images/splash/splash-logo.png');

export function AuthHeroBlock() {
  const { isRTL } = useTranslation();

  return (
    <View style={[styles.hero, isRTL && styles.heroRtl]}>
      <Image source={logoImg} style={styles.logo} contentFit="contain" />
      <Text style={[styles.tagline, isRTL && styles.textRtl]}>
        {isRTL ? 'كل الكرة في تطبيق واحد' : 'All football in one app'}
      </Text>
      <Text style={[styles.headline, isRTL && styles.textRtl]}>
        {isRTL ? 'عيش شغفك' : 'Live your passion'}
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
    paddingTop: 72,
    paddingBottom: 24,
    paddingHorizontal: 20,
    alignItems: 'flex-start',
  },
  heroRtl: {
    alignItems: 'flex-end',
  },
  logo: {
    width: 72,
    height: 72,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.75)',
    marginBottom: 10,
    textAlign: 'left',
  },
  headline: {
    fontSize: 30,
    fontWeight: '800',
    color: '#fff',
    marginBottom: 6,
    textAlign: 'left',
  },
  sub: {
    fontSize: 15,
    lineHeight: 22,
    color: 'rgba(255,255,255,0.72)',
    maxWidth: 280,
    textAlign: 'left',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
