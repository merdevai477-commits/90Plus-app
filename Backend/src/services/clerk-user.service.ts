import { clerkClient } from '@clerk/clerk-sdk-node';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

// ✅ Cache for Clerk API responses (5 minutes TTL)
const clerkUserCache = new Map<string, { data: any; timestamp: number }>();
const CLERK_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

// ✅ OPTIMIZED: Timeout wrapper with retry for Clerk API calls
const clerkApiWithTimeout = async <T>(
    apiCall: () => Promise<T>,
    timeoutMs: number = 8000, // ✅ Reduced to 8 seconds
    retries: number = 2 // ✅ Added retry logic
): Promise<T> => {
    let lastError: Error | null = null;
    
    for (let attempt = 0; attempt < retries; attempt++) {
        try {
            return await Promise.race([
                apiCall(),
                new Promise<T>((_, reject) =>
                    setTimeout(() => reject(new Error('Clerk API timeout')), timeoutMs)
                ),
            ]);
        } catch (error: any) {
            lastError = error;
            if (attempt < retries - 1) {
                logger.warn(`[Clerk API] Retry ${attempt + 1}/${retries - 1}...`);
                await new Promise(resolve => setTimeout(resolve, 500)); // 500ms delay
            }
        }
    }
    
    throw lastError || new Error('Clerk API failed after retries');
};

