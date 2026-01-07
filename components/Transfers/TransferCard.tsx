/**
 * Transfer Card Component
 * Enhanced design matching MatchCard with detailed transfer information
 * Each card has a color based on transfer type
 */

import React, { useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useAnimatedStyle,
  withSpring,
  useSharedValue,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { Transfer } from '../../services/apiFootball';
import { MATCH_DETAILS_COLORS, ANIMATION_CONFIG } from '../../constants/matchDetailsColors';

interface TransferCardProps {
  transfer: Transfer;
  index?: number;
  onPlayerPress?: (transfer: Transfer) => void;
  onTeamPress?: (teamId: number) => void;
}

// Transfer type colors
const TRANSFER_TYPE_COLORS = {
  free: {
    bg: 'rgba(34, 197, 94, 0.15)', // Green
    border: 'rgba(34, 197, 94, 0.4)',
    text: '#22c55e',
    gradient: ['rgba(34, 197, 94, 0.1)', 'transparent'],
  },
  loan: {
    bg: 'rgba(59, 130, 246, 0.15)', // Blue
    border: 'rgba(59, 130, 246, 0.4)',
    text: '#3b82f6',
    gradient: ['rgba(59, 130, 246, 0.1)', 'transparent'],
  },
  transfer: {
    bg: 'rgba(168, 85, 247, 0.15)', // Purple
    border: 'rgba(168, 85, 247, 0.4)',
    text: '#a855f7',
    gradient: ['rgba(168, 85, 247, 0.1)', 'transparent'],
  },
  sale: {
    bg: 'rgba(239, 68, 68, 0.15)', // Red
    border: 'rgba(239, 68, 68, 0.4)',
    text: '#ef4444',
    gradient: ['rgba(239, 68, 68, 0.1)', 'transparent'],
  },
  purchase: {
    bg: 'rgba(245, 158, 11, 0.15)', // Amber
    border: 'rgba(245, 158, 11, 0.4)',
    text: '#f59e0b',
    gradient: ['rgba(245, 158, 11, 0.1)', 'transparent'],
  },
  default: {
    bg: 'rgba(255, 255, 255, 0.05)',
    border: 'rgba(255, 255, 255, 0.1)',
    text: MATCH_DETAILS_COLORS.textTertiary,
    gradient: ['rgba(255, 255, 255, 0.02)', 'transparent'],
  },
} as const;

// Helper to detect transfer type from type string
const getTransferType = (type?: string): keyof typeof TRANSFER_TYPE_COLORS => {
  if (!type) return 'default';
  const typeLower = type.toLowerCase();
  
  if (typeLower.includes('free') || typeLower === 'عارية' || typeLower === 'حر') {
    return 'free';
  }
  if (typeLower.includes('loan') || typeLower === 'إعارة' || typeLower === 'اعاره') {
    return 'loan';
  }
  if (typeLower.includes('transfer') && !typeLower.includes('free')) {
    return 'transfer';
  }
  if (typeLower.includes('sale') || typeLower === 'بيع') {
    return 'sale';
  }
  if (typeLower.includes('purchase') || typeLower === 'شراء' || typeLower === 'buy')) {
    return 'purchase';
  }
  
  return 'default';
};

// Helper to format transfer value
const formatTransferValue = (value?: string | number | null): string => {
  if (!value) return 'N/A';
  
  const numValue = typeof value === 'string' 
    ? parseFloat(value.replace(/[^0-9.]/g, '')) 
    : value;
  
  if (isNaN(numValue)) return value.toString();
  
  if (numValue >= 1000000) {
    return `€${(numValue / 1000000).toFixed(2)}M`;
  }
  if (numValue >= 1000) {
    return `€${(numValue / 1000).toFixed(0)}K`;
  }
  return `€${numValue.toFixed(0)}`;
};

