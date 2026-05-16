import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import { Bell, Shield, HelpCircle, ChevronRight } from 'lucide-react-native';
import { MainShell } from '../../components/shell/MainShell';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_SOFT,
  SCREEN_PADDING_H,
  GRADIENT_HERO_PURPLE_BLUE,
  BORDER_ARENA,
  RADIUS_LG,
  PURPLE_GLOW_SM,
} from '../../../constants/tokens';

export default function SettingsScreen() {
  const router = useRouter();
  const [pushMatch, setPushMatch] = useState(true);
  const [pushQuiz, setPushQuiz] = useState(true);
  const [quietHours, setQuietHours] = useState(false);

  return (
    <MainShell
      title="Settings"
      subtitle="Local preferences only until accounts and sync ship."
      onBackPress={() => router.back()}
    >
      <View style={styles.hero}>
        <LinearGradient
          colors={[...GRADIENT_HERO_PURPLE_BLUE]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.heroEyebrow}>Control center</Text>
        <Text style={styles.heroTitle}>Alerts & app behavior</Text>
      </View>

      <Text style={styles.section}>Notifications</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={() => router.push('/notifications')}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <Bell size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View>
            <Text style={styles.linkTitle}>Notification inbox</Text>
            <Text style={styles.linkSub}>View mock alerts and history</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <View style={styles.switchCard}>
        <RowToggle
          label="Match reminders"
          sub="Kickoffs and score bursts"
          value={pushMatch}
          onValueChange={setPushMatch}
        />
        <View style={styles.divider} />
        <RowToggle
          label="Quiz & streak nudges"
          sub="Daily ladder prompts"
          value={pushQuiz}
          onValueChange={setPushQuiz}
        />
        <View style={styles.divider} />
        <RowToggle
          label="Quiet hours"
          sub="Mute non-critical alerts overnight"
          value={quietHours}
          onValueChange={setQuietHours}
        />
      </View>

      <Text style={styles.section}>Support & data</Text>

      <TouchableOpacity activeOpacity={0.88} style={styles.staticRow}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <HelpCircle size={18} color="#93c5fd" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Help center</Text>
            <Text style={styles.linkSub}>Coming soon — FAQs and chat support</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.staticRow, { marginTop: 8 }]}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(245,197,24,0.12)' }]}>
            <Shield size={18} color="#fcd34d" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>Privacy & data</Text>
            <Text style={styles.linkSub}>Export and deletion tools hook here later</Text>
          </View>
        </View>
      </TouchableOpacity>
    </MainShell>
  );
}

function RowToggle({
  label,
  sub,
  value,
  onValueChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(124,58,237,0.55)' }}
        thumbColor={value ? '#f4f4f5' : 'rgba(255,255,255,0.35)'}
        ios_backgroundColor="rgba(255,255,255,0.12)"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginHorizontal: -SCREEN_PADDING_H,
    marginBottom: 20,
    paddingHorizontal: SCREEN_PADDING_H,
    paddingVertical: 16,
    borderRadius: RADIUS_LG,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
  },
  heroEyebrow: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.35,
  },

  section: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 12,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  linkSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },

  switchCard: {
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingVertical: 4,
    marginBottom: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  toggleSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_ARENA,
    marginLeft: 12,
    marginRight: 12,
  },

  staticRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
});
