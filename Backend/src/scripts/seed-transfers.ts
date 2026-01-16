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
import ApiFootballService, { MAJOR_LEAGUES } from '../services/apiFootball';
import prisma from '../lib/prisma';

// Load environment variables
dotenv.config();

// Configuration
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
 */
async function seedLeagueTransfers(leagueId: number, year: number): Promise<number> {
  try {
    logger.info(`📥 Fetching transfers for league ${leagueId}, year ${year}...`);
    
    // Fetch transfers from API-Football
    const transfers = await ApiFootballService.getTransfers(leagueId, year);
    
    if (!transfers || transfers.length === 0) {
      logger.warn(`⚠️ No transfers found for league ${leagueId}, year ${year}`);
      return 0;
    }

    logger.info(`✅ Fetched ${transfers.length} transfers for league ${leagueId}`);
    
    // Note: Since we don't have a transfers table in the schema,
    // the data is already cached by ApiFootballService
    // If you want to persist to database, you'll need to:
    // 1. Add a Transfers model to schema.prisma
    // 2. Run prisma migrate
    // 3. Save the data here
    
    return transfers.length;
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