export class ClerkUserService {
    /**
     * Find or create user from Clerk ID
     * This syncs Clerk user data with our database
     * ✅ OPTIMIZED: Added caching and timeout for Clerk API
     */
    static async findOrCreateUser(clerkUserId: string) {
        try {
            logger.info(`[findOrCreateUser] � Looking for user: ${clerkUserId}`);
            
            // Check if user exists by clerkUserId
            let user = await prisma.user.findUnique({
                where: { clerkUserId },
            });

            if (user) {
                logger.info(`[findOrCreateUser] ✅ User found: ${user.username} (${user.id})`);
                // Update login streak for existing user (non-blocking)
                this.updateLoginStreak(user.id).catch(err => 
                    logger.warn(`[findOrCreateUser] ⚠️ Failed to update login streak:`, err)
                );
                return user;
            }

            logger.info(`[findOrCreateUser] � User not found, fetching from Clerk...`);

            // ✅ Check Clerk cache first
            const cached = clerkUserCache.get(clerkUserId);
            let clerkUser;
            
            if (cached && Date.now() - cached.timestamp < CLERK_CACHE_TTL) {
                logger.info(`[findOrCreateUser] ⚡ Using cached Clerk data`);
                clerkUser = cached.data;
            } else {
                // User doesn't exist, fetch from Clerk with timeout and retry
                try {
                    clerkUser = await clerkApiWithTimeout(
                        () => clerkClient.users.getUser(clerkUserId),
                        8000, // ✅ 8 seconds timeout
                        2 // ✅ 2 retries
                    );
                    logger.info(`[findOrCreateUser] ✅ Clerk user fetched: ${clerkUser.id}`);
                    
                    // ✅ Cache the Clerk response
                    clerkUserCache.set(clerkUserId, {
                        data: clerkUser,
                        timestamp: Date.now(),
                    });
                } catch (clerkError: any) {
                    logger.error(`[findOrCreateUser] ❌ Failed to fetch from Clerk after retries:`, clerkError);
                    
                    // ✅ If Clerk API fails, create user with minimal data
                    logger.warn(`[findOrCreateUser] ⚠️ Creating user with minimal data (Clerk unavailable)`);
                    
                    // Create user with clerkUserId only
                    const minimalUsername = `user_${clerkUserId.slice(-8)}`;
                    const minimalEmail = `${clerkUserId}@clerk.temp`;
                    
                    try {
                        user = await prisma.user.create({
                            data: {
                                clerkUserId,
                                email: minimalEmail,
                                username: minimalUsername,
                                displayName: minimalUsername,
                                emailVerified: false,
                                coins: 50,
                                level: 1,
                                xp: 0,
                            },
                        });
                        
                        logger.info(`[findOrCreateUser] ✅ Minimal user created: ${user.username}`);
                        return user;
                    } catch (createError: any) {
                        // If user already exists, fetch it
                        if (createError.code === 'P2002') {
                            user = await prisma.user.findUnique({ where: { clerkUserId } });
                            if (user) return user;
                        }
                        throw createError;
                    }
                }
            }

            // Get primary email
            const primaryEmail = clerkUser.emailAddresses.find(
                (email: any) => email.id === clerkUser.primaryEmailAddressId
            );

            if (!primaryEmail) {
                logger.error(`[findOrCreateUser] ❌ No email found for user ${clerkUserId}`);
                throw new Error('No email found for user');
            }

            logger.info(`[findOrCreateUser] 📧 Primary email: ${primaryEmail.emailAddress}`);

            // ✅ OPTIMIZED: Simplified email generation
            const emailParts = primaryEmail.emailAddress.split('@');
            const shortId = clerkUserId.replace('user_', '').slice(-8);
            const finalEmail = `${emailParts[0]}+${shortId}@${emailParts[1]}`;

            logger.info(`[findOrCreateUser] 📧 Using email: ${finalEmail}`);

            // ✅ OPTIMIZED: Simplified username generation
            const baseUsername = clerkUser.username || 
                primaryEmail.emailAddress.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
            
            const username = `${baseUsername}_${shortId}`;

            logger.info(`[findOrCreateUser] 👤 Using username: ${username}`);

            // Create new user
            try {
                user = await prisma.user.create({
                    data: {
                        clerkUserId,
                        email: finalEmail,
                        username,
                        displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || username,
                        avatar: clerkUser.imageUrl || undefined,
                        emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
                        coins: 50,
                        level: 1,
                        xp: 0,
                    },
                });

                logger.info(`[findOrCreateUser] ✅ User created: ${user.username} (${user.id})`);
            } catch (createError: any) {
                logger.error(`[findOrCreateUser] ❌ Failed to create user:`, createError);
                
                // ✅ If unique constraint fails, try to find existing user
                if (createError.code === 'P2002') {
                    logger.warn(`[findOrCreateUser] ⚠️ User already exists, fetching...`);
                    user = await prisma.user.findUnique({
                        where: { clerkUserId },
                    });
                    if (user) return user;
                }
                
                throw new Error(`Failed to create user in database: ${createError.message}`);
            }
            
            // Update login streak for new user (non-blocking)
            this.updateLoginStreak(user.id).catch(err => 
                logger.warn(`[findOrCreateUser] ⚠️ Failed to update login streak:`, err)
            );
            
            return user;
        } catch (error: any) {
            logger.error('[findOrCreateUser] ❌ Unexpected error:', error);
            logger.error('[findOrCreateUser] Error stack:', error.stack);
            throw error;
        }
    }

    /**
     * Update user login streak
     * Calculates consecutive login days based on lastLoginDate
     */
    private static async updateLoginStreak(userId: string): Promise<void> {
        try {
            const user = await prisma.user.findUnique({
                where: { id: userId },
                select: { lastLoginDate: true, consecutiveLoginDays: true },
            });

            if (!user) {
                return;
            }

            const now = new Date();
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            
            // If user has never logged in, set to 1 day
            if (!user.lastLoginDate) {
                await prisma.user.update({
                    where: { id: userId },
                    data: {
                        lastLoginDate: today,
                        consecutiveLoginDays: 1,
                    },
                });
                return;
            }

            const lastLogin = new Date(user.lastLoginDate);
            const lastLoginDate = new Date(lastLogin.getFullYear(), lastLogin.getMonth(), lastLogin.getDate());
            
            // Calculate days difference
            const daysDiff = Math.floor((today.getTime() - lastLoginDate.getTime()) / (1000 * 60 * 60 * 24));

            let newStreak = user.consecutiveLoginDays;

            if (daysDiff === 0) {
                // Same day - no change needed
                return;
            } else if (daysDiff === 1) {
                // Consecutive day - increment streak
                newStreak = user.consecutiveLoginDays + 1;
            } else {
                // More than 1 day - reset streak to 1
                newStreak = 1;
            }

            await prisma.user.update({
                where: { id: userId },
                data: {
                    lastLoginDate: today,
                    consecutiveLoginDays: newStreak,
                },
            });

            logger.info(`Updated login streak for user ${userId}: ${newStreak} days`);
        } catch (error) {
            logger.error('Error updating login streak:', error);
            // Don't throw - login streak update shouldn't fail the login
        }
    }

