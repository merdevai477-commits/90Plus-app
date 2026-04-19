import React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { View, Text } from 'react-native';
import { TeamFormation } from './TeamFormation';
import { Team } from './types';
import { styles } from './homeStyles'; // Updated with team styles

interface TeamSectionProps {
  team: Team;
  onPlayerPress: () => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ team, onPlayerPress }) => {
  // homeStyles exports an untyped StyleSheet; narrow the keys we use here
  const s = styles as unknown as {
    section: ViewStyle;
    sectionHeader: ViewStyle;
    sectionTitle: TextStyle;
    teamOfMonthContainer: ViewStyle;
  };

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Team of the Month</Text>
      </View>
      <View style={s.teamOfMonthContainer}>
        <TeamFormation team={team} onPlayerPress={onPlayerPress} />
      </View>
    </View>
  );
};