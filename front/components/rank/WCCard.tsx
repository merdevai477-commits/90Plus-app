/**
 * WCCard
 *
 * World Cup 2026 promo banner. During campaign mode the countdown is hidden
 * and the CTA opens the 90plus.pro/news WebView.
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
import { useAppFeaturesStore } from '../../src/stores/appFeaturesStore';
import { useRouter } from 'expo-router';

interface WCCardProps {
  onPressLocked?: () => void;
}

const WCCard: React.FC<WCCardProps> = ({ onPressLocked }) => {
  const router = useRouter();
  const worldCupEnabled = useAppFeaturesStore((s) => s.worldCupEnabled);
  const worldCupCampaignMode = useAppFeaturesStore((s) => s.worldCupCampaignMode);
  const hydrateFeatures = useAppFeaturesStore((s) => s.hydrate);
  const unlockAtMs = useAppFeaturesStore((s) => s.unlockAtMs);
  const [time, setTime] = useState<WorldCupTimeLeft>(() => getWorldCupTimeLeft(Date.now(), unlockAtMs));
  const isFocused = useIsFocused();
  const { t } = useTranslation();

  const isUnlocked = worldCupEnabled || worldCupCampaignMode;
  const showCountdown = !worldCupCampaignMode && !isUnlocked;

  useEffect(() => {
    if (!isFocused || worldCupCampaignMode) return;
    setTime(getWorldCupTimeLeft(Date.now(), unlockAtMs));
    const id = setInterval(() => {
      const next = getWorldCupTimeLeft(Date.now(), unlockAtMs);
      setTime(next);
      if (!worldCupEnabled && Date.now() >= unlockAtMs) {
        void hydrateFeatures(true);
      }
    }, 1_000);
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') {
        setTime(getWorldCupTimeLeft(Date.now(), unlockAtMs));
        if (!worldCupEnabled && Date.now() >= unlockAtMs) {
          void hydrateFeatures(true);
        }
      }
    });
    return () => {
      clearInterval(id);
      sub.remove();
    };
  }, [isFocused, unlockAtMs, worldCupCampaignMode, worldCupEnabled, hydrateFeatures]);

  const countdownItems: ReadonlyArray<{ val: number; lbl: string }> = [
    { val: time.days, lbl: t.rank.worldCup.days },
    { val: time.hours, lbl: t.rank.worldCup.hours },
    { val: time.mins, lbl: t.rank.worldCup.mins },
    { val: time.secs, lbl: t.rank.worldCup.secs },
  ];

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

      <View style={s.wcInner}>
        <View style={[s.wcLeft, !showCountdown && s.wcLeftFull]}>
          <Text style={s.wcTitle}>{t.rank.worldCup.headline}</Text>
          <Text style={s.wcSub}>{t.rank.worldCup.body}</Text>
          <Pressable
            onPress={() => {
              if (isUnlocked) {
                router.push('/world-cup-news');
                return;
              }
              onPressLocked?.();
            }}
            accessibilityRole="button"
            accessibilityLabel={isUnlocked ? t.rank.worldCup.openNews : t.rank.worldCup.comingSoon}
            style={({ pressed }) => [
              isUnlocked ? s.wcBtnGlow : s.wcBtnDisabled,
              pressed && { opacity: 0.9, transform: [{ scale: 0.98 }] },
            ]}
          >
            {isUnlocked ? (
              <LinearGradient
                colors={['#D8B4FE', '#A855F7', '#7E22CE']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={s.wcBtnGradient}
              >
                <Text style={s.wcBtnTxtActive}>{t.rank.worldCup.openNews}</Text>
                <ChevronRight size={15} color="#fff" strokeWidth={2.5} />
              </LinearGradient>
            ) : (
              <>
                <Text style={s.wcBtnTxt}>{t.rank.worldCup.comingSoon}</Text>
                <ChevronRight size={14} color="rgba(255,255,255,0.55)" />
              </>
            )}
          </Pressable>
        </View>

        {showCountdown ? (
          isLiquidGlassSupported ? (
            <LiquidGlassView effect="clear" interactive style={s.wcRight}>
              {countdownContent}
            </LiquidGlassView>
          ) : (
            <BlurView intensity={12} tint="dark" style={s.wcRight}>
              {countdownContent}
            </BlurView>
          )
        ) : null}
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
  wcLeftFull: ViewStyle;
  wcTitle: TextStyle;
  wcSub: TextStyle;
  wcBtnDisabled: ViewStyle;
  wcBtnGlow: ViewStyle;
  wcBtnGradient: ViewStyle;
  wcBtnTxt: TextStyle;
  wcBtnTxtActive: TextStyle;
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
  wcInner: { flexDirection: 'row', padding: 24, minHeight: 250, zIndex: 2 },
  wcLeft: { flex: 1, justifyContent: 'center', paddingEnd: 10, gap: 8 },
  wcLeftFull: { paddingEnd: 24 },
  wcTitle: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  wcSub: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
    marginBottom: 8,
  },
  wcBtnDisabled: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 18,
    alignSelf: 'flex-start',
    gap: 4,
    marginTop: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
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
  wcBtnTxt: { color: 'rgba(255,255,255,0.55)', fontWeight: '800', fontSize: 13 },
  wcBtnTxtActive: { color: '#fff', fontWeight: '900', fontSize: 14, letterSpacing: 0.3 },
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
