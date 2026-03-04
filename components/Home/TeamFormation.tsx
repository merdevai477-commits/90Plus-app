import React from 'react';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Team } from './types';
import { styles } from './homeStyles'; // Updated with team formation styles

interface TeamFormationProps {
  team: Team;
  onPlayerPress: () => void;
}

import TeamBadge from '../common/TeamBadge';

export const TeamFormation: React.FC<TeamFormationProps> = ({ team, onPlayerPress }) => {
  return (
    <View style={styles.fullWidthTeamCard}>
      <View style={styles.teamHeader}>
        <TeamBadge name={team.name} size={50} color="transparent" />
        <View style={styles.teamInfo}>
          <Text style={styles.teamName}>{team.name}</Text>
          <Text style={styles.teamFormation}>Formation: {team.formation}</Text>
        </View>
      </View>

      <View style={styles.largeFootballField}>
        <View style={styles.fieldBackground}>
          <View style={styles.centerCircle} />
          <View style={styles.centerLine} />
          <View style={styles.goalArea} />
          <View style={styles.penaltyArea} />
        </View>

        {team.players.map((player) => (
          <TouchableOpacity
            key={player.id}
            style={[
              styles.playerDot,
              {
                left: `${player.x}%`,
                top: `${player.y}%`,
              },
            ]}
            onPress={onPlayerPress}
          >
            <Image source={{ uri: player.image }} style={styles.playerDotImage} />
            <Text style={styles.playerDotName}>{player.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};