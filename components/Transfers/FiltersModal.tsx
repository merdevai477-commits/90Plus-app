import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Slider from '@react-native-community/slider';

export interface TransferFilters {
  transferType: 'all' | 'free' | 'loan' | 'permanent' | 'swap';
  position: string[]; // ['GK', 'DEF', 'MID', 'FWD']
  ageRange: { min: number; max: number };
  priceRange: { min: number; max: number };
  dateRange: { from: string | null; date: string | null };
  nationality: string[];
  leagueId: number | null;
}

interface FiltersModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: TransferFilters) => void;
  initialFilters: TransferFilters;
  availableLeagues: Array<{ id: number; name: string; logo?: string }>;
}

const TRANSFER_TYPES = [
  { value: 'all', label: 'All Transfers' },
  { value: 'free', label: 'Free Transfers' },
  { value: 'loan', label: 'Loan Transfers' },
  { value: 'permanent', label: 'Permanent Transfers' },
  { value: 'swap', label: 'Swap Deals' },
] as const;

const POSITIONS = [
  { value: 'GK', label: 'Goalkeeper' },
  { value: 'DEF', label: 'Defender' },
  { value: 'MID', label: 'Midfielder' },
  { value: 'FWD', label: 'Forward' },
] as const;

export const FiltersModal: React.FC<FiltersModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters,
  availableLeagues,
}) => {
  const [filters, setFilters] = useState<TransferFilters>(initialFilters);
  const [searchLeague, setSearchLeague] = useState('');

  const handleApply = useCallback(() => {
    onApply(filters);
    onClose();
  }, [filters, onApply, onClose]);

  const handleReset = useCallback(() => {
    const resetFilters: TransferFilters = {
      transferType: 'all',
      position: [],
      ageRange: { min: 16, max: 45 },
      priceRange: { min: 0, max: 100000000 },
      dateRange: { from: null, date: null },
      nationality: [],
      leagueId: null,
    };
    setFilters(resetFilters);
  }, []);

  const togglePosition = useCallback((position: string) => {
    setFilters(prev => ({
      ...prev,
      position: prev.position.includes(position)
        ? prev.position.filter(p => p !== position)
        : [...prev.position, position],
    }));
  }, []);

  const filteredLeagues = availableLeagues.filter(league =>
    league.name.toLowerCase().includes(searchLeague.toLowerCase())
  );

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
            <Text style={styles.headerTitle}>Filters</Text>
            <TouchableOpacity onPress={handleReset}>
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
            {/* Transfer Type Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Transfer Type</Text>
              <View style={styles.chipsContainer}>
                {TRANSFER_TYPES.map(type => (
                  <TouchableOpacity
                    key={type.value}
                    style={[
                      styles.chip,
                      filters.transferType === type.value && styles.chipActive,
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, transferType: type.value as any }))}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.transferType === type.value && styles.chipTextActive,
                      ]}
                    >
                      {type.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Position Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Position</Text>
              <View style={styles.chipsContainer}>
                {POSITIONS.map(pos => (
                  <TouchableOpacity
                    key={pos.value}
                    style={[
                      styles.chip,
                      filters.position.includes(pos.value) && styles.chipActive,
                    ]}
                    onPress={() => togglePosition(pos.value)}
                  >
                    <Text
                      style={[
                        styles.chipText,
                        filters.position.includes(pos.value) && styles.chipTextActive,
                      ]}
                    >
                      {pos.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Age Range Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Age Range: {filters.ageRange.min} - {filters.ageRange.max}
              </Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Min: {filters.ageRange.min}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={16}
                  maximumValue={45}
                  value={filters.ageRange.min}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      ageRange: { ...prev.ageRange, min: Math.round(value) },
                    }))
                  }
                  minimumTrackTintColor="#8B5CF6"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#8B5CF6"
                />
                <Text style={styles.sliderLabel}>Max: {filters.ageRange.max}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={16}
                  maximumValue={45}
                  value={filters.ageRange.max}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      ageRange: { ...prev.ageRange, max: Math.round(value) },
                    }))
                  }
                  minimumTrackTintColor="#8B5CF6"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#8B5CF6"
                />
              </View>
            </View>

            {/* Price Range Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>
                Price Range: €{filters.priceRange.min.toLocaleString()} - €{filters.priceRange.max.toLocaleString()}
              </Text>
              <View style={styles.sliderContainer}>
                <Text style={styles.sliderLabel}>Min: €{filters.priceRange.min.toLocaleString()}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100000000}
                  value={filters.priceRange.min}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      priceRange: { ...prev.priceRange, min: Math.round(value) },
                    }))
                  }
                  minimumTrackTintColor="#8B5CF6"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#8B5CF6"
                />
                <Text style={styles.sliderLabel}>Max: €{filters.priceRange.max.toLocaleString()}</Text>
                <Slider
                  style={styles.slider}
                  minimumValue={0}
                  maximumValue={100000000}
                  value={filters.priceRange.max}
                  onValueChange={(value) =>
                    setFilters(prev => ({
                      ...prev,
                      priceRange: { ...prev.priceRange, max: Math.round(value) },
                    }))
                  }
                  minimumTrackTintColor="#8B5CF6"
                  maximumTrackTintColor="rgba(255,255,255,0.2)"
                  thumbTintColor="#8B5CF6"
                />
              </View>
            </View>

            {/* League Filter */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>League</Text>
              <View style={styles.searchContainer}>
                <Ionicons name="search" size={20} color="#888" style={styles.searchIcon} />
                <TextInput
                  style={styles.searchInput}
                  placeholder="Search leagues..."
                  placeholderTextColor="#666"
                  value={searchLeague}
                  onChangeText={setSearchLeague}
                />
              </View>
              <ScrollView style={styles.leagueList} nestedScrollEnabled>
                <TouchableOpacity
                  style={[
                    styles.leagueItem,
                    filters.leagueId === null && styles.leagueItemActive,
                  ]}
                  onPress={() => setFilters(prev => ({ ...prev, leagueId: null }))}
                >
                  <Text
                    style={[
                      styles.leagueItemText,
                      filters.leagueId === null && styles.leagueItemTextActive,
                    ]}
                  >
                    All Leagues
                  </Text>
                </TouchableOpacity>
                {filteredLeagues.map(league => (
                  <TouchableOpacity
                    key={league.id}
                    style={[
                      styles.leagueItem,
                      filters.leagueId === league.id && styles.leagueItemActive,
                    ]}
                    onPress={() => setFilters(prev => ({ ...prev, leagueId: league.id }))}
                  >
                    <Text
                      style={[
                        styles.leagueItemText,
                        filters.leagueId === league.id && styles.leagueItemTextActive,
                      ]}
                    >
                      {league.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity style={styles.cancelButton} onPress={onClose}>
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
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
  resetText: {
    color: '#8B5CF6',
    fontSize: 14,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
    paddingHorizontal: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  chipsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  chipActive: {
    backgroundColor: '#8B5CF6',
    borderColor: '#8B5CF6',
  },
  chipText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '500',
  },
  chipTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  sliderContainer: {
    marginTop: 8,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabel: {
    color: '#888',
    fontSize: 12,
    marginBottom: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
  },
  leagueList: {
    maxHeight: 200,
  },
  leagueItem: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.05)',
    marginBottom: 8,
  },
  leagueItemActive: {
    backgroundColor: '#8B5CF6',
  },
  leagueItemText: {
    color: '#888',
    fontSize: 14,
  },
  leagueItemTextActive: {
    color: '#fff',
    fontWeight: '600',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#8B5CF6',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