// Helper to parse date (supports YYMMDD and YYYY-MM-DD formats)
const parseTransferDate = (date?: string): string => {
  if (!date) return '';
  
  // If already in YYYY-MM-DD format
  if (date.includes('-')) {
    const d = new Date(date);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  // YYMMDD format
  if (date.length === 6) {
    const year = parseInt(date.substring(0, 2)) + 2000;
    const month = parseInt(date.substring(2, 4)) - 1;
    const day = parseInt(date.substring(4, 6));
    const d = new Date(year, month, day);
    return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
  }
  
  return date;
};

const TransferCard: React.FC<TransferCardProps> = React.memo(({
  transfer,
  index = 0,
  onPlayerPress,
  onTeamPress,
}) => {
  const scale = useSharedValue(1);
  
  // Get the latest transfer for display (most recent)
  const latestTransfer = transfer.transfers && transfer.transfers.length > 0 
    ? transfer.transfers[transfer.transfers.length - 1]
    : null;
  
  // Determine transfer type from latest transfer
  const transferTypeKey = useMemo(() => 
    getTransferType(latestTransfer?.type), 
    [latestTransfer?.type]
  );
  
  const typeColors = TRANSFER_TYPE_COLORS[transferTypeKey];

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onPlayerPress) {
      onPlayerPress(transfer);
    }
  };

  const handlePressIn = () => {
    scale.value = withSpring(0.96, ANIMATION_CONFIG.spring);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, ANIMATION_CONFIG.spring);
  };

  const handleTeamPress = (teamId: number | null | undefined, e: any) => {
    if (!teamId) return;
    e?.stopPropagation();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onTeamPress) {
      onTeamPress(teamId);
    }
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  // Get transfer value (from type string or value field)
  const transferValue = latestTransfer?.type 
    ? (latestTransfer.type.includes('€') || latestTransfer.type.includes('M') || latestTransfer.type.includes('K')
        ? latestTransfer.type 
        : null)
    : null;
  
  const hasValue = transferValue !== null && transferValue !== 'N/A' && transferValue !== 'Free';

  return (
    <Animated.View style={[animatedStyle, { marginBottom: 12 }]}>
      <TouchableOpacity
        activeOpacity={0.9}
        onPress={handlePress}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        style={[
          styles.container,
          {
            backgroundColor: typeColors.bg,
            borderColor: typeColors.border,
          },
        ]}
      >
        {/* Glass effect background */}
        <BlurView intensity={15} tint="dark" style={StyleSheet.absoluteFill} />

        {/* Gradient overlay for transfer type */}
        <LinearGradient
          colors={typeColors.gradient}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        {/* League Header */}
        {transfer.league?.name && (
          <View style={styles.leagueHeader}>
            {transfer.league.logo && (
              <Image
                source={{ uri: transfer.league.logo }}
                style={styles.leagueLogo}
                contentFit="contain"
                transition={100}
                cachePolicy="memory-disk"
                recyclingKey={transfer.league.id?.toString() || 'league'}
              />
            )}
            <Text style={styles.leagueName} numberOfLines={1}>
              {transfer.league.name}
            </Text>
          </View>
        )}

        {/* Transfer Type Badge */}
        <View style={styles.typeBadgeContainer}>
          <View style={[styles.typeBadge, { backgroundColor: typeColors.border }]}>
            <Text style={[styles.typeText, { color: typeColors.text }]}>
              {latestTransfer?.type || 'Transfer'}
            </Text>
          </View>
          
          {/* Transfer Date */}
          {latestTransfer?.date && (
            <Text style={styles.dateText}>
              {parseTransferDate(latestTransfer.date)}
            </Text>
          )}
        </View>

        {/* Player Section */}
        <View style={styles.playerSection}>
          <TouchableOpacity
            style={styles.playerPhotoContainer}
            onPress={(e) => {
              e.stopPropagation();
              handlePress();
            }}
            activeOpacity={0.8}
          >
            {transfer.player.photo ? (
              <Image
                source={{ uri: transfer.player.photo }}
                style={styles.playerPhoto}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                recyclingKey={transfer.player.id.toString()}
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
            ) : (
              <View style={styles.playerPhotoPlaceholder}>
                <Ionicons name="person" size={32} color={MATCH_DETAILS_COLORS.textTertiary} />
              </View>
            )}
          </TouchableOpacity>
          
          <View style={styles.playerInfo}>
            <TouchableOpacity
              onPress={(e) => {
                e.stopPropagation();
                handlePress();
              }}
              activeOpacity={0.8}
            >
              <Text style={styles.playerName} numberOfLines={2}>
                {transfer.player.name}
              </Text>
            </TouchableOpacity>
            
            {/* Transfer Value */}
            {hasValue && (
              <View style={styles.valueContainer}>
                <Ionicons name="cash-outline" size={14} color={typeColors.text} />
                <Text style={[styles.valueText, { color: typeColors.text }]}>
                  {formatTransferValue(transferValue)}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Teams & Transfer Flow */}
        {latestTransfer && (
          <View style={styles.teamsRow}>
            {/* Out Team */}
            {latestTransfer.teams?.out ? (
              <TouchableOpacity
                style={styles.teamSection}
                onPress={(e) => handleTeamPress(latestTransfer.teams?.out?.id, e)}
                activeOpacity={0.8}
              >
                <View style={styles.teamLogoContainer}>
                  {latestTransfer.teams.out.logo ? (
                    <Image
                      source={{ uri: latestTransfer.teams.out.logo }}
                      style={styles.teamLogo}
                      contentFit="contain"
                      transition={200}
                      cachePolicy="memory-disk"
                      recyclingKey={latestTransfer.teams.out.id.toString()}
                      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    />
                  ) : (
                    <View style={styles.teamLogoPlaceholder}>
                      <Ionicons name="shirt-outline" size={24} color={MATCH_DETAILS_COLORS.textTertiary} />
                    </View>
                  )}
                </View>
                <Text style={styles.teamName} numberOfLines={2}>
                  {latestTransfer.teams.out.name}
                </Text>
                <Text style={styles.teamLabel}>From</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.teamSection}>
                <View style={styles.freeAgentBadge}>
                  <Ionicons name="person-outline" size={24} color={MATCH_DETAILS_COLORS.textTertiary} />
                </View>
                <Text style={styles.teamName} numberOfLines={2}>
                  Free Agent
                </Text>
                <Text style={styles.teamLabel}>From</Text>
              </View>
            )}

            {/* Transfer Arrow */}
            <View style={styles.transferArrowContainer}>
              <View style={[styles.transferArrow, { backgroundColor: typeColors.border }]}>
                <Ionicons 
                  name="arrow-forward" 
                  size={24} 
                  color={typeColors.text}
                />
              </View>
              {hasValue && (
                <Text style={[styles.transferValue, { color: typeColors.text }]}>
                  {formatTransferValue(transferValue)}
                </Text>
              )}
            </View>

            {/* In Team */}
            {latestTransfer.teams?.in ? (
              <TouchableOpacity
                style={styles.teamSection}
                onPress={(e) => handleTeamPress(latestTransfer.teams?.in?.id, e)}
                activeOpacity={0.8}
              >
                <View style={styles.teamLogoContainer}>
                  {latestTransfer.teams.in.logo ? (
                    <Image
                      source={{ uri: latestTransfer.teams.in.logo }}
                      style={styles.teamLogo}
                      contentFit="contain"
                      transition={200}
                      cachePolicy="memory-disk"
                      recyclingKey={latestTransfer.teams.in.id.toString()}
                      placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
                    />
                  ) : (
                    <View style={styles.teamLogoPlaceholder}>
                      <Ionicons name="shirt-outline" size={24} color={MATCH_DETAILS_COLORS.textTertiary} />
                    </View>
                  )}
                </View>
                <Text style={styles.teamName} numberOfLines={2}>
                  {latestTransfer.teams.in.name}
                </Text>
                <Text style={styles.teamLabel}>To</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.teamSection}>
                <View style={styles.freeAgentBadge}>
                  <Ionicons name="person-outline" size={24} color={MATCH_DETAILS_COLORS.textTertiary} />
                </View>
                <Text style={styles.teamName} numberOfLines={2}>
                  Free Agent
                </Text>
                <Text style={styles.teamLabel}>To</Text>
              </View>
            )}
          </View>
        )}

        {/* Multiple Transfers Indicator */}
        {transfer.transfers && transfer.transfers.length > 1 && (
          <View style={styles.multipleTransfersBadge}>
            <Ionicons name="repeat" size={12} color={MATCH_DETAILS_COLORS.textSecondary} />
            <Text style={styles.multipleTransfersText}>
              {transfer.transfers.length} transfers
            </Text>
          </View>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  // Custom comparison for React.memo
  return (
    prevProps.transfer.player.id === nextProps.transfer.player.id &&
    prevProps.transfer.transfers?.length === nextProps.transfer.transfers?.length &&
    prevProps.transfer.league?.id === nextProps.transfer.league?.id
  );
});

