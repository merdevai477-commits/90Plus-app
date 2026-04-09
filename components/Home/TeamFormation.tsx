import React from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity, Image } from 'react-native';
import { Team } from './types';
import { styles } from './homeStyles'; // Updated with team formation styles

interface TeamFormationProps {
  team: Team;
  onPlayerPress: () => void;
}

import TeamBadge from '../common/TeamBadge';

export const TeamFormation: React.FC<TeamFormationProps> = ({ team, onPlayerPress }) => {
  // homeStyles exports an untyped StyleSheet; narrow the keys we use here
  const s = styles as unknown as {
    fullWidthTeamCard: ViewStyle;
    teamHeader: ViewStyle;
    teamInfo: ViewStyle;
    teamName: TextStyle;
    teamFormation: TextStyle;
    largeFootballField: ViewStyle;
    fieldBackground: ViewStyle;
    centerCircle: ViewStyle;
    centerLine: ViewStyle;
    goalArea: ViewStyle;
    penaltyArea: ViewStyle;
    playerDot: ViewStyle;
    playerDotImage: ImageStyle;
    playerDotName: TextStyle;
  };

  return (
    <View style={s.fullWidthTeamCard}>
      <View style={s.teamHeader}>
        <TeamBadge name={team.name} size={50} color="transparent" />
        <View style={s.teamInfo}>
          <Text style={s.teamName}>{team.name}</Text>
          <Text style={s.teamFormation}>Formation: {team.formation}</Text>
        </View>
      </View>

      <View style={s.largeFootballField}>
        <View style={s.fieldBackground}>
          <View style={s.centerCircle} />
          <View style={s.centerLine} />
          <View style={s.goalArea} />
          <View style={s.penaltyArea} />
        </View>

        {team.players.map((player) => (
          <TouchableOpacity
            key={player.id}
            style={[
              s.playerDot,
              {
                left: `${player.x}%`,
                top: `${player.y}%`,
              },
            ]}
            onPress={onPlayerPress}
          >
            <Image source={{ uri: player.image }} style={s.playerDotImage} />
            <Text style={s.playerDotName}>{player.name.split(' ')[0]}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
};