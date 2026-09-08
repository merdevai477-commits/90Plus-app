import { formatMatchCardDate } from '../utils';

const AR = ['حد', 'اتنين', 'تلات', 'اربع', 'خميس', 'جمعه', 'سبت'] as const;
const EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;

describe('formatMatchCardDate', () => {
  it('prefixes the weekday for a Saturday kickoff', () => {
    const saturday = new Date(2026, 8, 5);
    expect(formatMatchCardDate(saturday, AR)).toMatch(/^سبت · /);
    expect(formatMatchCardDate(saturday, EN)).toMatch(/^Sat · /);
  });

  it('prefixes Thursday in Egyptian weekday labels', () => {
    const thursday = new Date(2026, 8, 3);
    expect(formatMatchCardDate(thursday, AR)).toMatch(/^خميس · /);
  });

  it('returns an empty string for an invalid date', () => {
    expect(formatMatchCardDate(null, AR)).toBe('');
    expect(formatMatchCardDate(new Date('not-a-date'), AR)).toBe('');
  });
});