TransferCard.displayName = 'TransferCard';

const styles = StyleSheet.create({
  container: {
    borderRadius: 20,
    padding: 20,
    borderWidth: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 4,
    overflow: 'hidden',
    position: 'relative',
  },
  leagueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
    gap: 8,
  },
  leagueLogo: {
    width: 16,
    height: 16,
  },
  leagueName: {
    fontSize: 11,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  typeBadgeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  typeBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  typeText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dateText: {
    fontSize: 11,
    color: MATCH_DETAILS_COLORS.textSecondary,
    fontWeight: '500',
  },
  playerSection: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 16,
  },
  playerPhotoContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: MATCH_DETAILS_COLORS.border,
    overflow: 'hidden',
  },
  playerPhoto: {
    width: 64,
    height: 64,
  },
  playerPhotoPlaceholder: {
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
  },
  playerInfo: {
    flex: 1,
    gap: 8,
  },
  playerName: {
    fontSize: 18,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    lineHeight: 24,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  valueText: {
    fontSize: 14,
    fontWeight: '600',
  },
  teamsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  teamSection: {
    flex: 1,
    alignItems: 'center',
    gap: 10,
  },
  teamLogoContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: MATCH_DETAILS_COLORS.border,
    overflow: 'hidden',
  },
  teamLogo: {
    width: 44,
    height: 44,
  },
  teamLogoPlaceholder: {
    width: 56,
    height: 56,
    justifyContent: 'center',
    alignItems: 'center',
  },
  freeAgentBadge: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  teamName: {
    fontSize: 12,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.text,
    textAlign: 'center',
    maxWidth: 100,
    lineHeight: 16,
  },
  teamLabel: {
    fontSize: 10,
    color: MATCH_DETAILS_COLORS.textTertiary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    fontWeight: '500',
  },
  transferArrowContainer: {
    alignItems: 'center',
    gap: 6,
    minWidth: 60,
  },
  transferArrow: {
    width: 48,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  transferValue: {
    fontSize: 12,
    fontWeight: '700',
    textAlign: 'center',
  },
  multipleTransfersBadge: {
    position: 'absolute',
    top: 16,
    right: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  multipleTransfersText: {
    fontSize: 10,
    color: MATCH_DETAILS_COLORS.textSecondary,
    fontWeight: '600',
  },
});

export default TransferCard;
