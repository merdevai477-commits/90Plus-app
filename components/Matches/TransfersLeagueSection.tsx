/**
 * Transfers League Section Component
 * Collapsible section showing transfers grouped by league
 */

import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, FlatList } from 'react-native';
import { Image } from 'expo-image';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Transfer } from '../../services/apiFootball';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';
import TransferCard from '../Transfers/TransferCard';

export interface TransfersLeagueSectionProps {
  leagueId: number;
  leagueName: string;
  leagueLogo?: string;
  transfers: Transfer[];
  onPlayerPress?: (transfer: Transfer) => void;
  onTeamPress?: (teamId: number) => void;
  index?: number;
}

const TransfersLeagueSection: React.FC<TransfersLeagueSectionProps> = React.memo(({
  leagueId,
  leagueName,
  leagueLogo,
  transfers,
  onPlayerPress,
  onTeamPress,
  index = 0,
}) => {
  const [isExpanded, setIsExpanded] = useState(false); // Default: collapsed
  const [shouldRenderContent, setShouldRenderContent] = useState(false);
  const rotation = useSharedValue(0); // Start at 0 (collapsed)

  useEffect(() => {
    rotation.value = withSpring(isExpanded ? 90 : 0, {
      damping: 15,
      stiffness: 200,
    });
    
    // Lazy render content only when expanded
    if (isExpanded && !shouldRenderContent) {
      setShouldRenderContent(true);
    }
  }, [isExpanded]);

  const arrowStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const toggleExpanded = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setIsExpanded(!isExpanded);
  };

  // Don't render if no transfers
  if (transfers.length === 0) {
    return null;
  }

  return (
    <View style={styles.container}>
      {/* League Header - Clickable */}
      <TouchableOpacity
        style={styles.header}
        onPress={toggleExpanded}
        activeOpacity={0.7}
      >
        {leagueLogo && (
          <Image
            source={{ uri: leagueLogo }}
            style={styles.leagueLogo}
            contentFit="contain"
            transition={200}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        )}
        <Text style={styles.leagueName} numberOfLines={1}>
          {leagueName}
        </Text>
        <View style={styles.transfersCountBadge}>
          <Text style={styles.transfersCountText}>{transfers.length}</Text>
        </View>
        <Animated.View style={arrowStyle}>
          <Ionicons
            name="chevron-forward"
            size={20}
            color={MATCH_DETAILS_COLORS.textSecondary}
          />
        </Animated.View>
      </TouchableOpacity>

      {/* Transfers List - Lazy rendered only when expanded */}
      {shouldRenderContent && isExpanded && (
        <View style={styles.transfersContainer}>
          <FlatList
            data={transfers}
            renderItem={({ item: transfer, index: transferIndex }) => (
              <TransferCard
                transfer={transfer}
                onPlayerPress={onPlayerPress}
                onTeamPress={onTeamPress}
                index={transferIndex}
              />
            )}
            keyExtractor={(transfer, index) => `${transfer.player.id}-${index}`}
            scrollEnabled={false}
            removeClippedSubviews={true}
            maxToRenderPerBatch={10}
            updateCellsBatchingPeriod={50}
            initialNumToRender={5}
            windowSize={10}
            contentContainerStyle={styles.transfersList}
            showsVerticalScrollIndicator={false}
          />
        </View>
      )}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.leagueId === nextProps.leagueId &&
    prevProps.transfers.length === nextProps.transfers.length
  );
});

TransfersLeagueSection.displayName = 'TransfersLeagueSection';

const styles = StyleSheet.create({
  container: {
    marginBottom: 12,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 4,
    gap: 10,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  leagueLogo: {
    width: 24,
    height: 24,
  },
  leagueName: {
    flex: 1,
    fontSize: 16,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    letterSpacing: 0.2,
  },
  transfersCountBadge: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    minWidth: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  transfersCountText: {
    fontSize: 12,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
  },
  transfersContainer: {
    overflow: 'hidden',
    paddingHorizontal: 4,
  },
  transfersList: {
    gap: 12,
    paddingTop: 8,
  },
});

export default TransfersLeagueSection;

