import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Star, ChevronDown, ChevronUp } from 'lucide-react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  interpolate,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Match } from './matchCardUtils';
import LiveScoreMatchCard from './LiveScoreMatchCard';

interface CollapsibleLeagueSectionProps {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  matches: Match[];
  isFavorite?: boolean;
  onFavoriteToggle?: (leagueId: number) => void;
  onMatchPress?: (matchId: string) => void;
  startIndex?: number; // For staggered animations
}

const CollapsibleLeagueSection: React.FC<CollapsibleLeagueSectionProps> = ({
  leagueId,
  leagueName,
  leagueLogo,
  matches,
  isFavorite = false,
  onFavoriteToggle,
  onMatchPress,
  startIndex = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const rotation = useSharedValue(1);
  const height = useSharedValue(1);

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const newExpanded = !isExpanded;
    setIsExpanded(newExpanded);
    
    rotation.value = withSpring(newExpanded ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
    
    height.value = withSpring(newExpanded ? 1 : 0, {
      damping: 15,
      stiffness: 200,
    });
  };

  const handleFavoritePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (onFavoriteToggle) {
      onFavoriteToggle(leagueId);
    }
  };

  const chevronStyle = useAnimatedStyle(() => {
    const rotate = interpolate(rotation.value, [0, 1], [0, 180]);
    return {
      transform: [{ rotate: `${rotate}deg` }],
    };
  });

  const contentStyle = useAnimatedStyle(() => {
    const opacity = interpolate(height.value, [0, 1], [0, 1]);
    const scale = interpolate(height.value, [0, 1], [0.95, 1]);
    return {
      opacity,
      transform: [{ scale }],
      display: height.value === 0 ? 'none' : 'flex',
    };
  });

  return (
    <View style={styles.container}>
      {/* League Header */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.85}
      >
        <LinearGradient
          colors={isFavorite 
            ? ['rgba(255, 215, 0, 0.12)', 'rgba(255, 215, 0, 0.05)']
            : ['rgba(255, 255, 255, 0.06)', 'rgba(255, 255, 255, 0.02)']
          }
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={styles.headerGradient}
        >
          <View style={styles.headerLeft}>
            {leagueLogo && (
              <View style={styles.leagueLogoContainer}>
                <Image
                  source={{ uri: leagueLogo }}
                  style={styles.leagueLogo}
                  resizeMode="contain"
                />
              </View>
            )}
            <View style={styles.leagueInfo}>
              <Text style={styles.leagueName} numberOfLines={1}>
                {leagueName}
              </Text>
              <Text style={styles.matchCount}>
                {matches.length} {matches.length === 1 ? 'match' : 'matches'}
              </Text>
            </View>
          </View>

          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.favoriteButton}
              onPress={(e) => {
                e.stopPropagation();
                handleFavoritePress();
              }}
              activeOpacity={0.7}
            >
              <Star
                size={22}
                color={isFavorite ? '#FFD700' : 'rgba(255, 255, 255, 0.4)'}
                fill={isFavorite ? '#FFD700' : 'transparent'}
              />
            </TouchableOpacity>

            <Animated.View style={chevronStyle}>
              {isExpanded ? (
                <ChevronUp size={20} color="rgba(255, 255, 255, 0.6)" />
              ) : (
                <ChevronDown size={20} color="rgba(255, 255, 255, 0.6)" />
              )}
            </Animated.View>
          </View>
        </LinearGradient>
      </TouchableOpacity>

      {/* Matches Content */}
      <Animated.View style={[styles.content, contentStyle]}>
        {matches.map((match, index) => (
          <LiveScoreMatchCard
            key={match.id}
            match={match}
            index={startIndex + index}
            onPress={onMatchPress}
          />
        ))}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  header: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  headerGradient: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  leagueLogoContainer: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  leagueLogo: {
    width: 24,
    height: 24,
  },
  leagueInfo: {
    flex: 1,
    gap: 2,
  },
  leagueName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  matchCount: {
    fontSize: 11,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.5)',
    textTransform: 'lowercase',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  favoriteButton: {
    padding: 6,
    borderRadius: 20,
  },
  content: {
    gap: 0,
  },
});

export default CollapsibleLeagueSection;

