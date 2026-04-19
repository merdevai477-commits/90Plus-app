import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
  Platform,
  Easing,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { X, RotateCcw, Filter, Globe, Flag, Trophy, Clock, Activity, Check } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';

const { width, height } = Dimensions.get('window');

export interface FilterOptions {
  continent?: string;
  country?: string;
  league?: string;
  status?: string;
  time?: string;
}

interface FilterModalProps {
  visible: boolean;
  onClose: () => void;
  onApply: (filters: FilterOptions) => void;
  currentFilters: FilterOptions;
}

const FilterModal: React.FC<FilterModalProps> = ({
  visible,
  onClose,
  onApply,
  currentFilters,
}) => {
  const { t } = useLanguage();

  // Data Constants with Translations
  const continents = useMemo(() => [
    { id: 'all', name: t.filters.all, icon: '🌍' },
    { id: 'europe', name: t.filters.europe, icon: '🇪🇺' },
    { id: 'africa', name: t.filters.africa, icon: '🌍' },
    { id: 'asia', name: t.filters.asia, icon: '🌏' },
    { id: 'south-america', name: t.filters.southAmerica, icon: '🌎' },
  ], [t]);

  const countries = useMemo(() => [
    { id: 'all', name: t.filters.all, flag: '🌍' },
    { id: 'england', name: t.filters.england, flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 'spain', name: t.filters.spain, flag: '🇪🇸' },
    { id: 'germany', name: t.filters.germany, flag: '🇩🇪' },
    { id: 'italy', name: t.filters.italy, flag: '🇮🇹' },
    { id: 'france', name: t.filters.france, flag: '🇫🇷' },
    { id: 'egypt', name: t.filters.egypt, flag: '🇪🇬' },
    { id: 'saudi', name: t.filters.saudi, flag: '🇸🇦' },
  ], [t]);

  const leaguesList = useMemo(() => [
    { id: 'all', name: t.filters.all, icon: '⚽' },
    { id: 'premier-league', name: t.filters.premierLeague, icon: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' },
    { id: 'la-liga', name: t.filters.laLiga, icon: '🇪🇸' },
    { id: 'bundesliga', name: t.filters.bundesliga, icon: '🇩🇪' },
    { id: 'serie-a', name: t.filters.serieA, icon: '🇮🇹' },
    { id: 'ligue-1', name: t.filters.ligue1, icon: '🇫🇷' },
    { id: 'champions-league', name: t.filters.championsLeague, icon: '🏆' },
  ], [t]);

  const statuses = useMemo(() => [
    { id: 'all', name: t.filters.all, icon: <Activity size={16} color="#fff" /> },
    { id: 'live', name: t.filters.live, icon: <Activity size={16} color="#ef4444" /> },
    { id: 'upcoming', name: t.filters.upcoming, icon: <Clock size={16} color="#3b82f6" /> },
    { id: 'finished', name: t.filters.finished, icon: <Check size={16} color="#22c55e" /> },
  ], [t]);

  const times = useMemo(() => [
    { id: 'all', name: t.filters.allDay, icon: '🌤️' },
    { id: 'morning', name: t.filters.morning, icon: '🌅' },
    { id: 'afternoon', name: t.filters.afternoon, icon: '☀️' },
    { id: 'evening', name: t.filters.evening, icon: '🌙' },
  ], [t]);

  // State
  const [filters, setFilters] = useState<FilterOptions>(currentFilters);

  // Animations
  const slideAnim = useRef(new Animated.Value(height)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setFilters(currentFilters);
      // Entrance Animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(slideAnim, {
          toValue: 0,
          damping: 20,
          mass: 1,
          stiffness: 100,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      // Exit Animation
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 0,
          duration: 200,
          useNativeDriver: true,
        }),
        Animated.timing(slideAnim, {
          toValue: height,
          duration: 250,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible]);

  const updateFilter = (key: keyof FilterOptions, value: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApply = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    onApply(filters);
  };

  const handleReset = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setFilters({
      continent: 'all',
      country: 'all',
      league: 'all',
      status: 'all',
      time: 'all',
    });
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    data: any[],
    selectedId: string | undefined,
    filterKey: keyof FilterOptions,
    horizontal = true
  ) => (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        {icon}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      <ScrollView
        horizontal={horizontal}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.optionsContainer}
      >
        {data.map((item) => {
          const isSelected = (selectedId || 'all') === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              style={[
                styles.optionChip,
                isSelected && styles.optionChipActive,
                !horizontal && styles.optionChipFull
              ]}
              onPress={() => updateFilter(filterKey, item.id)}
              activeOpacity={0.7}
            >
              {isSelected && (
                <LinearGradient
                  colors={['#22c55e', '#16a34a']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                />
              )}
              <Text style={[styles.optionIcon, isSelected && styles.textActive]}>
                {item.icon || item.flag}
              </Text>
              <Text style={[styles.optionLabel, isSelected && styles.textActive]}>
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onClose}>
      <View style={styles.container}>
        <Animated.View style={[styles.backdrop, { opacity: fadeAnim }]}>
          <TouchableOpacity style={StyleSheet.absoluteFill} onPress={onClose} />
        </Animated.View>

        <Animated.View
          style={[
            styles.modalContainer,
            { transform: [{ translateY: slideAnim }] }
          ]}
        >
          <BlurView intensity={80} tint="dark" style={styles.blurContainer}>
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.headerTitleContainer}>
                <View style={styles.headerIconBg}>
                  <Filter size={20} color="#22c55e" />
                </View>
                <Text style={styles.headerTitle}>{t.filters.title}</Text>
              </View>
              <TouchableOpacity style={styles.closeButton} onPress={onClose}>
                <X size={20} color="#fff" />
              </TouchableOpacity>
            </View>

            <ScrollView
              style={styles.content}
              showsVerticalScrollIndicator={false}
              contentContainerStyle={{ paddingBottom: 100 }}
            >
              {renderSection(t.filters.matchStatus, <Activity size={18} color="#ef4444" />, statuses, filters.status, 'status')}
              {renderSection(t.filters.time, <Clock size={18} color="#f59e0b" />, times, filters.time, 'time')}
              {renderSection(t.filters.league, <Trophy size={18} color="#8b5cf6" />, leaguesList, filters.league, 'league')}
              {renderSection(t.filters.country, <Flag size={18} color="#fff" />, countries, filters.country, 'country')}
              {renderSection(t.filters.continent, <Globe size={18} color="#3b82f6" />, continents, filters.continent, 'continent')}
            </ScrollView>

            {/* Footer */}
            <View style={styles.footer}>
              <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
                <RotateCcw size={20} color="#ef4444" />
              </TouchableOpacity>

              <TouchableOpacity style={styles.applyButton} onPress={handleApply}>
                <LinearGradient
                  colors={['#22c55e', '#15803d']}
                  style={styles.applyGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <Text style={styles.applyText}>{t.filters.apply}</Text>
                  <Filter size={18} color="#fff" />
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </BlurView>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  modalContainer: {
    height: '85%',
    backgroundColor: 'transparent',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    overflow: 'hidden',
  },
  blurContainer: {
    flex: 1,
    backgroundColor: 'rgba(20,20,20,0.95)',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconBg: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ccc',
  },
  optionsContainer: {
    gap: 10,
    paddingRight: 20, // For scroll bounce visual
  },
  optionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    gap: 8,
    overflow: 'hidden',
  },
  optionChipFull: {
    flex: 1,
    marginBottom: 8,
  },
  optionChipActive: {
    borderColor: '#22c55e',
    backgroundColor: '#22c55e',
  },
  optionIcon: {
    fontSize: 16,
    color: '#ccc',
  },
  optionLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: '#ccc',
  },
  textActive: {
    color: '#fff',
    fontWeight: '700',
  },
  footer: {
    flexDirection: 'row',
    padding: 20,
    paddingBottom: Platform.OS === 'ios' ? 40 : 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(10,10,10,0.8)',
  },
  resetButton: {
    width: 50,
    height: 50,
    borderRadius: 16,
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  applyButton: {
    flex: 1,
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
  },
  applyGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  applyText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default FilterModal;

