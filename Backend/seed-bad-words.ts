/**
 * Seed Bad Words Database
 * Populates the BannedWord table with initial bad words list
 */

import prisma from './src/lib/prisma';
import { logger } from './src/utils/logger';

// Arabic bad words
const ARABIC_BAD_WORDS = [
    'كلب', 'حمار', 'غبي', 'احمق', 'خنزير', 'قذر', 'وسخ', 'عاهر', 'شرموط',
    'كس', 'زب', 'عرص', 'متناك', 'ابن الكلب', 'ابن الشرموطة', 'يا كلب',
    'يا حمار', 'يا غبي', 'يا احمق', 'لعنة', 'تفو', 'قرف', 'حقير'
];

// English bad words
const ENGLISH_BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'ass', 'asshole', 'bastard', 'damn', 'hell',
    'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'fag', 'nigger',
    'retard', 'idiot', 'stupid', 'dumb', 'moron', 'piss', 'crap'
];

async function seedBadWords() {
    try {
        logger.info('🌱 Starting bad words seeding...');

        let addedCount = 0;
        let skippedCount = 0;

        // Seed Arabic words
        logger.info('📝 Seeding Arabic bad words...');
        for (const word of ARABIC_BAD_WORDS) {
            try {
                await prisma.bannedWord.upsert({
                    where: { word },
                    create: {
                        word,
                        language: 'ar',
                        severity: 'HIGH',
                        category: 'profanity',
                        isActive: true,
                    },
                    update: {
                        isActive: true,
                    },
                });
                addedCount++;
                logger.info(`  ✅ Added: ${word}`);
            } catch (error) {
                skippedCount++;
                logger.warn(`  ⚠️ Skipped: ${word}`);
            }
        }

        // Seed English words
        logger.info('📝 Seeding English bad words...');
        for (const word of ENGLISH_BAD_WORDS) {
            try {
                await prisma.bannedWord.upsert({
                    where: { word },
                    create: {
                        word,
                        language: 'en',
                        severity: 'HIGH',
                        category: 'profanity',
                        isActive: true,
                    },
                    update: {
                        isActive: true,
                    },
                });
                addedCount++;
                logger.info(`  ✅ Added: ${word}`);
            } catch (error) {
                skippedCount++;
                logger.warn(`  ⚠️ Skipped: ${word}`);
            }
        }

        logger.info('');
        logger.info('✅ Bad words seeding completed!');
        logger.info(`📊 Statistics:`);
        logger.info(`  - Added: ${addedCount} words`);
        logger.info(`  - Skipped: ${skippedCount} words`);
        logger.info(`  - Total: ${ARABIC_BAD_WORDS.length + ENGLISH_BAD_WORDS.length} words`);

    } catch (error) {
        logger.error('❌ Error seeding bad words:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

// Run seeding
seedBadWords()
    .then(() => {
        logger.info('🎉 Seeding process completed successfully!');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('💥 Seeding process failed:', error);
        process.exit(1);
    });
