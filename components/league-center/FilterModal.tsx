/**
 * Filter Modal Component
 * Comprehensive filter system for matches
 * Bottom sheet modal with drag handle
 */

import React, { useState, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
  interpolate,
} from 'react-native-reanimated';
import { X, Check, Calendar, Clock, Star, Target } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { ApiFootballService } from '../../services/apiFootball';
import { LEAGUES } from '../../data/leagues';

export type FilterStatus = 'all' | 'live' | 'finished' | 'upcoming';
export type FilterTime = 'today' | 'next7days' | 'thisweek' | 'all';
export type FilterMatchType = 'all' | 'favorites' | 'with_predictions';

export interface FilterState {
  leagues: number[];
  status: FilterStatus;
  time: FilterTime;
  matchType: FilterMatchType;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterState) => void;
  initialFilters?: FilterState;
  availableLeagues?: Array<{ id: number; name: string; logo?: string }>;
}

const DEFAULT_FILTERS: FilterState = {
  leagues: [],
  status: 'all',
  time: 'all',
  matchType: 'all',
};

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  initialFilters = DEFAULT_FILTERS,
  availableLeagues,
}) => {
  const insets = useSafeAreaInsets();
  const [tempFilters, setTempFilters] = useState<FilterState>(initialFilters);
  const [leagues, setLeagues] = useState<Array<{ id: number; name: string; logo?: string }>>([]);
  const translateY = useSharedValue(1000);

  // Fetch leagues if not provided
  useEffect(() => {
    if (visible && !availableLeagues) {
      const fetchLeagues = async () => {
        try {
          const data = await ApiFootballService.getAllLeagues();
          if (data && data.length > 0) {
            const formatted = data.slice(0, 50).map((item: any) => ({
              id: item.league?.id || item.id,
              name: item.league?.name || item.name,
              logo: item.league?.logo || item.logo,
            }));
            setLeagues(formatted);
          } else {
            // Fallback to local leagues data
            setLeagues(LEAGUES.slice(0, 50));
          }
        } catch (error) {
          // Fallback to local leagues data
          setLeagues(LEAGUES.slice(0, 50));
        }
      };
      fetchLeagues();
    } else if (availableLeagues) {
      setLeagues(availableLeagues);
    }
  }, [visible, availableLeagues]);

  // Initialize temp filters when modal opens
  useEffect(() => {
    if (visible) {
      setTempFilters(initialFilters);
      translateY.value = withSpring(0, {
        damping: 20,
        stiffness: 300,
      });
    } else {
      translateY.value = withTiming(1000, {
        duration: 200,
      });
    }
  }, [visible, initialFilters, translateY]);

  const displayLeagues = availableLeagues || leagues;

  // Calculate active filters count
  const activeFiltersCount = useMemo(() => {
    let count = 0;
    if (tempFilters.leagues.length > 0) count++;
    if (tempFilters.status !== 'all') count++;
    if (tempFilters.time !== 'all') count++;
    if (tempFilters.matchType !== 'all') count++;
    return count;
  }, [tempFilters]);

  const animatedStyle = useAnimatedStyle(() => {
    return {
      transform: [{ translateY: translateY.value }],
    };
  });

  const handleToggleLeague = (leagueId: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters((prev) => ({
      ...prev,
      leagues: prev.leagues.includes(leagueId)
        ? prev.leagues.filter((id) => id !== leagueId)
        : [...prev.leagues, leagueId],
    }));
  };

  const handleStatusChange = (status: FilterStatus) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters((prev) => ({ ...prev, status }));
  };

  const handleTimeChange = (time: FilterTime) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters((prev) => ({ ...prev, time }));
  };

  const handleMatchTypeChange = (matchType: FilterMatchType) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setTempFilters((prev) => ({ ...prev, matchType }));
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onApply(tempFilters);
    onClose();
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTempFilters(DEFAULT_FILTERS);
  };

  const handleClearAll = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setTempFilters(DEFAULT_FILTERS);
  };

  const renderLeagueItem = ({ item }: { item: { id: number; name: string; logo?: string } }) => {
    const isSelected = tempFilters.leagues.includes(item.id);
    return (
      <TouchableOpacity
        style={[styles.leagueItem, isSelected && styles.leagueItemSelected]}
        onPress={() => handleToggleLeague(item.id)}
        activeOpacity={0.7}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: isSelected }}
        accessibilityLabel={`${item.name} league filter`}
      >
        {item.logo && (
          <Image source={{ uri: item.logo }} style={styles.leagueLogo} resizeMode="contain" />
        )}
        <Text style={[styles.leagueName, isSelected && styles.leagueNameSelected]} numberOfLines={1}>
          {item.name}
        </Text>
        {isSelected && (
          <View style={styles.checkIcon}>
            <Check size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  const renderRadioOption = (
    label: string,
    value: string,
    currentValue: string,
    onPress: () => void,
    icon?: React.ReactNode
  ) => {
    const isSelected = value === currentValue;
    return (
      <TouchableOpacity
        style={[styles.radioOption, isSelected && styles.radioOptionSelected]}
        onPress={onPress}
        activeOpacity={0.7}
        accessibilityRole="radio"
        accessibilityState={{ selected: isSelected }}
        accessibilityLabel={label}
      >
        {icon && <View style={styles.radioIcon}>{icon}</View>}
        <Text style={[styles.radioText, isSelected && styles.radioTextSelected]}>{label}</Text>
        {isSelected && (
          <View style={styles.radioCheck}>
            <Check size={16} color="#FFFFFF" />
          </View>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose} />
        <Animated.View
          style={[
            styles.container,
            { paddingBottom: insets.bottom + 20 },
            animatedStyle,
          ]}
        >
          <BlurView intensity={80} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(15, 15, 26, 0.98)', 'rgba(15, 15, 26, 0.95)']}
            style={StyleSheet.absoluteFill}
          />

          {/* Drag Handle */}
          <View style={styles.handleContainer}>
            <View style={styles.handle} />
          </View>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Filters</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
              accessibilityRole="button"
              accessibilityLabel="Close filters"
            >
              <X size={24} color="#FFFFFF" />
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Filter by League */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By League</Text>
              <FlatList
                data={displayLeagues.slice(0, 30)}
                renderItem={renderLeagueItem}
                keyExtractor={(item) => item.id.toString()}
                numColumns={2}
                scrollEnabled={false}
                contentContainerStyle={styles.leagueList}
              />
            </View>

            {/* Filter by Status */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By Status</Text>
              <View style={styles.radioGroup}>
                {renderRadioOption('All', 'all', tempFilters.status, () => handleStatusChange('all'))}
                {renderRadioOption('Live', 'live', tempFilters.status, () => handleStatusChange('live'), <Clock size={16} color="#EF4444" />)}
                {renderRadioOption('Finished', 'finished', tempFilters.status, () => handleStatusChange('finished'))}
                {renderRadioOption('Upcoming', 'upcoming', tempFilters.status, () => handleStatusChange('upcoming'), <Calendar size={16} color="#3B82F6" />)}
              </View>
            </View>

            {/* Filter by Time */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By Time</Text>
              <View style={styles.radioGroup}>
                {renderRadioOption('All', 'all', tempFilters.time, () => handleTimeChange('all'))}
                {renderRadioOption('Today', 'today', tempFilters.time, () => handleTimeChange('today'), <Calendar size={16} color="#10B981" />)}
                {renderRadioOption('Next 7 Days', 'next7days', tempFilters.time, () => handleTimeChange('next7days'))}
                {renderRadioOption('This Week', 'thisweek', tempFilters.time, () => handleTimeChange('thisweek'))}
              </View>
            </View>

            {/* Filter by Match Type */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>By Match Type</Text>
              <View style={styles.radioGroup}>
                {renderRadioOption('All', 'all', tempFilters.matchType, () => handleMatchTypeChange('all'))}
                {renderRadioOption('Favorites Only', 'favorites', tempFilters.matchType, () => handleMatchTypeChange('favorites'), <Star size={16} color="#FFD700" />)}
                {renderRadioOption('With Predictions', 'with_predictions', tempFilters.matchType, () => handleMatchTypeChange('with_predictions'), <Target size={16} color="#8B5CF6" />)}
              </View>
            </View>
          </ScrollView>

          {/* Footer Actions */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.resetButton}
              onPress={handleClearAll}
              activeOpacity={0.7}
              accessibilityRole="button"
              accessibilityLabel="Clear all filters"
            >
              <Text style={styles.resetText}>Reset</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.applyButton}
              onPress={handleApply}
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel={`Apply filters${activeFiltersCount > 0 ? `, ${activeFiltersCount} active` : ''}`}
            >
              <LinearGradient
                colors={['#3B82F6', '#60A5FA']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.applyGradient}
              >
                <Text style={styles.applyText}>
                  Apply{activeFiltersCount > 0 ? ` (${activeFiltersCount})` : ''}
                </Text>
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: 'rgba(15, 15, 26, 0.98)',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 10,
  },
  handleContainer: {
    alignItems: 'center',
    paddingVertical: 12,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    position: 'relative',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  closeButton: {
    position: 'absolute',
    right: 20,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  leagueList: {
    gap: 8,
  },
  leagueItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    margin: 4,
    gap: 8,
  },
  leagueItemSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  leagueLogo: {
    width: 24,
    height: 24,
  },
  leagueName: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  leagueNameSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  checkIcon: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioGroup: {
    gap: 8,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 12,
  },
  radioOptionSelected: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderColor: '#3B82F6',
  },
  radioIcon: {
    width: 20,
    height: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioText: {
    flex: 1,
    fontSize: 15,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  radioTextSelected: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  radioCheck: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#3B82F6',
    justifyContent: 'center',
    alignItems: 'center',
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 8,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.1)',
  },
  resetButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  resetText: {
    fontSize: 15,
    fontWeight: '700',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  applyButton: {
    flex: 2,
    borderRadius: 16,
    overflow: 'hidden',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  applyGradient: {
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
});

export default FilterModal;