    /**
     * Get user by Clerk ID
     */
    static async getUserByClerkId(clerkUserId: string) {
        return await prisma.user.findUnique({
            where: { clerkUserId },
            select: {
                id: true,
                clerkUserId: true,
                email: true,
                username: true,
                displayName: true,
                avatar: true,
                bio: true,
                coins: true,
                level: true,
                xp: true,
                isVerified: true,
                isDeveloper: true,
                favoriteTeam: true,
                // FIFA Card fields
                position: true,
                countryFlag: true,
                age: true,
                height: true,
                weight: true,
                preferredFoot: true,
                lastUsernameChange: true,
                // Cover image
                coverImage: true,
                createdAt: true,
                updatedAt: true,
            },
        });
    }

    /**
     * Update user profile
     */
    static async updateUser(clerkUserId: string, data: {
        username?: string;
        displayName?: string;
        bio?: string;
        avatar?: string;
        favoriteTeam?: string;
    }) {
        // First check if user exists
        let user = await prisma.user.findUnique({
            where: { clerkUserId },
        });

        // If user doesn't exist, create them first
        if (!user) {
            logger.info('⚠️ User not found, creating first...');
            user = await this.findOrCreateUser(clerkUserId);
        }

        // Check if username is being changed
        if (data.username && data.username !== user.username) {
            // Check 15 days cooldown
            if (user.lastUsernameChange) {
                const daysSinceLastChange = Math.floor(
                    (Date.now() - new Date(user.lastUsernameChange).getTime()) / (1000 * 60 * 60 * 24)
                );
                if (daysSinceLastChange < 15) {
                    const daysRemaining = 15 - daysSinceLastChange;
                    throw new Error(`You can change your username in ${daysRemaining} days`);
                }
            }

            // Check if username is unique
            const existingUser = await prisma.user.findUnique({
                where: { username: data.username },
            });
            if (existingUser && existingUser.id !== user.id) {
                throw new Error('Username already taken');
            }

            // Add lastUsernameChange to the update data
            (data as any).lastUsernameChange = new Date();
        }

        // Now update the user
        return await prisma.user.update({
            where: { clerkUserId },
            data,
        });
    }

    /**
     * Sync user data from Clerk
     * Useful for webhooks or manual sync
     */
    static async syncUserFromClerk(clerkUserId: string) {
        try {
            const clerkUser = await clerkClient.users.getUser(clerkUserId);
            
            const primaryEmail = clerkUser.emailAddresses.find(
                (email) => email.id === clerkUser.primaryEmailAddressId
            );

            if (!primaryEmail) {
                throw new Error('No email found for user');
            }

            const user = await prisma.user.upsert({
                where: { clerkUserId },
                update: {
                    email: primaryEmail.emailAddress,
                    displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
                    avatar: clerkUser.imageUrl || undefined,
                    emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
                },
                create: {
                    clerkUserId,
                    email: primaryEmail.emailAddress,
                    username: clerkUser.username || primaryEmail.emailAddress.split('@')[0],
                    displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim(),
                    avatar: clerkUser.imageUrl || undefined,
                    emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
                    coins: 50,
                    level: 1,
                },
            });

            return user;
        } catch (error) {
            logger.error('Error syncing user from Clerk:', error);
            throw error;
        }
    }

    /**
     * Delete user (for Clerk webhooks)
     */
    static async deleteUser(clerkUserId: string) {
        return await prisma.user.delete({
            where: { clerkUserId },
        });
    }
}
