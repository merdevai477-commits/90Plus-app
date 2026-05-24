/**
 * Daily cron: awards ranking badges for all categories.
 */

import { logger } from '../utils/logger';
import { runDailyRankingBadgesCron } from './rankings.service';

export async function runRankingBadgesJob(): Promise<void> {
  try {
    logger.info('⏰ Cron: Awarding daily ranking badges...');
    await runDailyRankingBadgesCron();
    logger.info('✅ Daily ranking badges awarded');
  } catch (error) {
    logger.error('❌ Ranking badges cron failed:', error);
  }
}
