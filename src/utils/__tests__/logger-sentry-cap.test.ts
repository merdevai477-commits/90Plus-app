jest.mock('@sentry/node', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

import * as Sentry from '@sentry/node';
import { createLogger } from '../logger';
import {
  SENTRY_WARN_MAX_PER_SIGNATURE,
  __resetSentryReportLimiterForTests,
} from '../sentry-report-limiter';

describe('logger Sentry transport cap', () => {
  const prevEnv = process.env.NODE_ENV;
  const prevDsn = process.env.SENTRY_DSN;

  beforeEach(() => {
    jest.clearAllMocks();
    __resetSentryReportLimiterForTests();
    process.env.NODE_ENV = 'production';
    process.env.SENTRY_DSN = 'https://example@sentry.io/1';
  });

  afterAll(() => {
    process.env.NODE_ENV = prevEnv;
    if (prevDsn === undefined) delete process.env.SENTRY_DSN;
    else process.env.SENTRY_DSN = prevDsn;
    __resetSentryReportLimiterForTests();
  });

  it('sends only the first few of 50 identical empty-data warnings to Sentry', () => {
    const log = createLogger({ enableTimestamp: false, level: 'warn' });
    const msg =
      '[365Events] fixture=4828772 reason=upstream_empty gameId=4828772 rawEvents=0';
    for (let i = 0; i < 50; i += 1) {
      log.warn(msg);
    }
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(SENTRY_WARN_MAX_PER_SIGNATURE);
    expect(Sentry.captureException).not.toHaveBeenCalled();
  });
});
