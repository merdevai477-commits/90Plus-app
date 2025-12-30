/**
 * Date utility functions for DatePickerStrip component.
 * Separated from the React component for easier testing.
 */

export interface DateItem {
  date: Date;
  dayAbbr: string;
  dayNumber: number;
  isSelected: boolean;
  isToday: boolean;
}

export const DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/**
 * Generates a range of days: 7 days before and 3 days after the selected date.
 * This allows users to easily browse past matches that are cached.
 */
export function generateDateRange(selectedDate: Date): DateItem[] {
  const dates: DateItem[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  // Show 7 days before and 3 days after the selected date
  for (let i = -7; i <= 3; i++) {
    const date = new Date(selectedDate);
    date.setDate(selectedDate.getDate() + i);
    date.setHours(0, 0, 0, 0);
    
    const isToday = isSameDay(date, today);
    
    dates.push({
      date: new Date(date),
      dayAbbr: DAY_ABBREVIATIONS[date.getDay()],
      dayNumber: date.getDate(),
      isSelected: i === 0,
      isToday,
    });
  }
  
  return dates;
}

/**
 * Formats a date to get day abbreviation and day number.
 */
export function formatDateItem(date: Date): { dayAbbr: string; dayNumber: number } {
  return {
    dayAbbr: DAY_ABBREVIATIONS[date.getDay()],
    dayNumber: date.getDate(),
  };
}

/**
 * Checks if two dates represent the same calendar day.
 */
export function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}
