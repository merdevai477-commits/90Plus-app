/**
 * Seed Transfers Script
 * يقوم بتحميل الانتقالات من API-Football وحفظها في الـ Database
 * 
 * Usage:
 *   npm run seed:transfers
 * 
 * أو مع دوريات محددة:
 *   npm run seed:transfers -- --leagues=39,140,78
 */

import dotenv from 'dotenv';
import { logger } from '../utils/logger';
import { footballService } from '../services/football.service';
import prisma from '../lib/prisma';

// Load environment variables
dotenv.config();

// Configuration - Major League IDs
const MAJOR_LEAGUES = {
  PREMIER_LEAGUE: 39,
  LA_LIGA: 140,
  BUNDESLIGA: 78,
  SERIE_A: 135,
  LIGUE_1: 61,
};

const DEFAULT_LEAGUES = [
  MAJOR_LEAGUES.PREMIER_LEAGUE,    // 39 - Premier League
  MAJOR_LEAGUES.LA_LIGA,           // 140 - La Liga
  MAJOR_LEAGUES.BUNDESLIGA,        // 78 - Bundesliga
  MAJOR_LEAGUES.SERIE_A,           // 135 - Serie A
  MAJOR_LEAGUES.LIGUE_1,           // 61 - Ligue 1
];

const CURRENT_YEAR = new Date().getFullYear();
const LAST_YEAR = CURRENT_YEAR - 1;

interface SeedOptions {
  leagues?: number[];
  year?: number;
  force?: boolean; // Force re-seed even if data exists
}

/**
 * Parse command line arguments
 */
function parseArgs(): SeedOptions {
  const args = process.argv.slice(2);
  const options: SeedOptions = {};

  args.forEach(arg => {
    if (arg.startsWith('--leagues=')) {
      const leaguesStr = arg.split('=')[1];
      options.leagues = leaguesStr.split(',').map(id => parseInt(id.trim()));
    } else if (arg.startsWith('--year=')) {
      options.year = parseInt(arg.split('=')[1]);
    } else if (arg === '--force') {
      options.force = true;
    }
  });

  return options;
}

/**
 * Check if transfers already exist for a league and year
 */
async function checkExistingTransfers(leagueId: number, year: number): Promise<number> {
  try {
    // Check in database if we have transfers for this league and year
    // Note: This is a simple check - you might want to add a transfers table
    // For now, we'll just return 0 to always seed
    return 0;
  } catch (error) {
    logger.error(`Error checking existing transfers for league ${leagueId}:`, error);
    return 0;
  }
}

/**
 * Seed transfers for a specific league and year
 * Note: The current football.service.ts doesn't support league/year filtering for transfers
 * This would need to be enhanced or use a different approach
 */
async function seedLeagueTransfers(leagueId: number, year: number): Promise<number> {
  try {
    logger.info(`📥 Fetching transfers for league ${leagueId}, year ${year}...`);
    
    // Note: The Backend's footballService.getTransfers() doesn't support league/year parameters
    // It only supports team and player parameters
    // You would need to either:
    // 1. Enhance the football.service.ts to support league/year filtering
    // 2. Fetch all transfers and filter client-side (expensive)
    // 3. Use a different approach like fetching teams first, then their transfers
    
    logger.warn(`⚠️ Transfer seeding by league/year is not yet implemented in football.service.ts`);
    logger.info(`💡 The service currently supports filtering by team or player only`);
    
    return 0;
    
    // Example of how it could work if enhanced:
    // const transfers = await footballService.getTransfers({ team: teamId });
    
  } catch (error: any) {
    logger.error(`❌ Error seeding transfers for league ${leagueId}:`, error.message);
    return 0;
  }
}

/**
 * Main seeding function
 */
async function seedTransfers() {
  const startTime = Date.now();
  logger.info('🌱 Starting transfers seeding...\n');

  try {
    // Parse command line arguments
    const options = parseArgs();
    const leagues = options.leagues || DEFAULT_LEAGUES;
    const year = options.year || LAST_YEAR; // Default to last year (completed season)
    const force = options.force || false;

    logger.info('📋 Seeding configuration:');
    logger.info(`   Leagues: ${leagues.join(', ')}`);
    logger.info(`   Year: ${year}`);
    logger.info(`   Force: ${force ? 'Yes' : 'No'}`);
    logger.info('');

    // Check API key
    if (!process.env.FOOTBALL_API_KEY) {
      throw new Error('FOOTBALL_API_KEY not found in environment variables');
    }

    let totalTransfers = 0;
    let successCount = 0;
    let skipCount = 0;

    // Seed each league
    for (const leagueId of leagues) {
      logger.info(`\n${'='.repeat(60)}`);
      logger.info(`Processing League ${leagueId}...`);
      logger.info('='.repeat(60));

      // Check if already seeded (unless force is true)
      if (!force) {
        const existingCount = await checkExistingTransfers(leagueId, year);
        if (existingCount > 0) {
          logger.info(`⏭️ Skipping league ${leagueId} - already has ${existingCount} transfers`);
          skipCount++;
          continue;
        }
      }

      // Seed the league
      const count = await seedLeagueTransfers(leagueId, year);
      
      if (count > 0) {
        totalTransfers += count;
        successCount++;
        logger.info(`✅ Successfully seeded ${count} transfers for league ${leagueId}`);
      } else {
        logger.warn(`⚠️ No transfers seeded for league ${leagueId}`);
      }

      // Add delay between requests to avoid rate limiting
      if (leagues.indexOf(leagueId) < leagues.length - 1) {
        logger.info('⏳ Waiting 2 seconds before next league...');
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Summary
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    logger.info('\n' + '='.repeat(60));
    logger.info('📊 Seeding Summary:');
    logger.info('='.repeat(60));
    logger.info(`✅ Successfully seeded: ${successCount} leagues`);
    logger.info(`⏭️ Skipped: ${skipCount} leagues`);
    logger.info(`📦 Total transfers: ${totalTransfers}`);
    logger.info(`⏱️ Duration: ${duration}s`);
    logger.info('='.repeat(60));

    if (successCount > 0) {
      logger.info('\n✨ Transfers seeding completed successfully!');
      logger.info('💡 The data is now cached and ready to use.');
    } else {
      logger.warn('\n⚠️ No new transfers were seeded.');
      logger.info('💡 Use --force flag to re-seed existing data.');
    }

  } catch (error: any) {
    logger.error('\n❌ Seeding failed:', error.message);
    logger.error('Stack:', error.stack);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

/**
 * Run the seeding
 */
if (require.main === module) {
  seedTransfers()
    .then(() => {
      logger.info('\n👋 Seeding process completed.');
      process.exit(0);
    })
    .catch((error) => {
      logger.error('\n❌ Seeding process failed:', error);
      process.exit(1);
    });
}

export { seedTransfers };
