/**
 * Date Picker Modal Component
 * iOS-style calendar modal for date selection
 */

import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  ScrollView,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Ionicons } from '@expo/vector-icons';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';
import { useTranslation } from '../../src/i18n/useTranslation';
import { isSameDay } from '../league-center/dateUtils';

interface DatePickerModalProps {
  visible: boolean;
  onClose: () => void;
  selectedDate: Date;
  onDateSelect: (date: Date) => void;
}

const DatePickerModal: React.FC<DatePickerModalProps> = ({
  visible,
  onClose,
  selectedDate,
  onDateSelect,
}) => {
  const { t, language } = useTranslation();
  const [currentMonth, setCurrentMonth] = useState(new Date(selectedDate));
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);

  React.useEffect(() => {
    if (visible) {
      scale.value = withSpring(1, { damping: 15, stiffness: 300 });
      opacity.value = withTiming(1, { duration: 200 });
    } else {
      scale.value = withTiming(0, { duration: 200 });
      opacity.value = withTiming(0, { duration: 200 });
    }
  }, [visible]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: opacity.value,
  }));

  const backdropStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  // Generate calendar days for current month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    const days: Array<{ date: Date; isCurrentMonth: boolean }> = [];

    // Add previous month's trailing days
    const prevMonth = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonth.getDate();
    for (let i = startingDayOfWeek - 1; i >= 0; i--) {
      days.push({
        date: new Date(year, month - 1, prevMonthDays - i),
        isCurrentMonth: false,
      });
    }

    // Add current month's days
    for (let day = 1; day <= daysInMonth; day++) {
      days.push({
        date: new Date(year, month, day),
        isCurrentMonth: true,
      });
    }

    // Add next month's leading days to fill the grid
    const remainingDays = 42 - days.length; // 6 rows × 7 days
    for (let day = 1; day <= remainingDays; day++) {
      days.push({
        date: new Date(year, month + 1, day),
        isCurrentMonth: false,
      });
    }

    return days;
  }, [currentMonth]);

  const handleDatePress = (date: Date) => {
    onDateSelect(date);
    onClose();
  };

  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
    onDateSelect(today);
    onClose();
  };

  // Use Intl for localized month names
  const monthName = new Intl.DateTimeFormat(language === 'ar' ? 'ar-EG' : 'en-US', { month: 'long' }).format(currentMonth);
  const year = currentMonth.getFullYear();

  const dayNames = language === 'ar' 
    ? ['أحد', 'إثنين', 'ثلاثاء', 'أربعاء', 'خميس', 'جمعة', 'سبت']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onClose}
    >
      <Animated.View style={[StyleSheet.absoluteFill, backdropStyle]}>
        <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />
      </Animated.View>

      <TouchableOpacity
        style={StyleSheet.absoluteFill}
        activeOpacity={1}
        onPress={onClose}
      >
        <View style={styles.container}>
          <Animated.View style={[styles.content, animatedStyle]}>
            <TouchableOpacity
              activeOpacity={1}
              onPress={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <View style={styles.header}>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color={MATCH_DETAILS_COLORS.text} />
                </TouchableOpacity>
                <Text style={styles.title}>
                  {monthName} {year}
                </Text>
                <TouchableOpacity onPress={handleToday} style={styles.todayButton}>
                  <Text style={styles.todayButtonText}>{t.matches.time.today}</Text>
                </TouchableOpacity>
              </View>

              {/* Month Navigation */}
              <View style={styles.monthNavigation}>
                <TouchableOpacity onPress={handlePreviousMonth} style={styles.navButton}>
                  <Ionicons name="chevron-back" size={20} color={MATCH_DETAILS_COLORS.text} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleNextMonth} style={styles.navButton}>
                  <Ionicons name="chevron-forward" size={20} color={MATCH_DETAILS_COLORS.text} />
                </TouchableOpacity>
              </View>

              {/* Day Names */}
              <View style={styles.dayNamesRow}>
                {dayNames.map((day, index) => (
                  <View key={index} style={styles.dayNameCell}>
                    <Text style={styles.dayNameText}>{day}</Text>
                  </View>
                ))}
              </View>

              {/* Calendar Grid */}
              <View style={styles.calendarGrid}>
                {calendarDays.map((day, index) => {
                  const isSelected = isSameDay(day.date, selectedDate);
                  const isToday = isSameDay(day.date, today);
                  const isPast = day.date < today && !isToday;

                  return (
                    <TouchableOpacity
                      key={index}
                      style={[
                        styles.dayCell,
                        isSelected && styles.dayCellSelected,
                        isToday && !isSelected && styles.dayCellToday,
                      ]}
                      onPress={() => handleDatePress(day.date)}
                      disabled={!day.isCurrentMonth}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          !day.isCurrentMonth && styles.dayTextOtherMonth,
                          isSelected && styles.dayTextSelected,
                          isPast && !isSelected && styles.dayTextPast,
                        ]}
                      >
                        {day.date.getDate()}
                      </Text>
                      {isToday && !isSelected && (
                        <View style={styles.todayDot} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  content: {
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderRadius: 24,
    padding: 20,
    width: '100%',
    maxWidth: 400,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  closeButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: MATCH_DETAILS_COLORS.text,
  },
  todayButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: MATCH_DETAILS_COLORS.accent,
  },
  todayButtonText: {
    fontSize: 12,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.text,
  },
  monthNavigation: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  navButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MATCH_DETAILS_COLORS.cardSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  dayNamesRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  dayNameCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.textSecondary,
    textTransform: 'uppercase',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  dayCell: {
    width: '14.28%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: 8,
    margin: 2,
  },
  dayCellSelected: {
    backgroundColor: MATCH_DETAILS_COLORS.accent,
  },
  dayCellToday: {
    backgroundColor: `rgba(34, 197, 94, 0.15)`,
  },
  dayText: {
    fontSize: 14,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.text,
  },
  dayTextOtherMonth: {
    color: MATCH_DETAILS_COLORS.textTertiary,
    opacity: 0.3,
  },
  dayTextSelected: {
    color: MATCH_DETAILS_COLORS.text,
    fontWeight: '700',
  },
  dayTextPast: {
    color: MATCH_DETAILS_COLORS.textSecondary,
  },
  todayDot: {
    position: 'absolute',
    bottom: 4,
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: MATCH_DETAILS_COLORS.accent,
  },
});

export default DatePickerModal;

