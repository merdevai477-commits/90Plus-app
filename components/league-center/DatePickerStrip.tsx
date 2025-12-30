import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptic } from '../../hooks/useHaptic';
import { generateDateRange, isSameDay, DateItem } from './dateUtils';

// Re-export for backwards compatibility
export { generateDateRange, formatDateItem, DateItem } from './dateUtils';

interface DatePickerStripProps {
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const DatePickerStrip: React.FC<DatePickerStripProps> = ({
  selectedDate,
  onDateSelect,
}) => {
  const { trigger } = useHaptic();
  const scrollViewRef = useRef<ScrollView>(null);
  const dates = generateDateRange(selectedDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const handleDatePress = (date: Date) => {
    trigger('selection');
    onDateSelect(date);
  };

  // Scroll to selected date on mount
  useEffect(() => {
    // Find the index of selected date (should be at position 7 since we show 7 days before)
    const selectedIndex = dates.findIndex(d => isSameDay(d.date, selectedDate));
    if (selectedIndex >= 0 && scrollViewRef.current) {
      // Scroll to center the selected date
      const itemWidth = 50; // 38 width + 12 gap
      const scrollPosition = Math.max(0, (selectedIndex - 3) * itemWidth);
      setTimeout(() => {
        scrollViewRef.current?.scrollTo({ x: scrollPosition, animated: false });
      }, 100);
    }
  }, []);

  return (
    <View style={styles.container}>
      <ScrollView
        ref={scrollViewRef}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {dates.map((item, index) => {
          const isSelected = isSameDay(item.date, selectedDate);
          const isToday = isSameDay(item.date, today);
          const isPast = item.date < today;

          if (isSelected) {
            return (
              <TouchableOpacity
                key={index}
                onPress={() => handleDatePress(item.date)}
                activeOpacity={0.8}
              >
                <LinearGradient
                  colors={['#8B5CF6', '#7C3AED']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.dateItemSelected}
                >
                  <Text style={[styles.dayAbbr, styles.textSelected]}>
                    {isToday ? 'Today' : item.dayAbbr}
                  </Text>
                  <Text style={[styles.dayNumber, styles.textSelected]}>
                    {item.dayNumber}
                  </Text>
                </LinearGradient>
              </TouchableOpacity>
            );
          }

          return (
            <TouchableOpacity
              key={index}
              style={[
                styles.dateItem,
                isToday && styles.dateItemToday,
                isPast && styles.dateItemPast,
              ]}
              onPress={() => handleDatePress(item.date)}
              activeOpacity={0.7}
            >
              <Text style={[styles.dayAbbr, isToday && styles.dayAbbrToday]}>
                {isToday ? 'Today' : item.dayAbbr}
              </Text>
              <Text style={[styles.dayNumber, isPast && styles.dayNumberPast]}>
                {item.dayNumber}
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
    paddingVertical: 12,
  },
  scrollContent: {
    paddingHorizontal: 20,
    gap: 12,
    alignItems: 'center',
  },
  dateItem: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    width: 38,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 2,
  },
  dateItemToday: {
    borderColor: 'rgba(50, 205, 50, 0.5)',
    backgroundColor: 'rgba(50, 205, 50, 0.1)',
  },
  dateItemPast: {
    opacity: 0.8,
  },
  dateItemSelected: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 6,
    width: 38,
    borderRadius: 12,
    gap: 2,
    borderWidth: 1.5,
    borderColor: 'rgba(139, 92, 246, 0.5)',
    shadowColor: '#8B5CF6',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 8,
  },
  dayAbbr: {
    fontSize: 9,
    color: 'rgba(255, 255, 255, 0.4)',
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  dayAbbrToday: {
    color: '#32cd32',
    fontWeight: '700',
  },
  dayNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: '#FFFFFF',
  },
  dayNumberPast: {
    color: 'rgba(255, 255, 255, 0.7)',
  },
  textSelected: {
    color: '#FFFFFF',
  },
});

export default DatePickerStrip;
