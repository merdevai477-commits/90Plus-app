import React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { PlayerCard } from './PlayerCard';
import { SkeletonLoader } from './SkeletonLoader';
import { Player } from './types';
import { styles } from './homeStyles';

interface PlayersSectionProps {
  players: Player[];
  isLoading: boolean;
  imageErrors: Set<string>;
  onImageError: (id: string) => void;
  onPlayerPress: () => void;
  onViewAllPress: () => void;
}

export const PlayersSection: React.FC<PlayersSectionProps> = ({
  players,
  isLoading,
  imageErrors,
  onImageError,
  onPlayerPress,
  onViewAllPress,
}) => {
  // homeStyles exports an untyped StyleSheet; narrow the keys we use here
  const s = styles as unknown as {
    section: ViewStyle;
    sectionHeader: ViewStyle;
    sectionTitle: TextStyle;
    viewAllText: TextStyle;
    skeletonContainer: ViewStyle;
    horizontalList: ViewStyle;
  };

  return (
    <View style={s.section}>
      <View style={s.sectionHeader}>
        <Text style={s.sectionTitle}>Player of the Week</Text>
        <TouchableOpacity onPress={onViewAllPress}>
          <Text style={s.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={s.skeletonContainer}>
          <SkeletonLoader width={140} height={160} style={{ marginRight: 16 }} />
          <SkeletonLoader width={140} height={160} />
        </View>
      ) : (
        <FlashList
          data={players}
          renderItem={({ item }) => (
            <PlayerCard
              item={item}
              onPress={onPlayerPress}
              imageError={imageErrors.has(item.id)}
              onImageError={() => onImageError(item.id)}
            />
          )}
          keyExtractor={(item) => item.id}
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={s.horizontalList}
        />
      )}
    </View>
  );
};