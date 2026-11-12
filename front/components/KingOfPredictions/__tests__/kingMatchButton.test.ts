import { kingCardButton, matchHasStarted } from '../kingMatchButton';

describe('king card button', () => {
  it('stays open before kickoff', () => {
    expect(matchHasStarted('upcoming', Date.now() + 60_000, Date.now())).toBe(false);
    expect(kingCardButton({
      dayPassed: false,
      started: false,
      live: false,
      verdict: null,
    })).toEqual({ state: 'open', locked: false, closedKind: null });
  });

  it('turns gray while the match is being played and no pick was saved', () => {
    expect(kingCardButton({
      dayPassed: false,
      started: true,
      live: true,
      verdict: null,
    })).toEqual({ state: 'closed', locked: true, closedKind: 'live' });
  });

  it('turns gray after the match or the day, with no pick', () => {
    expect(kingCardButton({
      dayPassed: false,
      started: true,
      live: false,
      verdict: null,
    }).closedKind).toBe('played');
    expect(kingCardButton({
      dayPassed: true,
      started: false,
      live: true,
      verdict: null,
    }).closedKind).toBe('played');
  });

  it('keeps a saved pick visible and locks it after kickoff', () => {
    expect(kingCardButton({
      dayPassed: false,
      started: false,
      live: false,
      verdict: 'pending',
    })).toMatchObject({ state: 'pending', locked: false });
    expect(kingCardButton({
      dayPassed: false,
      started: true,
      live: true,
      verdict: 'pending',
    })).toMatchObject({ state: 'pending', locked: true, closedKind: null });
    expect(kingCardButton({
      dayPassed: false,
      started: true,
      live: false,
      verdict: 'correct',
    }).state).toBe('correct');
  });
});
