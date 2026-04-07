/**
 * Delete All Users Script
 * 
 * This script deletes all user accounts from the database.
 * WARNING: This is a destructive operation and cannot be undone.
 * 
 * Usage:
 *   npm run delete-all-users
 *   or
 *   ts-node scripts/delete-all-users.ts
 */

import prisma from '../src/lib/prisma';
import { logger } from '../src/utils/logger';

async function deleteAllUsers() {
    try {
        logger.info('🗑️  Starting deletion of all users...');

        // Count users before deletion
        const userCount = await prisma.user.count();
        logger.info(`📊 Found ${userCount} users in database`);

        if (userCount === 0) {
            logger.info('✅ No users to delete');
            await prisma.$disconnect();
            return;
        }

        // Delete all users (cascade will handle related data)
        const result = await prisma.user.deleteMany({});

        logger.info(`✅ Successfully deleted ${result.count} users`);

        // Verify deletion
        const remainingCount = await prisma.user.count();
        if (remainingCount === 0) {
            logger.info('✅ All users deleted successfully');
        } else {
            logger.warn(`⚠️  Warning: ${remainingCount} users still remain in database`);
        }

        await prisma.$disconnect();
        logger.info('✅ Database connection closed');
    } catch (error: any) {
        logger.error('❌ Error deleting users:', error);
        await prisma.$disconnect();
        process.exit(1);
    }
}

// Run the script
deleteAllUsers()
    .then(() => {
        logger.info('✅ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        logger.error('❌ Script failed:', error);
        process.exit(1);
    });

