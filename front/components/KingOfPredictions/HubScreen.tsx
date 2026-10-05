import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { ChevronLeft, Crown } from 'lucide-react-native';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { KingHeader } from './KingHeader';
import { KING_BG, KING_PURPLE, type KingRouteMode } from './shared';

const GAME_ART = require('../../assets/images/king-of-predictions/card-game.png');
const RESULTS_ART = require('../../assets/images/king-of-predictions/card-results.png');

export function KingHubScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();
  const fontExtra = useAppFont(800);
  const fontMedium = useAppFont(500);
  const fontSemi = useAppFont(600);
  const copy = t.kingPredictions;

  const open = (mode: KingRouteMode) => {
    router.push({ pathname: '/king-of-predictions/week', params: { mode } } as never);
  };

  return (
    <View style={styles.root}>
      <KingHeader />
      <ScrollView
        contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 88, paddingTop: 16 }}
        showsVerticalScrollIndicator={false}
      >
        <HubCard
          art={GAME_ART}
          title={copy.hubGameTitle}
          sub={copy.hubGameSub}
          cta={copy.predictNow}
          icon="crown"
          fonts={{ extra: fontExtra, medium: fontMedium, semi: fontSemi }}
          onPress={() => open('game')}
        />
        <HubCard
          art={RESULTS_ART}
          title={copy.hubResultsTitle}
          sub={copy.hubResultsSub}
          cta={copy.predictNow}
          icon="trophy"
          fonts={{ extra: fontExtra, medium: fontMedium, semi: fontSemi }}
          onPress={() => open('results')}
        />
      </ScrollView>
    </View>
  );
}

function HubCard({
  art,
  title,
  sub,
  cta,
  icon,
  fonts,
  onPress,
}: {
  art: number;
  title: string;
  sub: string;
  cta: string;
  icon: 'crown' | 'trophy';
  fonts: { extra: string; medium: string; semi: string };
  onPress: () => void;
}) {
  return (
    <Pressable accessibilityRole="button" onPress={onPress} style={styles.card}>
      {/* Art is drawn for a 404pt card; anchor right so narrow phones crop the gradient side, not the crown. */}
      <Image source={art} style={StyleSheet.absoluteFill} contentFit="cover" contentPosition="right center" />
      <LinearGradient
        colors={['#140334', 'rgba(20,3,52,0.92)', 'rgba(20,3,52,0.35)', 'transparent']}
        locations={[0, 0.42, 0.68, 1]}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <View style={styles.ornament}>
          <View style={styles.goldLine} />
          {icon === 'crown' ? <Crown size={14} color="#F6D36B" /> : <Text style={styles.trophy}>🏆</Text>}
          <View style={styles.goldLine} />
        </View>
        <Text
          style={[styles.title, { fontFamily: fonts.extra }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.75}
          maxFontSizeMultiplier={1.1}
        >
          {title}
        </Text>
        <Text style={[styles.sub, { fontFamily: fonts.medium }]} numberOfLines={2} maxFontSizeMultiplier={1.1}>
          {sub}
        </Text>
        <View style={styles.cta}>
          <ChevronLeft size={14} color="#fff" />
          <Text style={[styles.ctaText, { fontFamily: fonts.semi }]} maxFontSizeMultiplier={1.1}>{cta}</Text>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: KING_BG,
  },
  card: {
    marginHorizontal: 22,
    marginBottom: 21,
    height: 161,
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(27,15,57,0.49)',
    justifyContent: 'center',
  },
  copy: {
    width: 190,
    marginLeft: 28,
    alignItems: 'center',
  },
  ornament: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  goldLine: {
    width: 35,
    height: 1,
    backgroundColor: '#C29425',
  },
  trophy: {
    fontSize: 12,
  },
  title: {
    color: '#fff',
    fontSize: 28,
    textAlign: 'center',
  },
  sub: {
    color: '#BCBCBC',
    fontSize: 11,
    textAlign: 'center',
    marginTop: 2,
  },
  cta: {
    marginTop: 12,
    height: 26,
    paddingHorizontal: 10,
    borderRadius: 126,
    backgroundColor: KING_PURPLE,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  ctaText: {
    color: '#fff',
    fontSize: 10,
  },
});
