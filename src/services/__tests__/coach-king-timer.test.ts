import { coachKingTimerVisible } from '../coach-king-timer';

describe('coachKingTimerVisible', () => {
  it('hides the timer while picks are open and shows it after the round closes', () => {
    expect(coachKingTimerVisible(true, 'auto')).toBe(false);
    expect(coachKingTimerVisible(false, 'auto')).toBe(true);
    expect(coachKingTimerVisible(true, undefined)).toBe(false);
  });

  it('lets the server force the timer on or off', () => {
    expect(coachKingTimerVisible(true, 'on')).toBe(true);
    expect(coachKingTimerVisible(false, 'off')).toBe(false);
    expect(coachKingTimerVisible(false, 'hide')).toBe(false);
    expect(coachKingTimerVisible(true, '0')).toBe(false);
  });
});
