import {
  SENTRY_ERROR_MAX_PER_SIGNATURE,
  SENTRY_GLOBAL_MAX_PER_WINDOW,
  SENTRY_REPORT_WINDOW_MS,
  SENTRY_WARN_MAX_PER_SIGNATURE,
  __resetSentryReportLimiterForTests,
  allowSentryReport,
  fingerprintSentryMessage,
} from '../sentry-report-limiter';

describe('sentry-report-limiter', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-09-05T12:00:00.000Z'));
    __resetSentryReportLimiterForTests();
  });

  afterEach(() => {
    jest.useRealTimers();
    __resetSentryReportLimiterForTests();
  });

  it('fingerprints empty-upstream warnings per fixture, ignoring numeric ids in the template', () => {
    const a = fingerprintSentryMessage(
      'warn',
      '[365Events] fixture=4828772 reason=upstream_empty gameId=4828772 rawEvents=0',
    );
    const b = fingerprintSentryMessage(
      'warn',
      '[365Events] fixture=1111111 reason=upstream_empty gameId=1111111 rawEvents=0',
    );
    const aAgain = fingerprintSentryMessage(
      'warn',
      '[365Events] fixture=4828772 reason=upstream_empty gameId=4828772 rawEvents=0',
    );
    expect(a).toBe(aAgain);
    expect(a).not.toBe(b);
    expect(a).toContain('fx=4828772');
  });

  it('allows only the first N identical empty-data warnings per fixture per hour', () => {
    const msg =
      '[365Events] fixture=4828772 reason=upstream_empty gameId=4828772 rawEvents=0';
    const sent: boolean[] = [];
    for (let i = 0; i < 50; i += 1) {
      sent.push(allowSentryReport('warn', msg));
    }
    const forwarded = sent.filter(Boolean).length;
    expect(forwarded).toBe(SENTRY_WARN_MAX_PER_SIGNATURE);
    expect(forwarded).toBeLessThan(50);
    expect(sent.slice(0, SENTRY_WARN_MAX_PER_SIGNATURE).every(Boolean)).toBe(true);
    expect(sent.slice(SENTRY_WARN_MAX_PER_SIGNATURE).every((v) => v === false)).toBe(
      true,
    );
  });

  it('does not let fixture A consume fixture B budget', () => {
    for (let i = 0; i < SENTRY_WARN_MAX_PER_SIGNATURE; i += 1) {
      expect(
        allowSentryReport(
          'warn',
          '[Lineups] fixture=4828772 reason=upstream_empty source=365',
        ),
      ).toBe(true);
    }
    expect(
      allowSentryReport(
        'warn',
        '[Lineups] fixture=4828772 reason=upstream_empty source=365',
      ),
    ).toBe(false);
    expect(
      allowSentryReport(
        'warn',
        '[Lineups] fixture=4000001 reason=upstream_empty source=365',
      ),
    ).toBe(true);
  });

  it('resets the per-signature cap after the window elapses', () => {
    const msg = '[Events] fixture=4828772 reason=upstream_empty source=365 count=0';
    for (let i = 0; i < SENTRY_WARN_MAX_PER_SIGNATURE; i += 1) {
      expect(allowSentryReport('warn', msg)).toBe(true);
    }
    expect(allowSentryReport('warn', msg)).toBe(false);
    jest.setSystemTime(new Date('2026-09-05T13:00:00.000Z'));
    expect(allowSentryReport('warn', msg)).toBe(true);
  });

  it('caps 404s per request path so /health cannot storm Sentry', () => {
    for (let i = 0; i < SENTRY_WARN_MAX_PER_SIGNATURE; i += 1) {
      expect(
        allowSentryReport('warn', '404 - Route not found', { path: '/health' }),
      ).toBe(true);
    }
    expect(
      allowSentryReport('warn', '404 - Route not found', { path: '/health' }),
    ).toBe(false);
    expect(
      allowSentryReport('warn', '404 - Route not found', { path: '/unknown' }),
    ).toBe(true);
  });

  it('allows a higher per-signature budget for errors than warnings', () => {
    const msg = 'Query failed: MatchEvent.create unique constraint';
    const sent: boolean[] = [];
    for (let i = 0; i < 20; i += 1) {
      sent.push(allowSentryReport('error', msg));
    }
    expect(sent.filter(Boolean).length).toBe(SENTRY_ERROR_MAX_PER_SIGNATURE);
  });

  it('enforces a global hourly backstop across signatures', () => {
    let forwarded = 0;
    for (let i = 0; i < SENTRY_GLOBAL_MAX_PER_WINDOW + 10; i += 1) {
      if (allowSentryReport('warn', `[365Events] fixture=${4_000_000 + i} reason=upstream_empty`)) {
        forwarded += 1;
      }
    }
    expect(forwarded).toBe(SENTRY_GLOBAL_MAX_PER_WINDOW);
  });

  it('keeps the window duration at one hour', () => {
    expect(SENTRY_REPORT_WINDOW_MS).toBe(60 * 60 * 1000);
  });
});
