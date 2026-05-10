import { LiquidGlassView, isLiquidGlassSupported } from '@callstack/liquid-glass';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import React, { useEffect, useState } from 'react';
import {
  Image,
  ImageStyle,
  StyleSheet,
  Text,
  TextStyle,
  TouchableOpacity,
  View,
  ViewStyle,
} from 'react-native';

const WC_DATE = new Date('2026-06-11T00:00:00').getTime();

function getTimeLeft() {
  const diff = WC_DATE - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, mins: 0, secs: 0 };
  return {
    days: Math.floor(diff / 86400000),
    hours: Math.floor((diff % 86400000) / 3600000),
    mins: Math.floor((diff % 3600000) / 60000),
    secs: Math.floor((diff % 60000) / 1000),
  };
}

export const pad = (n: number) => String(n).padStart(2, '0');

interface WCCardProps {
  onPressSoon: () => void;
}

export default function WCCard({ onPressSoon }: WCCardProps) {
  const [t, setT] = useState(getTimeLeft());

  useEffect(() => {
    const id = setInterval(() => setT(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  const countdownItems = [
    { val: t.days, lbl: 'Days' },
    { val: t.hours, lbl: 'Hours' },
    { val: t.mins, lbl: 'Mins' },
    { val: t.secs, lbl: 'Secs' },
  ];

  return (
    <LinearGradient
      colors={['#1B103B', '#0A0818']}
      style={s.wcCard}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      {/* Player silhouette */}
      <Image
        source={require('../../assets/images/plear 90Plus.png')}
        style={s.wcPlayerImg}
        resizeMode="cover"
      />

      <View style={s.wcInner}>
        <View style={s.wcLeft}>
          <Text style={s.wcTitle}>Create{'\n'}Glory</Text>
          <Text style={s.wcSub}>
            Compete with others and reach{'\n'}the top of the leaderboard!
          </Text>
          <TouchableOpacity style={s.wcBtnDisabled} onPress={onPressSoon}>
            <Text style={s.wcBtnTxt}>Coming Soon</Text>
            <ChevronRight size={14} color="rgba(255,255,255,0.4)" />
          </TouchableOpacity>
        </View>

        {isLiquidGlassSupported ? (
          <LiquidGlassView effect="clear" interactive style={s.wcRight}>
            <Text style={s.cdLabel}>World Cup starts in</Text>
            <View style={s.cdRow}>
              {countdownItems.map((item) => (
                <View key={item.lbl} style={s.cdBlock}>
                  <Text style={s.cdNum}>{pad(item.val)}</Text>
                  <Text style={s.cdLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>
          </LiquidGlassView>
        ) : (
          <BlurView intensity={12} tint="dark" style={s.wcRight}>
            <Text style={s.cdLabel}>World Cup starts in</Text>
            <View style={s.cdRow}>
              {countdownItems.map((item) => (
                <View key={item.lbl} style={s.cdBlock}>
                  <Text style={s.cdNum}>{pad(item.val)}</Text>
                  <Text style={s.cdLbl}>{item.lbl}</Text>
                </View>
              ))}
            </View>
          </BlurView>
        )}
      </View>
    </LinearGradient>
  );
}

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
    marginHorizontal: 0, borderRadius: 0, marginTop: 20,
    overflow: 'hidden', borderWidth: 0, minHeight: 250, backgroundColor: '#0D0820',
  },
  wcPlayerImg: {
    position: 'absolute', right: 50, bottom: 0,
    width: '100%', height: '100%', opacity: 1,
    transform: [{ scale: 1.4 }, { translateY: -10 }],
  },
  wcInner: { flexDirection: 'row', padding: 24, minHeight: 250, zIndex: 2 },
  wcLeft: { flex: 1, justifyContent: 'center', paddingRight: 10, gap: 8 },
  wcTitle: { color: '#fff', fontSize: 24, fontWeight: '900', lineHeight: 30 },
  wcSub: { color: '#aaa', fontSize: 11, lineHeight: 17, marginTop: 4, marginBottom: 8 },
  wcBtnDisabled: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 14,
    paddingVertical: 11, paddingHorizontal: 18, alignSelf: 'flex-start',
    gap: 4, marginTop: 12, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  wcBtnTxt: { color: 'rgba(255,255,255,0.4)', fontWeight: '800', fontSize: 13 },
  wcRight: {
    position: 'absolute', bottom: 0, right: 0,
    backgroundColor: 'rgba(10, 10, 20, 0.00)',
    paddingHorizontal: 16, paddingVertical: 14,
    borderTopLeftRadius: 24, borderWidth: 1.5,
    borderRightWidth: 0, borderBottomWidth: 0,
    borderColor: 'rgba(255, 255, 255, 0.05)',
    zIndex: 3, shadowColor: '#000',
    shadowOffset: { width: -10, height: -10 }, shadowOpacity: 0.6, shadowRadius: 25,
    elevation: 20, overflow: 'hidden',
  },
  cdLabel: {
    color: 'rgba(255,255,255,0.5)', fontSize: 8, fontWeight: '700',
    marginBottom: 6, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.5,
  },
  cdRow: { flexDirection: 'row', gap: 10 },
  cdBlock: { alignItems: 'center', minWidth: 32 },
  cdNum: { color: '#fff', fontSize: 18, fontWeight: '800' },
  cdLbl: { color: 'rgba(255,255,255,0.4)', fontSize: 8, fontWeight: '700', marginTop: 1 },
});
