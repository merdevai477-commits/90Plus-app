/**
 * GroupHeaderCard — group identity + invite block.
 *
 *  - Crest: purple gradient ball with an overlaid gold crown.
 *  - Name, members count, created date.
 *  - Invite-code card with a copy button (Clipboard) and a "دعوة أصدقاء" button
 *    (Share). Both fire haptics from the parent's handlers.
 *
 * Presentational — the parent owns the copy/share/haptic logic and passes
 * `onCopy` / `onInvite` + the `copied` flag in.
 */

import { LinearGradient } from 'expo-linear-gradient';
import { Check, Copy, Crown, Share2, Users } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { GlassCard } from './atoms';
import { PG, PG_GRADIENTS, PG_RADII, usePGFonts } from './theme';

export interface GroupHeaderCardProps {
  name: string;
  membersCount: number;
  createdAt: string;
  code: string;
  copied: boolean;
  onCopy: () => void;
  onInvite: () => void;
  isRTL: boolean;
}

export function GroupHeaderCard({
  name,
  membersCount,
  createdAt,
  code,
  copied,
  onCopy,
  onInvite,
  isRTL,
}: GroupHeaderCardProps) {
  const { medium, bold, extra } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';

  return (
    <GlassCard style={styles.card} radius={PG_RADII.xl}>
      <View style={[styles.identity, row]}>
        <View style={styles.crestWrap}>
          <LinearGradient
            colors={PG_GRADIENTS.purple}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.crest}
          >
            <Text style={styles.crestBall}>⚽</Text>
          </LinearGradient>
          <View style={styles.crown}>
            <Crown size={16} color="#3A2600" fill={PG.gold} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { fontFamily: extra, textAlign: align }]} numberOfLines={1}>
            {name}
          </Text>
          <View style={[styles.metaRow, row]}>
            <View style={[styles.metaItem, row]}>
              <Users size={13} color={PG.textMuted} />
              <Text style={[styles.meta, { fontFamily: medium }]}>{membersCount} عضو</Text>
            </View>
            <Text style={[styles.meta, { fontFamily: medium }]}>·</Text>
            <Text style={[styles.meta, { fontFamily: medium }]}>{createdAt}</Text>
          </View>
        </View>
      </View>

      <View style={[styles.inviteRow, row]}>
        <View style={[styles.codeBox, { alignItems: align === 'right' ? 'flex-end' : 'flex-start' }]}>
          <Text style={[styles.codeLabel, { fontFamily: medium, textAlign: align }]}>كود الدعوة</Text>
          <Text style={[styles.code, { fontFamily: bold, textAlign: align }]}>{code}</Text>
        </View>

        <Pressable
          onPress={onCopy}
          style={({ pressed }) => [styles.copyBtn, pressed && { opacity: 0.7 }]}
          accessibilityRole="button"
          accessibilityLabel="نسخ كود الدعوة"
        >
          {copied ? <Check size={18} color={PG.win} /> : <Copy size={18} color={PG.purpleSoft} />}
        </Pressable>
      </View>

      <Pressable
        onPress={onInvite}
        style={({ pressed }) => [pressed && { opacity: 0.92 }]}
        accessibilityRole="button"
        accessibilityLabel="دعوة أصدقاء"
      >
        <LinearGradient
          colors={PG_GRADIENTS.purple}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[styles.inviteBtn, row]}
        >
          <Share2 size={18} color="#fff" />
          <Text style={[styles.inviteTxt, { fontFamily: bold }]}>دعوة أصدقاء</Text>
        </LinearGradient>
      </Pressable>
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 16 },
  identity: { alignItems: 'center', gap: 14 },
  crestWrap: { width: 58, height: 58 },
  crest: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },
  crestBall: { fontSize: 26 },
  crown: {
    position: 'absolute',
    top: -6,
    alignSelf: 'center',
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  name: { color: PG.text, fontSize: 20 },
  metaRow: { alignItems: 'center', gap: 8, marginTop: 4, flexWrap: 'wrap' },
  metaItem: { alignItems: 'center', gap: 4 },
  meta: { color: PG.textMuted, fontSize: 12 },

  inviteRow: {
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: PG_RADII.md,
    borderWidth: 1,
    borderColor: PG.borderSoft,
    borderStyle: 'dashed',
    padding: 14,
  },
  codeBox: { flex: 1, gap: 2 },
  codeLabel: { color: PG.textMuted, fontSize: 11 },
  code: { color: PG.text, fontSize: 18, letterSpacing: 2 },
  copyBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(159,90,251,0.35)',
  },

  inviteBtn: {
    borderRadius: PG_RADII.md,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  inviteTxt: { color: '#fff', fontSize: 15 },
});
