/**
 * LeaderboardRow — a single ranked member row.
 *
 *  - Ranks 1-3      → gold radial-gradient medal badge (RankBadge).
 *  - Rank 4+        → plain bold number.
 *  - Current user   → gold-tinted highlight surface + gold border.
 *  - Points         → animated count-up (AnimatedCounter, UI thread).
 *
 * Purely presentational: pass `isRTL` and the member data in. Layout/reorder
 * animation is applied by the parent list (Reanimated `itemLayoutAnimation`),
 * so rows slide to their new position instead of jumping.
 */

import React from 'react';
import { StyleSheet, Text, View, ViewStyle } from 'react-native';

import { AnimatedCounter } from './AnimatedCounter';
import type { GroupMember } from './data';
import { RankBadge } from './RankBadge';
import { PG, PG_RADII, usePGFonts } from './theme';

export interface LeaderboardRowProps {
  member: GroupMember;
  isRTL: boolean;
  /** Show the "n توقع صحيح" subtitle under the name. */
  showSubtitle?: boolean;
  /** Animate the points counter (disable for long off-screen lists if needed). */
  animatePoints?: boolean;
}

function initials(name: string): string {
  return name.trim().charAt(0);
}

export function LeaderboardRow({
  member,
  isRTL,
  showSubtitle = false,
  animatePoints = true,
}: LeaderboardRowProps) {
  const { medium, bold, extra } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };
  const align = isRTL ? 'right' : 'left';
  const me = member.isMe;

  return (
    <View style={[styles.row, row, me && styles.me]}>
      <RankBadge rank={member.rank} />

      <View style={[styles.avatar, me && styles.avatarMe]}>
        <Text style={[styles.avatarTxt, { fontFamily: bold }]}>{initials(member.name)}</Text>
      </View>

      <View style={styles.info}>
        <Text style={[styles.name, { fontFamily: bold, textAlign: align }]} numberOfLines={1}>
          {member.name}
          {me ? '  (أنت)' : ''}
        </Text>
        {showSubtitle && (
          <Text style={[styles.sub, { fontFamily: medium, textAlign: align }]} numberOfLines={1}>
            {member.correct} توقع صحيح
          </Text>
        )}
      </View>

      <View style={[styles.pointsBox, { alignItems: isRTL ? 'flex-start' : 'flex-end' }]}>
        {animatePoints ? (
          <AnimatedCounter
            value={member.points}
            style={[styles.points, { fontFamily: extra, color: me ? PG.gold : PG.text }]}
          />
        ) : (
          <Text style={[styles.points, { fontFamily: extra, color: me ? PG.gold : PG.text }]}>
            {member.points}
          </Text>
        )}
        <Text style={[styles.pointsLabel, { fontFamily: medium }]}>نقطة</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: PG_RADII.md,
    backgroundColor: PG.glass,
    borderWidth: 1,
    borderColor: PG.borderSoft,
  },
  me: {
    backgroundColor: PG.goldSoft,
    borderColor: 'rgba(245,185,66,0.55)',
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.30)',
  },
  avatarMe: { backgroundColor: 'rgba(245,185,66,0.28)' },
  avatarTxt: { color: '#fff', fontSize: 16 },
  info: { flex: 1, gap: 2 },
  name: { color: PG.text, fontSize: 14 },
  sub: { color: PG.textMuted, fontSize: 12 },
  pointsBox: { minWidth: 52 },
  points: { fontSize: 18, padding: 0, margin: 0, minWidth: 40, textAlign: 'right' },
  pointsLabel: { color: PG.textMuted, fontSize: 10, marginTop: -2 },
});
