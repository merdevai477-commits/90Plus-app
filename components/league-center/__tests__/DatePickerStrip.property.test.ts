/**
 * Property-Based Tests for DatePickerStrip Component
 *
 * **Feature: interactive-bottom-nav, Property 1: Date Picker generates exactly 7 days centered on today**
 * **Validates: Requirements 2.1**
 *
 * **Feature: interactive-bottom-nav, Property 2: Date formatting consistency**
 * **Validates: Requirements 2.2**
 */

import * as fc from 'fast-check';
import { generateDateRange, formatDateItem, DateItem } from '../dateUtils';

const VALID_DAY_ABBREVIATIONS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// Custom arbitrary that generates valid dates only (filters out NaN dates)
const validDateArbitrary = fc
  .date({ min: new Date(2000, 0, 1), max: new Date(2100, 11, 31) })
  .filter((d) => !isNaN(d.getTime()));

describe('DatePickerStrip Property Tests', () => {
  /**
   * **Feature: interactive-bottom-nav, Property 1: Date Picker generates exactly 7 days centered on today**
   *
   * For any given "today" date, the DatePickerStrip SHALL generate exactly 7 DateItem objects where:
   * - 3 items have dates before today
   * - 1 item is today (marked as selected by default)
   * - 3 items have dates after today
   * - All items are consecutive days
   *
   * **Validates: Requirements 2.1**
   */
  describe('Property 1: Date Picker generates exactly 7 days centered on today', () => {
    it('should generate exactly 7 DateItem objects for any date (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (today: Date) => {
          const dates = generateDateRange(today);
          
          // Property: Should generate exactly 7 items
          expect(dates).toHaveLength(7);
        }),
        { numRuns: 100 }
      );
    });

    it('should have 3 days before today, today, and 3 days after (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (today: Date) => {
          const dates = generateDateRange(today);
          const todayTime = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime();
          
          // Count days before, on, and after today
          let daysBefore = 0;
          let daysToday = 0;
          let daysAfter = 0;
          
          for (const item of dates) {
            const itemTime = new Date(
              item.date.getFullYear(),
              item.date.getMonth(),
              item.date.getDate()
            ).getTime();
            
            if (itemTime < todayTime) {
              daysBefore++;
            } else if (itemTime === todayTime) {
              daysToday++;
            } else {
              daysAfter++;
            }
          }
          
          // Property: 3 days before, 1 today, 3 days after
          expect(daysBefore).toBe(3);
          expect(daysToday).toBe(1);
          expect(daysAfter).toBe(3);
        }),
        { numRuns: 100 }
      );
    });

    it('should have today marked as selected by default (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (today: Date) => {
          const dates = generateDateRange(today);
          
          // Find the item that represents today (index 3, the middle item)
          const todayItem = dates[3];
          
          // Property: Today should be marked as selected
          expect(todayItem.isSelected).toBe(true);
          expect(todayItem.isToday).toBe(true);
          
          // Property: Other items should not be selected
          for (let i = 0; i < dates.length; i++) {
            if (i !== 3) {
              expect(dates[i].isSelected).toBe(false);
              expect(dates[i].isToday).toBe(false);
            }
          }
        }),
        { numRuns: 100 }
      );
    });

    it('should have all consecutive days (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (today: Date) => {
          const dates = generateDateRange(today);
          
          // Property: Each consecutive pair should differ by exactly 1 calendar day
          for (let i = 1; i < dates.length; i++) {
            const prevDate = dates[i - 1].date;
            const currDate = dates[i].date;
            
            // Compare calendar days (ignoring time/DST issues)
            const prevDay = prevDate.getDate();
            const currDay = currDate.getDate();
            
            // Handle month boundaries: if current day is 1, previous should be last day of prev month
            // Otherwise, current day should be previous day + 1
            if (currDay === 1) {
              // Month boundary - verify months are consecutive
              const expectedPrevMonth = currDate.getMonth() === 0 ? 11 : currDate.getMonth() - 1;
              expect(prevDate.getMonth()).toBe(expectedPrevMonth);
            } else {
              expect(currDay).toBe(prevDay + 1);
            }
          }
        }),
        { numRuns: 100 }
      );
    });
  });

  /**
   * **Feature: interactive-bottom-nav, Property 2: Date formatting consistency**
   *
   * For any Date object, the formatted output SHALL contain:
   * - A valid day abbreviation (one of: Sun, Sat, Mon, Tue, Wed, Thu, Fri)
   * - A valid day number (1-31)
   *
   * **Validates: Requirements 2.2**
   */
  describe('Property 2: Date formatting consistency', () => {
    it('should return valid day abbreviation for any date (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (date: Date) => {
          const formatted = formatDateItem(date);
          
          // Property: Day abbreviation should be one of the valid values
          expect(VALID_DAY_ABBREVIATIONS).toContain(formatted.dayAbbr);
        }),
        { numRuns: 100 }
      );
    });

    it('should return valid day number (1-31) for any date (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (date: Date) => {
          const formatted = formatDateItem(date);
          
          // Property: Day number should be between 1 and 31
          expect(formatted.dayNumber).toBeGreaterThanOrEqual(1);
          expect(formatted.dayNumber).toBeLessThanOrEqual(31);
        }),
        { numRuns: 100 }
      );
    });

    it('should match the actual date values (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (date: Date) => {
          const formatted = formatDateItem(date);
          
          // Property: Day number should match the date's getDate()
          expect(formatted.dayNumber).toBe(date.getDate());
          
          // Property: Day abbreviation should match the date's day of week
          expect(formatted.dayAbbr).toBe(VALID_DAY_ABBREVIATIONS[date.getDay()]);
        }),
        { numRuns: 100 }
      );
    });

    it('should format all items in generateDateRange correctly (100 iterations)', () => {
      fc.assert(
        fc.property(validDateArbitrary, (today: Date) => {
          const dates = generateDateRange(today);
          
          for (const item of dates) {
            // Property: Each item should have valid day abbreviation
            expect(VALID_DAY_ABBREVIATIONS).toContain(item.dayAbbr);
            
            // Property: Each item should have valid day number
            expect(item.dayNumber).toBeGreaterThanOrEqual(1);
            expect(item.dayNumber).toBeLessThanOrEqual(31);
            
            // Property: Day abbreviation should match the date
            expect(item.dayAbbr).toBe(VALID_DAY_ABBREVIATIONS[item.date.getDay()]);
            
            // Property: Day number should match the date
            expect(item.dayNumber).toBe(item.date.getDate());
          }
        }),
        { numRuns: 100 }
      );
    });
  });
});
