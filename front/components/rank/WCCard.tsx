/**
 * WCCard
 *
 * World Cup 2026 promo banner with a live countdown. The countdown interval
 * is anchored to the centralized `WC_2026_KICKOFF_UTC` constant and only
 * runs while the Rank tab is focused. When more than a day remains, we tick
 * every minute to avoid wasted re-renders; under a day we tick every second.
 */

import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { useIsFocused } from '@react-navigation/native';
import { BlurView } from 'expo-blur';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  AppState,
  type AppStateStatus,
  I18nManager,
  ImageStyle,
  Pressable,
  StyleSheet,
  Text,
  TextStyle,
  View,
  ViewStyle,
} from 'react-native';

import {
  getWorldCupTimeLeft,
  padCountdown,
  WorldCupTimeLeft,
} from '../../constants/worldCup';
import { useTranslation } from '../../src/i18n';

interface WCCardProps {
  onPressSoon: () => void;
}

const WCCard: React.FC<WCCardProps> = ({ onPressSoon }) => {
  const [time, setTime] = useState<WorldCupTimeLeft>(() => getWorldCupTimeLeft());
  const isFocused = useIsFocused();
  const { t } = useTranslation();

  useEffect(() => {
    if (!isFocused) return;
    setTime(getWorldCupTimeLeft());
    const id = setInterval(() => setTime(getWorldCupTimeLeft()), 1_000);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') setTime(getWorldCupTimeLeft());
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isFocused]);

  const countdownItems: ReadonlyArray<{ val: number; lbl: string }> = [
    { val: time.days, lbl: t.rank.worldCup.days },
    { val: time.hours, lbl: t.rank.worldCup.hours },
    { val: time.mins, lbl: t.rank.worldCup.mins },
    { val: time.secs, lbl: t.rank.worldCup.secs },
  ];

  const innerDirection = I18nManager.isRTL ? 'row-reverse' : 'row';
  const ctaDirection = I18nManager.isRTL ? 'row-reverse' : 'row';

  const countdownContent = (
    <>
      <Text style={s.cdLabel}>{t.rank.worldCup.countdownLabel}</Text>
      <View style={s.cdRow}>
        {countdownItems.map(item => (
          <View key={item.lbl} style={s.cdBlock}>
            <Text style={s.cdNum}>{padCountdown(item.val)}</Text>
            <Text style={s.cdLbl}>{item.lbl}</Text>
          </View>
        ))}
      </View>
    </>
  );

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

      <View style={[s.wcInner, { flexDirection: innerDirection }]}>
        <View style={s.wcLeft}>
          <Text style={s.wcTitle}>{t.rank.worldCup.headline}</Text>
          <Text style={s.wcSub}>{t.rank.worldCup.body}</Text>
          <Pressable
            onPress={onPressSoon}
            accessibilityRole="button"
            accessibilityLabel={t.rank.worldCup.comingSoon}
            style={({ pressed }) => [
              s.wcBtnDisabled,
              { flexDirection: ctaDirection },
              pressed && { opacity: 0.85 },
            ]}
          >
            <Text style={s.wcBtnTxt}>{t.rank.worldCup.comingSoon}</Text>
            <ChevronRight size={14} color="rgba(255,255,255,0.55)" />
          </Pressable>
        </View>

        {isLiquidGlassSupported ? (
          <LiquidGlassView effect="clear" interactive style={s.wcRight}>
            {countdownContent}
          </LiquidGlassView>
        ) : (
          <BlurView intensity={12} tint="dark" style={s.wcRight}>
            {countdownContent}
          </BlurView>
        )}
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
  wcBtnDisabled: ViewStyle;
  wcBtnTxt: TextStyle;
  wcRight: ViewStyle;
  cdLabel: TextStyle;
  cdRow: ViewStyle;
  cdBlock: ViewStyle;
  cdNum: TextStyle;
  cdLbl: TextStyle;
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
  wcInner: { padding: 24, minHeight: 250, zIndex: 2 },
  wcLeft: { flex: 1, justifyContent: 'center', paddingEnd: 10, gap: 8 },
  wcTitle: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  wcSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  wcBtnDisabled: {
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  wcBtnTxt: { color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 13 },
  wcRight: {
    position: 'absolute',
    bottom: 0,
    end: 0,
    backgroundColor: 'rgba(10, 10, 20, 0.00)',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderTopStartRadius: 24,
    borderWidth: 1.5,
    borderEndWidth: 0,
    borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 3,
    shadowColor: '#000',
    shadowOffset: { width: -10, height: -10 },
    shadowOpacity: 0.6,
    shadowRadius: 25,
    elevation: 20,
    overflow: 'hidden',
  },
  cdLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    fontWeight: '700',
    marginBottom: 6,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  cdRow: { flexDirection: 'row', gap: 10 },
  cdBlock: { alignItems: 'center', minWidth: 32 },
  cdNum: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cdLbl: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 8,
    fontWeight: '700',
    marginTop: 1,
  },
});
