/**
 * Match Top Bar Component
 * Today default, swipe navigation, filter button (optional)
 * Sticky on scroll
 */

import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { ChevronLeft, ChevronRight, Filter } from 'lucide-react-native';
import { COLORS } from '../reels/constants';
import { formatDateItem, isSameDay } from '../league-center/dateUtils';

interface MatchTopBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onFilterPress?: () => void;
  scrollY?: SharedValue<number>;
}

const MatchTopBar: React.FC<MatchTopBarProps> = ({
  selectedDate,
  onDateChange,
  onFilterPress,
  scrollY,
}) => {
  const insets = useSafeAreaInsets();
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = isSameDay(selectedDate, today);

  const handlePreviousDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() - 1);
    onDateChange(newDate);
  };

  const handleNextDay = () => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + 1);
    onDateChange(newDate);
  };

  const handleToday = () => {
    onDateChange(new Date());
  };

  // Sticky header styles (scroll-based)
  const containerStyle = useAnimatedStyle(() => {
    if (!scrollY) {
      return {};
    }

    const backgroundColor = interpolate(scrollY.value, [0, 50], [0, 1], 'clamp');

    return {
      backgroundColor: `rgba(0, 0, 0, ${backgroundColor * 0.95})`,
    };
  });

  const dateDisplay = formatDateItem(selectedDate);

  return (
    <Animated.View style={[styles.container, containerStyle, { paddingTop: insets.top }]}>
      <View style={styles.content}>
        {/* Navigation Buttons */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={styles.navButton}
            onPress={handlePreviousDay}
            activeOpacity={0.7}
          >
            <ChevronLeft size={20} color={COLORS.white} />
          </TouchableOpacity>

          {/* Date Display */}
          <TouchableOpacity
            style={[styles.dateButton, isToday && styles.dateButtonToday]}
            onPress={handleToday}
            activeOpacity={0.8}
          >
            <Text style={styles.dateText}>
              {isToday ? 'Today' : dateDisplay.dayAbbr}
            </Text>
            <Text style={styles.dateNumber}>{dateDisplay.dayNumber}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.navButton}
            onPress={handleNextDay}
            activeOpacity={0.7}
          >
            <ChevronRight size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {/* Filter Button (optional) */}
        {onFilterPress && (
          <TouchableOpacity
            style={styles.filterButton}
            onPress={onFilterPress}
            activeOpacity={0.7}
          >
            <Filter size={20} color={COLORS.white} />
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
    zIndex: 10,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  navigation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    flex: 1,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  dateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    minWidth: 80,
  },
  dateButtonToday: {
    backgroundColor: 'rgba(50, 205, 50, 0.15)',
    borderColor: 'rgba(50, 205, 50, 0.3)',
  },
  dateText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateNumber: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.white,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
});

export default MatchTopBar;

