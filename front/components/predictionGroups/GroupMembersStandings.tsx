/**
 * In-group member standings list.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GroupMember } from './data';
import { HomeLeaderboardRow } from './HomeLeaderboardRow';
import { PG, PG_RADII, usePGFonts } from './theme';
import { useTranslation } from '../../src/i18n';

export function GroupMembersStandings({
  isRTL,
  members,
  onMemberPress,
}: {
  isRTL: boolean;
  members: GroupMember[];
  onMemberPress?: (member: GroupMember) => void;
}) {
  const { medium } = usePGFonts();
  const { t } = useTranslation();

  if (members.length === 0) {
    return (
      <Text style={[styles.empty, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
        {t.predictionGroups.leaderboard.emptyNudge}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {members.map((m) => (
        <View key={m.userId ?? `${m.rank}-${m.name}`} style={styles.card}>
          <HomeLeaderboardRow
            member={m}
            isRTL={isRTL}
            onPress={onMemberPress ? () => onMemberPress(m) : undefined}
          />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 24, gap: 8 },
  card: {
    borderRadius: PG_RADII.md,
    borderWidth: 1,
    borderColor: PG.border,
    backgroundColor: PG.card,
    overflow: 'hidden',
  },
  empty: {
    color: PG.textMuted,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
});
