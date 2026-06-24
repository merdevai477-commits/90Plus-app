import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { BlurView } from 'expo-blur';
import { Radio, Sparkles, Brain } from 'lucide-react-native';
import { AUTH_ACCENT } from './AuthTokens';
import { TEXT_PRIMARY, TEXT_SECONDARY } from '../../../constants/tokens';

const FEATS = [
  { id: 'live-score', Icon: Radio, label: 'Live\nScore' },
  { id: 'ai-chat', Icon: Sparkles, label: 'AI\nChat' },
  { id: 'daily-quiz', Icon: Brain, label: 'Daily\nQuiz' },
] as const;

export function AuthHeroBlock({
  compact,
  title = 'Login',
  subtitle,
  embedded,
}: {
  compact?: boolean;
  title?: string;
  subtitle?: string;
  embedded?: boolean;
}) {
  return (
    <View
      style={[
        styles.hero,
        compact && styles.heroCompact,
        embedded && styles.heroEmbedded,
      ]}
    >
      {!compact ? (
        <>
          <Text style={styles.hl1}>All Football.</Text>
          <Text style={styles.hlPurple}>One App.</Text>
          <Text style={styles.sub}>
            Live scores, breaking news and match updates from leagues worldwide.
          </Text>
        </>
      ) : (
        <>
          <Text style={styles.loginTitle}>{title}</Text>
          {subtitle ? (
            <Text style={[styles.subCompact, embedded && styles.subCompactEmbedded]}>
              {subtitle}
            </Text>
          ) : null}
        </>
      )}

      {!compact && (
        <View style={styles.rowFeats}>
          {FEATS.map(({ id, Icon, label }) => (
            <View style={styles.feat} key={id}>
              <View style={styles.featIcon}>
                <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
                <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(124,58,237,0.45)' }]} />
                <Icon color="#FFFFFF" size={18} strokeWidth={1.5} />
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
  hero: { paddingTop: 8, paddingBottom: 0, paddingHorizontal: 4 },
  heroCompact: { paddingTop: 8, paddingBottom: 0 },
  heroEmbedded: { paddingTop: 0, paddingBottom: 12, paddingHorizontal: 0 },
  hl1: { fontSize: 28, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.8, lineHeight: 32, textAlign: 'left' },
  hlPurple: { fontSize: 28, fontWeight: '800', color: AUTH_ACCENT, letterSpacing: -0.8, marginBottom: 2, lineHeight: 32, textAlign: 'left' },
  sub: { fontSize: 13, lineHeight: 18, color: TEXT_SECONDARY, opacity: 0.95, textAlign: 'left', maxWidth: 320, marginBottom: 6 },
  subCompact: { fontSize: 13, lineHeight: 18, color: TEXT_SECONDARY, opacity: 0.95, textAlign: 'left', marginTop: 4, marginBottom: 0 },
  subCompactEmbedded: { marginBottom: 0 },
  loginTitle: { fontSize: 26, fontWeight: '800', color: TEXT_PRIMARY, letterSpacing: -0.5, textAlign: 'left', marginBottom: 0 },
  rowFeats: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'flex-start',
    marginTop: 4,
    gap: 18,
  },
  feat: { alignItems: 'center', gap: 6, width: 64 },
  featIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
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
