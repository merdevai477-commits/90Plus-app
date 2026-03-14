import React from 'react';
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
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <Text style={styles.sectionTitle}>Player of the Week</Text>
        <TouchableOpacity onPress={onViewAllPress}>
          <Text style={styles.viewAllText}>View All</Text>
        </TouchableOpacity>
      </View>
      {isLoading ? (
        <View style={styles.skeletonContainer}>
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
          contentContainerStyle={styles.horizontalList}
          // @ts-ignore - estimatedItemSize is valid but TypeScript definitions may be outdated
          estimatedItemSize={120}
        />
      )}
    </View>
  );
};