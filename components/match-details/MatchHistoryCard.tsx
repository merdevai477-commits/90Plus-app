/**
 * MatchHistoryCard Component
 * Displays archived match information including date, teams, score, and key stats.
 * 
 * Requirements: 6.5
 */

import React from 'react';
import {
  View,
  Text,
  Image,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';
import { Calendar, MapPin, Trophy } from 'lucide-react-native';
import { MatchArchive } from '../../services/matchArchiveService';

interface MatchHistoryCardProps {
  match: MatchArchive;
  onPress?: () => void;
}

/**
 * Format date for display
 */
const formatDate = (date: Date): string => {
  return new Intl.DateTimeFormat('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date);
};

/**
 * Get status display text
 */
const getStatusText = (status: MatchArchive['status']): string => {
  switch (status) {
    case 'FT': return 'Full Time';
    case 'AET': return 'After Extra Time';
    case 'PEN': return 'Penalties';
    case 'PST': return 'Postponed';
    case 'CANC': return 'Cancelled';
    case 'ABD': return 'Abandoned';
    case 'AWD': return 'Awarded';
    case 'WO': return 'Walkover';
    default: return status;
  }
};

const MatchHistoryCard: React.FC<MatchHistoryCardProps> = ({ match, onPress }) => {
  const cardContent = (
    <View style={styles.container}>
      {/* Header with league info */}
      <View style={styles.header}>
        <View style={styles.leagueInfo}>
          {match.league.logo && (
            <Image source={{ uri: match.league.logo }} style={styles.leagueLogo} />
          )}
          <Text style={styles.leagueName} numberOfLines={1}>
            {match.league.name}
          </Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{getStatusText(match.status)}</Text>
        </View>
      </View>

      {/* Teams and Score */}
      <View style={styles.matchContent}>
        {/* Home Team */}
        <View style={styles.team}>
          <Image source={{ uri: match.homeTeam.logo }} style={styles.teamLogo} />
          <Text style={styles.teamName} numberOfLines={2}>
            {match.homeTeam.name}
          </Text>
        </View>

        {/* Score */}
        <View style={styles.scoreContainer}>
          <Text style={styles.score}>{match.score.home}</Text>
          <Text style={styles.scoreDivider}>-</Text>
          <Text style={styles.score}>{match.score.away}</Text>
        </View>

        {/* Away Team */}
        <View style={styles.team}>
          <Image source={{ uri: match.awayTeam.logo }} style={styles.teamLogo} />
          <Text style={styles.teamName} numberOfLines={2}>
            {match.awayTeam.name}
          </Text>
        </View>
      </View>

      {/* Key Stats Row */}
      {match.statistics && (
        <View style={styles.statsRow}>
          {match.statistics.possession?.home && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Possession</Text>
              <Text style={styles.statValue}>
                {match.statistics.possession.home} - {match.statistics.possession.away}
              </Text>
            </View>
          )}
          {match.statistics.shots?.home !== null && match.statistics.shots?.home !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Shots</Text>
              <Text style={styles.statValue}>
                {match.statistics.shots.home} - {match.statistics.shots.away}
              </Text>
            </View>
          )}
          {match.statistics.corners?.home !== null && match.statistics.corners?.home !== undefined && (
            <View style={styles.statItem}>
              <Text style={styles.statLabel}>Corners</Text>
              <Text style={styles.statValue}>
                {match.statistics.corners.home} - {match.statistics.corners.away}
              </Text>
            </View>
          )}
        </View>
      )}

      {/* Footer with date and venue */}
      <View style={styles.footer}>
        <View style={styles.dateInfo}>
          <Calendar size={14} color="#666" />
          <Text style={styles.dateText}>{formatDate(match.date)}</Text>
        </View>
        {match.venue.name && (
          <View style={styles.venueInfo}>
            <MapPin size={14} color="#666" />
            <Text style={styles.venueText} numberOfLines={1}>
              {match.venue.name}
            </Text>
          </View>
        )}
      </View>
    </View>
  );

  if (onPress) {
    return (
      <TouchableOpacity activeOpacity={0.8} onPress={onPress}>
        {cardContent}
      </TouchableOpacity>
    );
  }

  return cardContent;
};


const styles = StyleSheet.create({
  container: {
    backgroundColor: '#1a1a1a',
    borderRadius: 16,
    marginBottom: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#333',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  leagueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  leagueLogo: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  leagueName: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  statusBadge: {
    backgroundColor: '#22c55e',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: '700',
  },
  matchContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  team: {
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  teamLogo: {
    width: 44,
    height: 44,
    borderRadius: 22,
  },
  teamName: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  scoreContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 16,
  },
  score: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
  },
  scoreDivider: {
    fontSize: 20,
    color: '#666',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
    marginBottom: 12,
  },
  statItem: {
    alignItems: 'center',
    gap: 4,
  },
  statLabel: {
    color: '#666',
    fontSize: 10,
    fontWeight: '500',
  },
  statValue: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  dateInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  dateText: {
    color: '#666',
    fontSize: 11,
  },
  venueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    flex: 1,
    justifyContent: 'flex-end',
  },
  venueText: {
    color: '#666',
    fontSize: 11,
    maxWidth: 120,
  },
});

export default React.memo(MatchHistoryCard);
