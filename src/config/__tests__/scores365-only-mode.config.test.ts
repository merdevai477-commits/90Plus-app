import { isScores365OnlyMode } from '../scores365-only-mode.config';

describe('isScores365OnlyMode', () => {
  it('returns true when SCORES365_ONLY_MODE=true', () => {
    expect(
      isScores365OnlyMode({
        SCORES365_ONLY_MODE: 'true',
        SCORES365_EXPERIMENT_ENABLED: 'false',
      }),
    ).toBe(true);
  });

  it('returns false when SCORES365_ONLY_MODE=false even if experiment is on', () => {
    expect(
      isScores365OnlyMode({
        SCORES365_ONLY_MODE: 'false',
        SCORES365_EXPERIMENT_ENABLED: 'true',
      }),
    ).toBe(false);
  });

  it('defaults to experiment flag when SCORES365_ONLY_MODE is unset', () => {
    expect(
      isScores365OnlyMode({
        SCORES365_EXPERIMENT_ENABLED: 'true',
      }),
    ).toBe(true);
    expect(
      isScores365OnlyMode({
        SCORES365_EXPERIMENT_ENABLED: 'false',
      }),
    ).toBe(false);
  });
});
