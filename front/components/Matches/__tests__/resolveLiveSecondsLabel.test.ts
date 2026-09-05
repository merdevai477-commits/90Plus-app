jest.mock('../../../utils/logger', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn(), log: jest.fn() },
}));

import { logger } from '../../../utils/logger';
import { MAX_LEAD_SEC, resolveLiveSecondsLabel } from '../liveMatchClock';

describe('resolveLiveSecondsLabel MAX_LEAD_SEC', () => {
  const NOW_SEC = 1_700_000_000;

  /** 1H, API elapsed 10' → floor 600s. Local clock is `leadSec` ahead of that floor. */
  function labelAtLead(leadSec: number): string | undefined {
    const elapsedFloorSec = 10 * 60;
    const startTimestamp = NOW_SEC - (elapsedFloorSec + leadSec);
    return resolveLiveSecondsLabel('1H', 10, {
      startTimestamp,
      nowSec: NOW_SEC,
    });
  }

  it('exports the 45s cap (not the old 90s runaway)', () => {
    expect(MAX_LEAD_SEC).toBe(45);
  });

  it('leads the API elapsed normally at 44s (under the cap)', () => {
    expect(labelAtLead(44)).toBe('10:44');
  });

  it('clamps at the 45s boundary and at 46s+', () => {
    const debugSpy = jest.spyOn(logger, 'debug').mockImplementation(() => undefined);
    try {
      expect(labelAtLead(45)).toBe('10:45');
      expect(debugSpy).not.toHaveBeenCalled();
      expect(labelAtLead(46)).toBe('10:45');
      expect(debugSpy).toHaveBeenCalled();
      expect(String(debugSpy.mock.calls[0][0])).toContain('MAX_LEAD_SEC=45');
      expect(labelAtLead(90)).toBe('10:45');
    } finally {
      debugSpy.mockRestore();
    }
  });

  it('never goes backward when the local clock is behind API elapsed', () => {
    const elapsedFloorSec = 10 * 60;
    const behindBySec = 30;
    const startTimestamp = NOW_SEC - (elapsedFloorSec - behindBySec);
    expect(
      resolveLiveSecondsLabel('1H', 10, { startTimestamp, nowSec: NOW_SEC }),
    ).toBe('10:00');
  });
});
