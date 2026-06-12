/**
 * WCCard
 *
 * World Cup 2026 promo banner on Rank. Opens the 90plus.pro/news WebView.
 * Countdown removed — news CTA is always available.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import React from 'react';
import {
  ImageStyle,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import { useTranslation } from '../../src/i18n';

const WCCard: React.FC = () => {
  const router = useRouter();
  const { t } = useTranslation();

  return (
    <LinearGradient
      colors={['#1B103B', '#0A0818']}
      style={s.wcCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <Image
        source={require('../../assets/images/plear 90Plus.png')}
        style={s.wcPlayerImg}
        contentFit="cover"
        cachePolicy="memory-disk"
      />

      <View style={s.wcInner}>
        <View style={s.wcLeft}>
          <Text style={s.wcTitle}>{t.rank.worldCup.headline}</Text>
          <Text style={s.wcSub}>{t.rank.worldCup.body}</Text>
          <Pressable
            onPress={() => router.push('/world-cup-news')}
            accessibilityRole="button"
            accessibilityLabel={t.rank.worldCup.openNews}
            style={({ pressed }) => [
              s.wcBtnGlow,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            <LinearGradient
              colors={['#D8B4FE', '#A855F7', '#7E22CE']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={s.wcBtnGradient}
            >
              <Text style={s.wcBtnTxtActive}>{t.rank.worldCup.openNews}</Text>
              <ChevronRight size={15} color="#fff" strokeWidth={2.5} />
            </LinearGradient>
          </Pressable>
        </View>
      </View>
    </LinearGradient>
  );
};

export default WCCard;

const s = StyleSheet.create<{
  wcCard: ViewStyle;
  wcPlayerImg: ImageStyle;
  wcInner: ViewStyle;
  wcLeft: ViewStyle;
  wcTitle: TextStyle;
  wcSub: TextStyle;
  wcBtnGlow: ViewStyle;
  wcBtnGradient: ViewStyle;
  wcBtnTxtActive: TextStyle;
}>({
  wcCard: {
    marginHorizontal: 0,
    borderRadius: 0,
    marginTop: 20,
    overflow: 'hidden',
    borderWidth: 0,
    minHeight: 250,
    backgroundColor: '#0D0820',
  },
  wcPlayerImg: {
    position: 'absolute',
    end: 50,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 1,
    transform: [{ scale: 1.4 }, { translateY: -10 }],
  },
  wcInner: { flexDirection: 'row', padding: 24, minHeight: 250, zIndex: 2 },
  wcLeft: { flex: 1, justifyContent: 'center', paddingEnd: 24, gap: 8 },
  wcTitle: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  wcSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  wcBtnGlow: {
    alignSelf: 'flex-start',
    marginTop: 14,
    borderRadius: 16,
    shadowColor: '#A855F7',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 14,
  },
  wcBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 13,
    paddingHorizontal: 20,
    borderRadius: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
  },
  wcBtnTxtActive: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
});
