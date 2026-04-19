/**
 * Empty State Component
 * Professional empty states for all scenarios
 * Types: no_matches, no_search_results, no_favorites, no_predictions
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { Search, Heart, Target, Calendar } from 'lucide-react-native';

export type EmptyStateType = 'no_matches' | 'no_search_results' | 'no_favorites' | 'no_predictions';

interface EmptyStateProps {
  type?: EmptyStateType;
  title?: string;
  subtitle?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onPress: () => void;
  };
}

const EmptyState: React.FC<EmptyStateProps> = ({
  type = 'no_matches',
  title,
  subtitle,
  icon,
  action,
}) => {
  // Default content based on type
  const getDefaultContent = () => {
    switch (type) {
      case 'no_search_results':
        return {
          icon: <Search size={64} color="rgba(255, 255, 255, 0.3)" />,
          title: title || 'No Results Found',
          subtitle: subtitle || 'Try adjusting your search or filters',
          emoji: '🔍',
        };
      case 'no_favorites':
        return {
          icon: <Heart size={64} color="rgba(255, 255, 255, 0.3)" />,
          title: title || 'No Favorite Leagues',
          subtitle: subtitle || 'Tap the star icon to add leagues to your favorites',
          emoji: '⭐',
        };
      case 'no_predictions':
        return {
          icon: <Target size={64} color="rgba(255, 255, 255, 0.3)" />,
          title: title || 'No Predictions Yet',
          subtitle: subtitle || 'Make your first prediction on an upcoming match',
          emoji: '🎯',
        };
      default: // no_matches
        return {
          icon: <Calendar size={64} color="rgba(255, 255, 255, 0.3)" />,
          title: title || 'No Matches Available',
          subtitle: subtitle || 'Try selecting a different date or filter',
          emoji: '⚽',
        };
    }
  };

  const content = getDefaultContent();
  const displayIcon = icon || content.icon;
  const emoji = content.emoji;

  return (
    <Animated.View
      entering={FadeIn.duration(300).springify()}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Icon/Illustration */}
        <View style={styles.iconContainer}>
          {displayIcon}
          {emoji && (
            <Text style={styles.emoji} accessibilityLabel={type}>
              {emoji}
            </Text>
          )}
        </View>

        {/* Title */}
        <Text style={styles.title} accessibilityRole="header">
          {content.title}
        </Text>

        {/* Subtitle */}
        <Text style={styles.subtitle}>{content.subtitle}</Text>

        {/* Action Button */}
        {action && (
          <TouchableOpacity
            style={styles.actionButton}
            onPress={action.onPress}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel={action.label}
          >
            <LinearGradient
              colors={['#3B82F6', '#60A5FA']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.actionGradient}
            >
              <Text style={styles.actionText}>{action.label}</Text>
            </LinearGradient>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    minHeight: 300,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderRadius: 24,
    padding: 40,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderStyle: 'dashed',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  emoji: {
    fontSize: 48,
    position: 'absolute',
    top: -8,
    right: -8,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
    lineHeight: 28,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.6)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  actionButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginTop: 8,
  },
  actionGradient: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
  },
  actionText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default EmptyState;
