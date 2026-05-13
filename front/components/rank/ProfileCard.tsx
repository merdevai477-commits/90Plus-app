import { LiquidGlassView, isLiquidGlassSupported } from '@/utils/liquidGlassSafe';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

const ACCENT = '#A855F7';

export default function ProfileCard() {
  const GlassContainer = isLiquidGlassSupported ? LiquidGlassView : BlurView;

  return (
    <GlassContainer
      intensity={18}
      tint="dark"
      effect="clear"
      interactive
      style={s.profileCard}
    >
      <View style={s.profileCardOverlay} />

      <View style={s.profileRow}>
        <View style={s.avatarWrap}>
          <Image
            source={{ uri: 'https://i.pravatar.cc/150?img=12' }}
            style={s.avatar}
          />
          <View style={s.avatarRing} />
        </View>

        <View style={s.profileInfo}>
          <View style={s.nameRow}>
            <Text style={s.username}>mr.dev</Text>
            <View style={s.verifiedBadge}>
              <Text style={s.verifiedTxt}>✓</Text>
            </View>
          </View>

          <View style={s.xpRow}>
            <View style={s.lvlBadge}>
              <Text style={s.lvlTxt}>Lv. 18</Text>
            </View>
            <View style={s.xpBarBg}>
              <LinearGradient
                colors={['#7C3AED', ACCENT]}
                style={s.xpBarFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              />
            </View>
            <Text style={s.xpLabel}>
              <Text style={s.xpCur}>2400</Text>
              <Text style={s.xpMax}> / 3000 XP</Text>
            </Text>
          </View>
        </View>
      </View>
    </GlassContainer>
  );
}

const s = StyleSheet.create({
  profileCard: {
    marginHorizontal: 12, borderRadius: 22, padding: 18,
    marginTop: 19, marginBottom: 0,
    backgroundColor: 'rgba(255,255,255,0.00)',
    borderWidth: 1, borderColor: 'rgba(69, 5, 128, 0.25)',
    overflow: 'hidden', zIndex: 1,
  },
  profileCardOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(80,20,160,0.00)', borderRadius: 22,
  },
  profileRow: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatarWrap: { position: 'relative' },
  avatar: { width: 68, height: 68, borderRadius: 34, backgroundColor: 'rgba(124,58,237,0.0)' },
  avatarRing: {
    position: 'absolute', top: -3, left: -3,
    width: 74, height: 74, borderRadius: 37,
    borderWidth: 2.5, borderColor: ACCENT,
  },
  profileInfo: { flex: 1, gap: 10 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  username: { color: '#fff', fontSize: 18, fontWeight: '800' },
  verifiedBadge: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: '#1D8CF8', alignItems: 'center', justifyContent: 'center',
  },
  verifiedTxt: { color: '#fff', fontSize: 11, fontWeight: '700' },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  lvlBadge: { backgroundColor: ACCENT, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  lvlTxt: { color: '#fff', fontSize: 11, fontWeight: '900' },
  xpBarBg: { flex: 1, height: 8, backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 6, overflow: 'hidden' },
  xpBarFill: { width: '80%', height: '100%' },
  xpLabel: { fontSize: 12 },
  xpCur: { color: ACCENT, fontWeight: '900' },
  xpMax: { color: 'rgba(255,255,255,0.4)', fontWeight: '600' },
});
