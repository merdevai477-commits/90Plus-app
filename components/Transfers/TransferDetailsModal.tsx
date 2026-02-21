import React, { useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Transfer } from '../../services/apiFootball';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamBadge from '../common/TeamBadge';
import LeagueIcon from '../common/LeagueIcon';

interface TransferDetailsModalProps {
  visible: boolean;
  onClose: () => void;
  transfer: Transfer | null;
  relatedTransfers?: Transfer[];
  onPlayerPress?: (transfer: Transfer) => void;
  onTeamPress?: (teamId: number) => void;
  onShare?: (transfer: Transfer) => void;
  onFavorite?: (transferId: number) => void;
  isFavorite?: boolean;
}

export const TransferDetailsModal: React.FC<TransferDetailsModalProps> = ({
  visible,
  onClose,
  transfer,
  relatedTransfers = [],
  onPlayerPress,
  onTeamPress,
  onShare,
  onFavorite,
  isFavorite = false,
}) => {
  if (!transfer) return null;

  const transferTimeline = useMemo(() => {
    return transfer.transfers.map((t, index) => ({
      ...t,
      index,
    }));
  }, [transfer.transfers]);

  const filteredRelated = useMemo(() => {
    if (!relatedTransfers.length) return [];
    return relatedTransfers
      .filter(t => t.player.id !== transfer.player.id)
      .slice(0, 5);
  }, [relatedTransfers, transfer.player.id]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <LinearGradient
          colors={['#0F0F1A', '#1A1A2E', '#0F0F1A']}
          style={styles.modalContent}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.headerTitle}>Transfer Details</Text>
            <View style={styles.headerActions}>
              {onFavorite && (
                <TouchableOpacity
                  onPress={() => onFavorite(transfer.player.id)}
                  style={styles.actionButton}
                >
                  <Ionicons
                    name={isFavorite ? 'heart' : 'heart-outline'}
                    size={24}
                    color={isFavorite ? '#ef4444' : '#fff'}
                  />
                </TouchableOpacity>
              )}
              {onShare && (
                <TouchableOpacity
                  onPress={() => onShare(transfer)}
                  style={styles.actionButton}
                >
                  <Ionicons name="share-outline" size={24} color="#fff" />
                </TouchableOpacity>
              )}
            </View>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Player Info */}
            <View style={styles.playerSection}>
              <TouchableOpacity
                onPress={() => onPlayerPress?.(transfer)}
                style={styles.playerCard}
              >
                <PlayerAvatar
                  name={transfer.player.name}
                  position={null}
                  size={80}
                />
                <View style={styles.playerInfo}>
                  <Text style={styles.playerName}>{transfer.player.name}</Text>
                  {transfer.league && (
                    <View style={styles.leagueInfo}>
                      <LeagueIcon
                        name={transfer.league.name}
                        size={24}
                        color="#8B5CF6"
                      />
                      <Text style={styles.leagueName}>{transfer.league.name}</Text>
                    </View>
                  )}
                </View>
              </TouchableOpacity>
            </View>

            {/* Transfer Timeline */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transfer Timeline</Text>
              {transferTimeline.map((t, index) => (
                <View key={index} style={styles.timelineItem}>
                  <View style={styles.timelineLine} />
                  <View style={styles.timelineContent}>
                    <View style={styles.timelineHeader}>
                      <Text style={styles.timelineDate}>{t.date || 'Unknown Date'}</Text>
                      <Text style={styles.timelineType}>{t.type || 'Transfer'}</Text>
                    </View>
                    <View style={styles.timelineTeams}>
                      {t.teams.out && (
                        <TouchableOpacity
                          style={styles.teamCard}
                          onPress={() => onTeamPress?.(t.teams.out!.id)}
                        >
                          <TeamBadge
                            name={t.teams.out.name}
                            color="#8B5CF6"
                            size={50}
                          />
                          <Text style={styles.teamName} numberOfLines={2}>
                            {t.teams.out.name}
                          </Text>
                        </TouchableOpacity>
                      )}
                      <Ionicons name="arrow-forward" size={24} color="#8B5CF6" />
                      {t.teams.in && (
                        <TouchableOpacity
                          style={styles.teamCard}
                          onPress={() => onTeamPress?.(t.teams.in!.id)}
                        >
                          <TeamBadge
                            name={t.teams.in.name}
                            color="#8B5CF6"
                            size={50}
                          />
                          <Text style={styles.teamName} numberOfLines={2}>
                            {t.teams.in.name}
                          </Text>
                        </TouchableOpacity>
                      )}
                    </View>
                    {t.value && (
                      <Text style={styles.transferValue}>
                        Transfer Value: €{typeof t.value === 'number' ? (t.value / 1000000).toFixed(1) + 'M' : t.value}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>

            {/* Related Transfers */}
            {filteredRelated.length > 0 && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Related Transfers</Text>
                {filteredRelated.map((related, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.relatedItem}
                    onPress={() => {
                      onClose();
                      // Navigate to related transfer
                    }}
                  >
                    <PlayerAvatar
                      name={related.player.name}
                      position={null}
                      size={50}
                    />
                    <View style={styles.relatedInfo}>
                      <Text style={styles.relatedName}>{related.player.name}</Text>
                      <Text style={styles.relatedSubtext}>
                        {related.transfers[0]?.teams.out?.name} → {related.transfers[0]?.teams.in?.name}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color="#888" />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </ScrollView>
        </LinearGradient>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    height: '90%',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingTop: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingBottom: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  headerActions: {
    flexDirection: 'row',
    gap: 12,
  },
  actionButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  playerSection: {
    marginVertical: 20,
  },
  playerCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
  },
  playerPhoto: {
    width: 80,
    height: 80,
    borderRadius: 40,
    marginRight: 16,
  },
  playerInfo: {
    flex: 1,
  },
  playerName: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  leagueInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  leagueLogo: {
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  leagueName: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '500',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  timelineItem: {
    flexDirection: 'row',
    marginBottom: 24,
  },
  timelineLine: {
    width: 2,
    backgroundColor: '#8B5CF6',
    marginRight: 16,
  },
  timelineContent: {
    flex: 1,
  },
  timelineHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  timelineDate: {
    color: '#888',
    fontSize: 12,
  },
  timelineType: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
  },
  timelineTeams: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  teamCard: {
    flex: 1,
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
  },
  teamLogo: {
    width: 50,
    height: 50,
    marginBottom: 8,
  },
  teamName: {
    color: '#fff',
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  transferValue: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
    marginTop: 8,
  },
  relatedItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  relatedPhoto: {
    width: 50,
    height: 50,
    borderRadius: 25,
    marginRight: 12,
  },
  relatedInfo: {
    flex: 1,
  },
  relatedName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
    marginBottom: 4,
  },
  relatedSubtext: {
    color: '#888',
    fontSize: 12,
  },
});

