/**
 * Transfer Card Component
 * Displays a single transfer with player info and transfer details
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Transfer } from '../../services/apiFootball';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';

interface TransferCardProps {
  transfer: Transfer;
  index?: number;
  onPlayerPress?: (transfer: Transfer) => void;
  onTeamPress?: (teamId: number) => void;
}

const TransferCard: React.FC<TransferCardProps> = React.memo(({
  transfer,
  index = 0,
  onPlayerPress,
  onTeamPress,
}) => {
  return (
    <View style={styles.transferCard}>
      <View style={styles.transferHeader}>
        <TouchableOpacity
          onPress={(e) => {
            e.stopPropagation();
            onPlayerPress?.(transfer);
          }}
        >
          <Image
            source={{ uri: transfer.player.photo }}
            style={styles.playerPhoto}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
          />
        </TouchableOpacity>
        <View style={styles.playerInfo}>
          <TouchableOpacity
            onPress={(e) => {
              e.stopPropagation();
              onPlayerPress?.(transfer);
            }}
          >
            <Text style={styles.playerName}>{transfer.player.name}</Text>
          </TouchableOpacity>
          <Text style={styles.transferDate}>{transfer.update}</Text>
        </View>
      </View>

      {transfer.transfers.map((t, tIndex) => (
        <View key={tIndex} style={styles.transferDetails}>
          {t.teams.out && (
            <TouchableOpacity
              style={styles.teamBox}
              onPress={(e) => {
                e.stopPropagation();
                onTeamPress?.(t.teams.out!.id);
              }}
            >
              <Image
                source={{ uri: t.teams.out.logo }}
                style={styles.teamLogo}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
              <Text style={styles.teamName} numberOfLines={2}>
                {t.teams.out.name}
              </Text>
            </TouchableOpacity>
          )}

          <View style={styles.transferArrow}>
            <Ionicons name="arrow-forward" size={24} color={MATCH_DETAILS_COLORS.accent} />
            <Text style={styles.transferType}>{t.type}</Text>
            {t.date && <Text style={styles.transferDateSmall}>{t.date}</Text>}
          </View>

          {t.teams.in && (
            <TouchableOpacity
              style={styles.teamBox}
              onPress={(e) => {
                e.stopPropagation();
                onTeamPress?.(t.teams.in!.id);
              }}
            >
              <Image
                source={{ uri: t.teams.in.logo }}
                style={styles.teamLogo}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
                placeholder={{ blurhash: 'L6PZfSi_.AyE_3t7t7R**0o#DgR4' }}
              />
              <Text style={styles.teamName} numberOfLines={2}>
                {t.teams.in.name}
              </Text>
            </TouchableOpacity>
          )}
        </View>
      ))}
    </View>
  );
}, (prevProps, nextProps) => {
  return (
    prevProps.transfer.player.id === nextProps.transfer.player.id &&
    prevProps.transfer.transfers.length === nextProps.transfer.transfers.length
  );
});

TransferCard.displayName = 'TransferCard';

const styles = StyleSheet.create({
  transferCard: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderRadius: 20,
    padding: 16,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  transferHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  playerPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    fontSize: 16,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
    marginBottom: 4,
  },
  transferDate: {
    fontSize: 12,
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  transferDetails: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: MATCH_DETAILS_COLORS.border,
  },
  teamBox: {
    flex: 1,
    alignItems: 'center',
  },
  teamLogo: {
    width: 40,
    height: 40,
    marginBottom: 8,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    borderRadius: 20,
  },
  teamName: {
    fontSize: 11,
    color: MATCH_DETAILS_COLORS.text,
    textAlign: 'center',
    fontWeight: '500',
  },
  transferArrow: {
    alignItems: 'center',
    marginHorizontal: 12,
    minWidth: 80,
  },
  transferType: {
    fontSize: 10,
    color: MATCH_DETAILS_COLORS.accent,
    fontWeight: '600',
    marginTop: 4,
    textAlign: 'center',
  },
  transferDateSmall: {
    fontSize: 9,
    color: MATCH_DETAILS_COLORS.textSecondary,
    marginTop: 2,
  },
});

export default TransferCard;

