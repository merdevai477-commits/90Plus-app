import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { RadioTower, FileText, BarChart2 } from 'lucide-react-native';
import { AUTH_ACCENT } from './AuthTokens';
import { TEXT_PRIMARY, TEXT_SECONDARY } from '../../../constants/tokens';

const FEATS = [
  { Icon: RadioTower, label: 'Live Scores' },
  { Icon: FileText, label: 'Breaking\nNews' },
  { Icon: BarChart2, label: 'Stats &\nAnalysis' },
];

export function AuthHeroBlock({ compact }: { compact?: boolean }) {
  return (
    <View style={[styles.hero, compact && styles.heroCompact]}>
      {!compact ? (
        <>
          <Text style={styles.hl1}>All Football.</Text>
          <Text style={styles.hlPurple}>One App.</Text>
          <Text style={styles.sub}>
            Live scores, breaking news{'\n'}
            and match updates from{'\n'}
            leagues worldwide.
          </Text>
        </>
      ) : (
        <Text style={styles.loginTitle}>Login</Text>
      )}

      {!compact && (
        <View style={styles.rowFeats}>
          {FEATS.map(({ Icon, label }) => (
            <View style={styles.feat} key={label}>
              <View style={styles.featIcon}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(124,58,237,0.45)' }]} />
                <Icon color="#FFFFFF" size={20} strokeWidth={1.5} />
              </View>
              <Text style={styles.featLbl}>{label}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { paddingTop: 85, paddingBottom: 35, paddingHorizontal: 16 },
  heroCompact: { paddingTop: 60, paddingBottom: 15 },
  hl1: { fontSize: 34, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -1, lineHeight: 40, textAlign: 'left' },
  hlPurple: { fontSize: 34, fontWeight: '800', color: AUTH_ACCENT, letterSpacing: -1, marginBottom: 4, lineHeight: 40, textAlign: 'left' },
  sub: { fontSize: 14, lineHeight: 20, color: TEXT_SECONDARY, opacity: 0.95, textAlign: 'left', maxWidth: 340, marginBottom: 20 },
  loginTitle: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.5, textAlign: 'left', marginBottom: 4 },
  rowFeats: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 12,
    gap: 24,
  },
  feat: { alignItems: 'center', gap: 8, width: 72 },
  featIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
    overflow: 'hidden',
  },
  featLbl: { fontSize: 10, fontWeight: '700', color: TEXT_SECONDARY, textAlign: 'center', lineHeight: 13 },
});
