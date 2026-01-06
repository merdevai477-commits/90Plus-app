/**
 * League Section Component
 * Groups matches by league
 * 365Scores style
 */

import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';
import { COLORS } from '../reels/constants';
import { Match } from '../league-center/matchCardUtils';
import MatchCard from './MatchCard';

export interface LeagueSectionProps {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
  onMatchPress?: (matchId: string) => void;
}

const LeagueSection: React.FC<LeagueSectionProps> = ({
  leagueId,
  leagueName,
  leagueLogo,
  matches,
  onMatchPress,
}) => {
  if (matches.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* League Header */}
      <View style={styles.header}>
        {leagueLogo && (
          <Image
            source={{ uri: leagueLogo }}
            style={styles.leagueLogo}
            resizeMode="contain"
          />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>
          {leagueName}
        </Text>
        <View style={styles.matchCountBadge}>
          <Text style={styles.matchCountText}>{matches.length}</Text>
        </View>
      </View>

      {/* Matches List */}
      <View style={styles.matchesList}>
        {matches.map((match) => (
          <MatchCard
            key={match.id}
            match={match}
            onPress={onMatchPress}
          />
        ))}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 24,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 8,
    gap: 10,
  },
  leagueLogo: {
    width: 24,
    height: 24,
  },
  leagueName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  matchCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
    minWidth: 28,
    alignItems: 'center',
  },
  matchCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: COLORS.white,
  },
  matchesList: {
    paddingHorizontal: 0,
  },
});

export default LeagueSection;

