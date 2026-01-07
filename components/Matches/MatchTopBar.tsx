/**
 * Match Top Bar Component
 * Enhanced with unified colors
 */

import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import Animated, {
  useAnimatedStyle,
  interpolate,
  SharedValue,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { MATCH_DETAILS_COLORS } from '../../constants/matchDetailsColors';
import { formatDateItem, isSameDay } from '../league-center/dateUtils';
import { useTranslation } from '../../src/i18n/useTranslation';
import DatePickerModal from './DatePickerModal';
import { useDailyPredictions } from '../../hooks/useDailyPredictions';
import { useAuth } from '@clerk/clerk-expo';
import { CoinsBadge } from '../common/CoinsBadge';

interface MatchTopBarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  onFilterPress?: () => void;
  scrollY?: SharedValue<number>;
}

const MatchTopBar: React.FC<MatchTopBarProps> = React.memo(({
  selectedDate,
  onDateChange,
  onFilterPress,
  scrollY,
}) => {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const { getToken } = useAuth();
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isToday = isSameDay(selectedDate, today);

  // Get token for predictions
  React.useEffect(() => {
    const loadToken = async () => {
      const authToken = await getToken();
      setToken(authToken);
    };
    loadToken();
  }, [getToken]);

  const { data: predictionsData } = useDailyPredictions(token);

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

  const handleDatePress = () => {
    setShowDatePicker(true);
  };

  const handleDateSelect = (date: Date) => {
    onDateChange(date);
    setShowDatePicker(false);
  };

  // Sticky header styles (scroll-based)
  const containerStyle = useAnimatedStyle(() => {
    if (!scrollY) {
      return {};
    }

    const opacity = interpolate(scrollY.value, [0, 50], [0, 0.95], 'clamp');

    return {
      opacity,
    };
  });

  const dateDisplay = formatDateItem(selectedDate);

  return (
    <Animated.View style={[styles.container, { paddingTop: insets.top }]}>
      <BlurView intensity={20} tint="dark" style={StyleSheet.absoluteFill} />
      <Animated.View style={[StyleSheet.absoluteFill, containerStyle, { backgroundColor: 'rgba(15, 7, 32, 0.95)' }]} />
      <View style={styles.content}>
        {/* Date Display - Centered */}
        <View style={styles.navigation}>
          <TouchableOpacity
            style={[styles.dateButton, isToday && styles.dateButtonToday]}
            onPress={handleDatePress}
            activeOpacity={0.8}
          >
            <Text style={styles.dateText}>
              {isToday ? t.matches.time.today : dateDisplay.dayAbbr}
            </Text>
            <Text style={styles.dateNumber}>{dateDisplay.dayNumber}</Text>
          </TouchableOpacity>
        </View>

        {/* Right Section - Tickets & Coins */}
        <View style={styles.rightSection}>
          {/* Tickets */}
          <TouchableOpacity style={styles.ticketContainer} activeOpacity={0.7}>
            <Ionicons name="ticket-outline" size={20} color="#3B82F6" />
            <Text style={styles.ticketText}>
              {predictionsData ? `${predictionsData.remaining}/10` : '10/10'}
            </Text>
          </TouchableOpacity>

          {/* Coins */}
          <CoinsBadge />
        </View>
      </View>

      {/* Date Picker Modal */}
      <DatePickerModal
        visible={showDatePicker}
        onClose={() => setShowDatePicker(false)}
        selectedDate={selectedDate}
        onDateSelect={handleDateSelect}
      />
    </Animated.View>
  );
}, (prevProps, nextProps) => {
  return prevProps.selectedDate.getTime() === nextProps.selectedDate.getTime();
});

MatchTopBar.displayName = 'MatchTopBar';

const styles = StyleSheet.create({
  container: {
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255, 255, 255, 0.1)',
    zIndex: 10,
    overflow: 'hidden',
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
    justifyContent: 'center',
    flex: 1,
  },
  dateButton: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 12,
    backgroundColor: MATCH_DETAILS_COLORS.card,
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
    minWidth: 80,
  },
  dateButtonToday: {
    backgroundColor: `rgba(34, 197, 94, 0.15)`,
    borderColor: `rgba(34, 197, 94, 0.3)`,
  },
  dateText: {
    fontSize: 10,
    fontWeight: '600',
    color: MATCH_DETAILS_COLORS.textTertiary,
    textTransform: 'uppercase',
    marginBottom: 2,
  },
  dateNumber: {
    fontSize: 14,
    fontWeight: '800',
    color: MATCH_DETAILS_COLORS.text,
  },
  filterButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: MATCH_DETAILS_COLORS.card,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: MATCH_DETAILS_COLORS.border,
  },
  rightSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  ticketContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    backgroundColor: `rgba(59, 130, 246, 0.1)`,
  },
  ticketText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#3B82F6',
  },
});

export default MatchTopBar;
