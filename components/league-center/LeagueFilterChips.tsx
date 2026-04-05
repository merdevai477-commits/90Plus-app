import React from 'react';
import { View, Text, TouchableOpacity, ScrollView, Image, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useHaptic } from '../../hooks/useHaptic';
import { LeagueChip, DEFAULT_LEAGUES, renderLeagueChip } from './leagueUtils';

// Re-export for backwards compatibility
export { DEFAULT_LEAGUES, renderLeagueChip } from './leagueUtils';
export type { LeagueChip } from './leagueUtils';

interface LeagueFilterChipsProps {
  leagues: LeagueChip[];
  selectedLeagues: number[];
  onLeagueToggle: (leagueId: number) => void;
}

const LeagueFilterChips: React.FC<LeagueFilterChipsProps> = ({
  leagues,
  selectedLeagues,
  onLeagueToggle,
}) => {
  const { trigger } = useHaptic();

  const handleChipPress = (leagueId: number) => {
    trigger('selection');
    onLeagueToggle(leagueId);
  };

  return (
    <View style={styles.container}>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {leagues.map((league) => {
          const isSelected = selectedLeagues.includes(league.id);
          const chipData = renderLeagueChip(league);

          return (
            <TouchableOpacity
              key={league.id}
              style={[styles.chip, isSelected && styles.chipSelected]}
              onPress={() => handleChipPress(league.id)}
              activeOpacity={0.7}
            >
              <View style={[styles.logoWrapper, isSelected && styles.logoWrapperSelected]}>
                <Image
                  source={{ uri: chipData.logo }}
                  style={styles.leagueLogo}
                  resizeMode="contain"
                />
                {/* Pin icon for selected leagues */}
                {isSelected && (
                  <View style={styles.pinBadge}>
                    <Ionicons name="pin" size={10} color="#fff" />
                  </View>
                )}
              </View>
              <Text
                style={[styles.leagueName, isSelected && styles.leagueNameSelected]}
                numberOfLines={1}
              >
                {chipData.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingVertical: 4,
  },
  scrollContent: {
    paddingHorizontal: 16,
    gap: 12,
    alignItems: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 10,
  },
  chipSelected: {
    backgroundColor: 'rgba(139, 92, 246, 0.2)',
    borderColor: 'rgba(139, 92, 246, 0.5)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 4,
  },
  logoWrapper: {
    width: 28,
    height: 28,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  logoWrapperSelected: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  leagueLogo: {
    width: 20,
    height: 20,
    borderRadius: 4,
  },
  leagueName: {
    fontSize: 13,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.4)',
  },
  leagueNameSelected: {
    color: '#8B5CF6',
    fontWeight: '800',
  },
  pinBadge: {
    position: 'absolute',
    top: -6,
    right: -6,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#1a1a2e',
  },
});


export default LeagueFilterChips;
