import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import TeamBadge from '../common/TeamBadge';
import {
  PURPLE_PRIMARY,
  PURPLE_GLOW,
  GLASS_CARD,
  GLASS_BORDER_SIDE,
  RADIUS_MD,
  TEXT_PRIMARY,
  TEXT_MUTED,
} from '../../constants/tokens';

interface TeamToggleTeam {
  name: string;
  logo?: string;
}

interface TeamToggleProps {
  home: TeamToggleTeam;
  away: TeamToggleTeam;
  value: 'home' | 'away';
  onChange: (side: 'home' | 'away') => void;
}

export const TeamToggle: React.FC<TeamToggleProps> = ({ home, away, value, onChange }) => {
  const renderButton = (side: 'home' | 'away', team: TeamToggleTeam) => {
    const isActive = value === side;
    return (
      <TouchableOpacity
        style={[styles.button, isActive && styles.buttonActive]}
        onPress={() => onChange(side)}
        activeOpacity={0.85}
        accessibilityRole="tab"
        accessibilityLabel={team.name}
        accessibilityState={{ selected: isActive }}
      >
        <TeamBadge name={team.name} logo={team.logo} size={44} color="transparent" />
        <Text
          style={[styles.label, isActive && styles.labelActive]}
          numberOfLines={1}
        >
          {team.name}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      {renderButton('home', home)}
      {renderButton('away', away)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 16,
  },
  button: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 16,
    borderRadius: RADIUS_MD,
    backgroundColor: GLASS_CARD,
    borderWidth: 1,
    borderColor: GLASS_BORDER_SIDE,
  },
  buttonActive: {
    borderColor: PURPLE_PRIMARY,
    borderWidth: 1.5,
    shadowColor: PURPLE_GLOW,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 4,
  },
  label: {
    color: TEXT_MUTED,
    fontSize: 13,
    fontWeight: '600',
    textAlign: 'center',
  },
  labelActive: {
    color: TEXT_PRIMARY,
    fontWeight: '700',
  },
});

export default TeamToggle;
