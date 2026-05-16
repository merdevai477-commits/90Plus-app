import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { RadioTower, FileText, BarChart2 } from 'lucide-react-native';
import { AUTH_ACCENT } from './AuthTokens';
import { TEXT_PRIMARY, TEXT_MUTED, TEXT_SECONDARY } from '../../../constants/tokens';

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
          {FEATS.map(({ Icon, label }, i) => (
            <View style={styles.featWrap} key={label}>
              {i > 0 ? <View style={styles.sep} /> : null}
              <View style={styles.feat}>
                <View style={styles.featIcon}>
                  <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                  <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(124,58,237,0.45)' }]} />
                  <Icon color="#FFFFFF" size={20} strokeWidth={1.5} />
                </View>
                <Text style={styles.featLbl}>{label}</Text>
              </View>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    paddingTop: 85, // رفع النصوص والأيقونات للأعلى أكثر
    paddingBottom: 35, // مساحة بسيطة لمنع التداخل مع حقل الإدخال
    paddingHorizontal: 16,
  },
  heroCompact: { paddingTop: 60, paddingBottom: 15 },
  hl1: {
    fontSize: 34,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -1,
    lineHeight: 40,
    textAlign: 'left',
  },
  hlPurple: {
    fontSize: 34,
    fontWeight: '800',
    color: AUTH_ACCENT,
    letterSpacing: -1,
    marginBottom: 4,
    lineHeight: 40,
    textAlign: 'left',
  },
  sub: {
    fontSize: 14,
    lineHeight: 20,
    color: TEXT_SECONDARY,
    opacity: 0.95,
    textAlign: 'left',
    maxWidth: 340,
    marginBottom: 20,
  },
  loginTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.5,
    textAlign: 'left',
    marginBottom: 4,
  },
  rowFeats: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    flexWrap: 'wrap',
    marginTop: 15,
  },
  featWrap: { flexDirection: 'row', alignItems: 'center' },
  sep: {
    width: 1,
    height: 36,
    backgroundColor: 'rgba(255,255,255,0.12)',
    marginHorizontal: 8,
  },
  feat: {
    alignItems: 'center',
    gap: 6,
    minWidth: 55,
  },
  featIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(124,58,237,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
    elevation: 8,
    overflow: 'hidden',
  },
  featLbl: {
    fontSize: 10,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    lineHeight: 13,
  },
});