import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Animated, { FadeInDown, SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import { useHaptic } from '../../hooks/useHaptic';
import GradientMatchCard, { UserPrediction } from './GradientMatchCard';
import { Match } from './matchCardUtils';

export interface LiveGamesSectionProps {
  matches: Match[];
  onSeeAllPress: () => void;
  onMatchPress: (matchId: string) => void;
  showPredictions?: boolean;
  userPredictions?: { [matchId: string]: UserPrediction };
  onPredictionSubmit?: (matchId: string, prediction: UserPrediction) => void;
  onFavoritePress?: (matchId: string) => void;
}

const CARD_HEIGHT = 180; // Fixed height (Card ~164 + Gap 16)

const AnimatedCard = ({ match, index, onPress, onFavoritePress, showPrediction, userPrediction, onPredictionSubmit }: any) => {
  return (
    <Animated.View
      entering={FadeInDown.delay(index * 100).springify()}
      style={{ marginBottom: 16 }}
    >
      <GradientMatchCard
        match={match}
        gradientIndex={index}
        onPress={onPress}
        onFavoritePress={onFavoritePress}
        showPrediction={showPrediction}
        userPrediction={userPrediction}
        onPredictionSubmit={onPredictionSubmit}
      />
    </Animated.View>
  );
};

const LiveGamesSection: React.FC<LiveGamesSectionProps> = ({
  matches,
  onSeeAllPress,
  onMatchPress,
  showPredictions = false,
  userPredictions = {},
  onPredictionSubmit,
  onFavoritePress,
}) => {
  const { trigger } = useHaptic();

  const handleSeeAllPress = () => {
    trigger('selection');
    onSeeAllPress();
  };

  // Separate live and upcoming matches
  const liveMatches = matches.filter((m) => m.status === 'live');
  const upcomingMatches = matches.filter((m) => m.status === 'upcoming');
  const finishedMatches = matches.filter((m) => m.status === 'finished');

  const renderMatchSection = (
    title: string,
    sectionMatches: Match[],
    startIndex: number
  ) => {
    if (sectionMatches.length === 0) return null;

    return (
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{title}</Text>
        <View style={styles.matchesList}>
          {sectionMatches.map((match, index) => (
            <AnimatedCard
              key={match.id}
              match={match}
              index={startIndex + index} // Use global index for continuous stacking
              onPress={() => onMatchPress(match.id)}
              onFavoritePress={onFavoritePress}
              showPrediction={showPredictions}
              userPrediction={userPredictions[match.id]}
              onPredictionSubmit={onPredictionSubmit}
            />
          ))}
        </View>
      </View>
    );
  };

  return (
    <View style={styles.container}>
      {/* Section Header */}
      <View style={styles.header}>
        <Text style={styles.title}>
          {showPredictions ? (
            <Text>Predictions <Text style={{ fontSize: 14, opacity: 0.6 }}>التوقعات</Text></Text>
          ) : "Live Games"}
        </Text>
        <TouchableOpacity
          onPress={handleSeeAllPress}
          activeOpacity={0.7}
        >
          <Text style={styles.seeAllText}>See All</Text>
        </TouchableOpacity>
      </View>

      {/* Match Sections */}
      {renderMatchSection('🔴 Live', liveMatches, 0)}
      {renderMatchSection('⏰ Upcoming', upcomingMatches, liveMatches.length)}
      {renderMatchSection('✅ Finished', finishedMatches, liveMatches.length + upcomingMatches.length)}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 8,
    paddingHorizontal: 4, // Reduced from 20 to make cards wider
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  seeAllText: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.5)',
    fontWeight: '500',
  },
  section: {
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
    marginBottom: 12,
  },
  matchesList: {
    gap: 14,
  },
});

export default LiveGamesSection;
