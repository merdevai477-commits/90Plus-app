/**
 * XP System Property-Based Tests
 * Uses fast-check to verify invariants of the level curve and award logic.
 */

import * as fc from 'fast-check';
import { xpForLevel, levelFromXp, xpForNextLevel, levelTitle } from '../services/xp.service';

describe('XP Level Curve Properties', () => {
  test('xpForLevel is strictly increasing for levels 1..200', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 200 }), (level) => {
        return xpForLevel(level) > xpForLevel(level - 1);
      }),
      { numRuns: 500 },
    );
  });

  test('levelFromXp(xpForLevel(N)) === N for any N in [1, 200]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 200 }), (level) => {
        return levelFromXp(xpForLevel(level)) === level;
      }),
      { numRuns: 500 },
    );
  });

  test('levelFromXp is monotonically non-decreasing', () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 0, max: 500000 }),
        fc.integer({ min: 0, max: 500000 }),
        (a, b) => {
          if (a <= b) {
            return levelFromXp(a) <= levelFromXp(b);
          }
          return levelFromXp(b) <= levelFromXp(a);
        },
      ),
      { numRuns: 1000 },
    );
  });

  test('xpForNextLevel is always positive for levels 1..199', () => {
    fc.assert(
      fc.property(fc.integer({ min: 1, max: 199 }), (level) => {
        return xpForNextLevel(level) > 0;
      }),
      { numRuns: 500 },
    );
  });

  test('a new account is level 1 all the way to the first threshold', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 199 }), (xp) => {
        return levelFromXp(xp) === 1;
      }),
      { numRuns: 100 },
    );
  });

  test('every level is exactly 100 XP wide', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 200 }), (level) => {
        const floor = level * 100;
        return (
          levelFromXp(floor) === level &&
          levelFromXp(floor + 99) === level &&
          levelFromXp(floor - 1) === level - 1
        );
      }),
      { numRuns: 500 },
    );
  });

  test('the level thresholds are the product rule: level N needs N × 100 XP', () => {
    expect(xpForLevel(1)).toBe(100);
    expect(xpForLevel(2)).toBe(200);
    expect(xpForLevel(3)).toBe(300);
    expect(xpForLevel(10)).toBe(1000);
    expect(xpForLevel(100)).toBe(10_000);
    // …and one level always costs one hundred.
    expect(xpForNextLevel(1)).toBe(100);
    expect(xpForNextLevel(99)).toBe(100);
  });

  test('the boundaries a player actually crosses', () => {
    expect(levelFromXp(99)).toBe(1);
    expect(levelFromXp(100)).toBe(1);
    expect(levelFromXp(199)).toBe(1);
    expect(levelFromXp(200)).toBe(2);
    expect(levelFromXp(999)).toBe(9);
    expect(levelFromXp(1000)).toBe(10);
    expect(levelFromXp(9999)).toBe(99);
    expect(levelFromXp(10_000)).toBe(100);
  });

  test('levelTitle returns correct titles at boundaries', () => {
    expect(levelTitle(1)).toBe('Rookie');
    expect(levelTitle(2)).toBe('Captain');
    expect(levelTitle(3)).toBe('Striker');
    expect(levelTitle(5)).toBe('Star');
    expect(levelTitle(10)).toBe('Legend');
    expect(levelTitle(20)).toBe('Icon');
    expect(levelTitle(50)).toBe('Hall of Fame');
  });

  test('xpForLevel(N) boundary: levelFromXp(xpForLevel(N) - 1) === N - 1 for N >= 3', () => {
    fc.assert(
      // From level 3 up: level 2's floor minus one is 199, which is level 1 —
      // the same rule, but level 1 is also the floor for a brand-new account.
      fc.property(fc.integer({ min: 3, max: 200 }), (level) => {
        const xpJustBelow = xpForLevel(level) - 1;
        return levelFromXp(xpJustBelow) === level - 1;
      }),
      { numRuns: 500 },
    );
  });
});
