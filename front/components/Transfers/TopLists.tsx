import React, { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Transfer } from '../../services/apiFootball';
import PlayerAvatar from '../common/PlayerAvatar';
import TeamBadge from '../common/TeamBadge';
import LeagueIcon from '../common/LeagueIcon';
import { useTranslation } from '../../src/i18n';
import { getTeamDisplayName, getLeagueDisplayName } from '../../utils/i18nHelpers';

interface TopListsProps {
  transfers: Transfer[];
  onTransferPress?: (transfer: Transfer) => void;
}

export const TopLists: React.FC<TopListsProps> = ({ transfers, onTransferPress }) => {
  const { language } = useTranslation();
  const topLists = useMemo(() => {
    // Note: Transfer values are not available in the current data structure
    // Biggest transfers list is disabled until value data is available
    const biggestTransfers: Transfer[] = [];

    // Top 10 Most Active Teams
    const teamCounts = new Map<number, { name: string; logo?: string; count: number }>();
    transfers.forEach(t => {
      t.transfers.forEach(tr => {
        if (tr.teams.in?.id) {
          const existing = teamCounts.get(tr.teams.in.id);
          teamCounts.set(tr.teams.in.id, {
            name: tr.teams.in.name,
            logo: tr.teams.in.logo,
            count: (existing?.count || 0) + 1,
          });
        }
        if (tr.teams.out?.id) {
          const existing = teamCounts.get(tr.teams.out.id);
          teamCounts.set(tr.teams.out.id, {
            name: tr.teams.out.name,
            logo: tr.teams.out.logo,
            count: (existing?.count || 0) + 1,
          });
        }
      });
    });
    const mostActiveTeams = Array.from(teamCounts.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top 10 Most Active Leagues
    const leagueCounts = new Map<number, { name: string; logo?: string; count: number , country?: string }>();
    transfers.forEach(t => {
      if (t.league?.id) {
        const existing = leagueCounts.get(t.league.id);
        leagueCounts.set(t.league.id, {
          name: t.league.name,
          logo: t.league.logo,
          count: (existing?.count || 0) + 1,
          
        });
      }
    });
    const mostActiveLeagues = Array.from(leagueCounts.entries())
      .map(([id, data]) => ({ id, ...data }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Top 10 Free Transfers
    const freeTransfers = transfers
      .filter(t => t.transfers.some(tr => tr.type?.toLowerCase().includes('free')))
      .slice(0, 10);

    return {
      biggestTransfers,
      mostActiveTeams,
      mostActiveLeagues,
      freeTransfers,
    };
  }, [transfers]);

  const formatValue = (value: any): string => {
    if (!value || typeof value !== 'number') return 'N/A';
    if (value >= 1000000) return `€${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `€${(value / 1000).toFixed(0)}K`;
    return `€${value}`;
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container}>
      {/* Biggest Transfers - Hidden until value data is available */}
      {topLists.biggestTransfers.length > 0 && (
        <View style={styles.listCard}>
          <Text style={styles.listTitle}>💰 Biggest Transfers</Text>
          <ScrollView style={styles.listContent} nestedScrollEnabled>
            {topLists.biggestTransfers.map((transfer, index) => (
              <TouchableOpacity
                key={index}
                style={styles.listItem}
                onPress={() => onTransferPress?.(transfer)}
              >
                <View style={styles.rankBadge}>
                  <Text style={styles.rankText}>{index + 1}</Text>
                </View>
                <PlayerAvatar
                  name={transfer.player.name}
                  position={null}
                  size={40}
                />
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={1}>
                    {transfer.player.name}
                  </Text>
                  <Text style={styles.itemSubtext} numberOfLines={1}>
                    {getTeamDisplayName(transfer.transfers[0]?.teams.out?.name, language)} → {getTeamDisplayName(transfer.transfers[0]?.teams.in?.name, language)}
                  </Text>
                </View>
                <Text style={styles.itemValue}>N/A</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Most Active Teams */}
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>⚽ Most Active Teams</Text>
        <ScrollView style={styles.listContent} nestedScrollEnabled>
          {topLists.mostActiveTeams.map((team, index) => (
            <View key={team.id} style={styles.listItem}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <TeamBadge
                name={team.name}
                color="#8B5CF6"
                size={40}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {getTeamDisplayName(team.name, language)}
                </Text>
              </View>
              <Text style={styles.itemValue}>{team.count}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Most Active Leagues */}
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>🏆 Most Active Leagues</Text>
        <ScrollView style={styles.listContent} nestedScrollEnabled>
          {topLists.mostActiveLeagues.map((league, index) => (
            <View key={league.id} style={styles.listItem}>
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <LeagueIcon
                name={league.name}
                size={40}
                color="#FFD700"
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {getLeagueDisplayName(league.name, language, league.id, league.country)}
                </Text>
              </View>
              <Text style={styles.itemValue}>{league.count}</Text>
            </View>
          ))}
        </ScrollView>
      </View>

      {/* Free Transfers */}
      <View style={styles.listCard}>
        <Text style={styles.listTitle}>🆓 Top Free Transfers</Text>
        <ScrollView style={styles.listContent} nestedScrollEnabled>
          {topLists.freeTransfers.map((transfer, index) => (
            <TouchableOpacity
              key={index}
              style={styles.listItem}
              onPress={() => onTransferPress?.(transfer)}
            >
              <View style={styles.rankBadge}>
                <Text style={styles.rankText}>{index + 1}</Text>
              </View>
              <PlayerAvatar
                name={transfer.player.name}
                position={null}
                size={40}
              />
              <View style={styles.itemInfo}>
                <Text style={styles.itemName} numberOfLines={1}>
                  {transfer.player.name}
                </Text>
                <Text style={styles.itemSubtext} numberOfLines={1}>
                  {getTeamDisplayName(transfer.transfers[0]?.teams.out?.name, language)} → {getTeamDisplayName(transfer.transfers[0]?.teams.in?.name, language)}
                </Text>
              </View>
              <Ionicons name="checkmark-circle" size={20} color="#10b981" />
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 16,
  },
  listCard: {
    width: 300,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginRight: 16,
  },
  listTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  listContent: {
    maxHeight: 400,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  rankBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  rankText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
  },
  itemImage: {
    width: 40,
    height: 40,
    borderRadius: 20,
    marginRight: 12,
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '500',
  },
  itemSubtext: {
    color: '#888',
    fontSize: 12,
    marginTop: 2,
  },
  itemValue: {
    color: '#8B5CF6',
    fontSize: 12,
    fontWeight: '600',
    marginLeft: 8,
  },
});

