import cron from 'node-cron';
import { logger } from '../utils/logger';
import {
  getWorldCupNewsCronSchedule,
  refreshWorldCupNewsBundle,
  warmWorldCupNewsCache,
  WorldCupNewsService,
} from './world-cup-news.service';

let started = false;

/**
 * Scheduled refresh keeps News API usage predictable (~24 calls/day at 2h intervals).
 * User traffic only reads the cached bundle.
 */
export function startWorldCupNewsRefreshCron(): void {
  if (started || !WorldCupNewsService.isConfigured()) return;
  started = true;

  const schedule = getWorldCupNewsCronSchedule();
  if (!cron.validate(schedule)) {
    logger.warn(`📰 Invalid NEWS_REFRESH_CRON "${schedule}" — news cron not started`);
    return;
  }

  warmWorldCupNewsCache().catch((err) => {
    logger.warn('World Cup news startup warm failed:', err);
  });

  cron.schedule(schedule, () => {
    refreshWorldCupNewsBundle().catch((err) => {
      logger.error('World Cup news cron refresh failed:', err);
    });
  });

  logger.info(
    `✅ World Cup news cron scheduled (${schedule}, TTL ${WorldCupNewsService.getCacheTtlMinutes()}m, budget ${process.env.NEWS_DAILY_BUDGET || 90}/day)`,
  );
}
