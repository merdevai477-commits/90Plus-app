import React from 'react';
import { View, Text } from 'react-native';
import { TeamFormation } from './TeamFormation';
import { Team } from './types';
import { styles } from './homeStyles';

interface TeamSectionProps {
  team: Team;
  onPlayerPress: () => void;
}

export const TeamSection: React.FC<TeamSectionProps> = ({ team, onPlayerPress }) => {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Team of the Month</Text>
      </View>
      <View style={styles.teamOfMonthContainer}>
        <TeamFormation team={team} onPlayerPress={onPlayerPress} />
      </View>
    </View>
  );
};