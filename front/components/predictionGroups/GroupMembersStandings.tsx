/**
 * In-group member standings list — Figma 601:4171.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { GroupMember } from './data';
import { GroupStandingsRow } from './GroupStandingsRow';
import { PG, usePGFonts } from './theme';
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
  const { t, direction } = useTranslation();

  if (members.length === 0) {
    return (
      <Text
        style={[
          styles.empty,
          {
            fontFamily: medium,
            textAlign: isRTL ? 'right' : 'left',
            writingDirection: direction,
          },
        ]}
      >
        {t.predictionGroups.leaderboard.emptyNudge}
      </Text>
    );
  }

  return (
    <View style={styles.list}>
      {members.map((m) => (
        <GroupStandingsRow
          key={m.userId ?? `${m.rank}-${m.name}`}
          member={m}
          isRTL={isRTL}
          onPress={onMemberPress ? () => onMemberPress(m) : undefined}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  list: {
    width: '100%',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 24,
    gap: 8,
  },
  empty: {
    color: PG.textMuted,
    fontSize: 13,
    paddingHorizontal: 20,
    paddingVertical: 24,
  },
});
