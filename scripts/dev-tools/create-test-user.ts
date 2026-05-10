/**
 * Create Test User Script
 * Creates a test user in the database for API testing
 */

import prisma from './src/lib/prisma';
import { logger } from './src/utils/logger';

async function createTestUser() {
    try {
        // Check if test user already exists
        const existingUser = await prisma.user.findUnique({
            where: { username: 'testuser' }
        });

        if (existingUser) {
            logger.info('✅ Test user already exists:', {
                id: existingUser.id,
                username: existingUser.username,
                email: existingUser.email,
                clerkUserId: existingUser.clerkUserId
            });
            return existingUser;
        }

        // Create test user
        const testUser = await prisma.user.create({
            data: {
                clerkUserId: 'test_clerk_user_id_12345',
                email: 'testuser@90plus.app',
                username: 'testuser',
                displayName: 'Test User',
                avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=testuser',
                bio: 'Test user for API testing',
                coins: 1000,
                level: 5,
                xp: 500,
                isVerified: true,
                isDeveloper: false,
            }
        });

        logger.info('✅ Test user created successfully:', {
            id: testUser.id,
            username: testUser.username,
            email: testUser.email,
            clerkUserId: testUser.clerkUserId
        });

        return testUser;
    } catch (error) {
        logger.error('❌ Error creating test user:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

createTestUser();
