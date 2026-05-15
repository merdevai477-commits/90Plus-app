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

  test('levelFromXp returns 1 for xp < 290', () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 289 }), (xp) => {
        return levelFromXp(xp) === 1;
      }),
      { numRuns: 100 },
    );
  });

  test('levelFromXp returns 2 for xp in [290, 789]', () => {
    fc.assert(
      fc.property(fc.integer({ min: 290, max: 789 }), (xp) => {
        return levelFromXp(xp) === 2;
      }),
      { numRuns: 100 },
    );
  });

  test('known level thresholds match spec', () => {
    expect(xpForLevel(1)).toBe(0);
    expect(xpForLevel(2)).toBe(290);
    expect(xpForLevel(3)).toBe(790);
    expect(xpForLevel(5)).toBe(2540);
    expect(xpForLevel(10)).toBe(11290);
    expect(xpForLevel(20)).toBe(47540);
    expect(xpForLevel(50)).toBe(306290);
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

  test('xpForLevel(N) boundary: levelFromXp(xpForLevel(N) - 1) === N - 1 for N >= 2', () => {
    fc.assert(
      fc.property(fc.integer({ min: 2, max: 200 }), (level) => {
        const xpJustBelow = xpForLevel(level) - 1;
        return levelFromXp(xpJustBelow) === level - 1;
      }),
      { numRuns: 500 },
    );
  });
});
