import { isArabicText } from '../chatTextUtils';

describe('isArabicText', () => {
  it('detects an Arabic player name', () => {
    expect(isArabicText('محمد صلاح')).toBe(true);
  });

  it('detects Arabic sentences with a few latin tokens', () => {
    expect(isArabicText('بروفايل اللاعب في 90Plus')).toBe(true);
  });

  it('rejects English copy', () => {
    expect(isArabicText('Mohamed Salah')).toBe(false);
  });
});
