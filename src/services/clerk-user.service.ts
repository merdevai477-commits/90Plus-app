import { randomBytes } from 'crypto';
import { clerkClient } from '@clerk/express';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';
import { awardDailyLogin } from './xp.service';
import { sanitizeTimezone } from '../utils/chat-timezone';

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
     * Create a DB user when Clerk is down or the account has no usable email yet.
     * Uses deterministic email/username from clerkUserId so retries stay idempotent.
     */
    private static async createMinimalClerkUser(clerkUserId: string) {
        const minimalEmail = `${clerkUserId}@clerk.temp`;
        const baseUser = `user_${clerkUserId.replace(/[^a-zA-Z0-9_]/g, '').slice(-12) || clerkUserId.slice(-8)}`;

        const tryCreate = async (username: string) => {
            return prisma.user.create({
                data: {
                    clerkUserId,
                    email: minimalEmail,
                    username,
                    displayName: username,
                    emailVerified: false,
                    coins: 50,
                    level: 1,
                    xp: 0,
                },
            });
        };

        try {
            const user = await tryCreate(baseUser);
            logger.info(`[createMinimalClerkUser] ✅ Minimal user created: ${user.username}`);
            return user;
        } catch (createError: any) {
            if (createError.code === 'P2002') {
                const byClerk = await prisma.user.findUnique({ where: { clerkUserId } });
                if (byClerk) return byClerk;
                const byEmail = await prisma.user.findUnique({ where: { email: minimalEmail } });
                if (byEmail) return byEmail;
                // Rare: username unique clash with another row — retry with random suffix
                const altUsername = `${baseUser}_${randomBytes(3).toString('hex')}`;
                try {
                    const user = await tryCreate(altUsername);
                    logger.info(`[createMinimalClerkUser] ✅ Minimal user created (alt username): ${user.username}`);
                    return user;
                } catch (e2: any) {
                    if (e2.code === 'P2002') {
                        const again = await prisma.user.findUnique({ where: { clerkUserId } });
                        if (again) return again;
                    }
                    throw e2;
                }
            }
            throw createError;
        }
    }

    /**
     * Find or create user from Clerk ID
     * This syncs Clerk user data with our database
     * ✅ OPTIMIZED: Added caching and timeout for Clerk API
     */
    static async findOrCreateUser(clerkUserId: string) {
        try {
            logger.info(`[findOrCreateUser] 🔍 Looking for user: ${clerkUserId}`);
            
            // Check if user exists by clerkUserId with timeout protection
            let user;
            try {
                user = await Promise.race([
                    prisma.user.findUnique({
                        where: { clerkUserId },
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Database query timeout')), 3000) // ✅ Reduced from 10000ms to 3000ms to fail fast
                    )
                ]) as any;
            } catch (dbError: any) {
                logger.error(`[findOrCreateUser] ❌ Database query failed:`, {
                    error: dbError.message,
                    code: dbError.code,
                    clerkUserId,
                });
                throw new Error(`Database connection failed: ${dbError.message}`);
            }

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
                    logger.warn(`[findOrCreateUser] ⚠️ Creating user with minimal data (Clerk unavailable)`);
                    return await this.createMinimalClerkUser(clerkUserId);
                }
            }

            // Primary email: prefer Clerk's primary id, else first verified, else any address
            const addresses = clerkUser.emailAddresses || [];
            let primaryEmail = addresses.find(
                (email: any) => email.id === clerkUser.primaryEmailAddressId
            );
            if (!primaryEmail) {
                primaryEmail = addresses.find(
                    (e: any) => e.verification?.status === 'verified'
                );
            }
            if (!primaryEmail && addresses.length > 0) {
                primaryEmail = addresses[0];
            }

            if (!primaryEmail) {
                logger.warn(
                    `[findOrCreateUser] ⚠️ No email addresses on Clerk user ${clerkUserId}; using minimal profile`
                );
                return await this.createMinimalClerkUser(clerkUserId);
            }

            logger.info(`[findOrCreateUser] 📧 Primary email: ${primaryEmail.emailAddress}`);

            const shortId = clerkUserId.replace('user_', '').slice(-8);
            const rawAddr = (primaryEmail.emailAddress || '').trim();
            const at = rawAddr.indexOf('@');
            const localPart =
                at > 0 ? rawAddr.slice(0, at) : rawAddr || 'user';
            const domain =
                at > 0 && at < rawAddr.length - 1
                    ? rawAddr.slice(at + 1)
                    : 'placeholder.invalid';
            const finalEmail = `${localPart}+${shortId}@${domain}`;

            logger.info(`[findOrCreateUser] 📧 Using email: ${finalEmail}`);

            let baseUsername =
                (clerkUser.username && String(clerkUser.username)) ||
                localPart.toLowerCase().replace(/[^a-z0-9_]/g, '');
            if (!baseUsername) baseUsername = 'user';
            const username = `${baseUsername}_${shortId}`;

            logger.info(`[findOrCreateUser] 👤 Using username: ${username}`);

            // Create new user with timeout
            try {
                user = await Promise.race([
                    prisma.user.create({
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
                    }),
                    new Promise((_, reject) =>
                        setTimeout(() => reject(new Error('Database create timeout')), 3000) // ✅ Reduced from 10000ms
                    )
                ]) as any;

                logger.info(`[findOrCreateUser] ✅ User created: ${user.username} (${user.id})`);
            } catch (createError: any) {
                // P2002 = race condition: another concurrent request already created this user.
                // This is expected behaviour — log as warn (NOT error) so it never fires in Sentry.
                // Fixes 90PLUS-BACKEND-Z and 90PLUS-BACKEND-W.
                if (createError.code === 'P2002') {
                    logger.warn(`[findOrCreateUser] Race condition on create — re-fetching existing user`, {
                        clerkUserId,
                    });
                    try {
                        user = await Promise.race([
                            prisma.user.findUnique({
                                where: { clerkUserId },
                            }),
                            new Promise((_, reject) =>
                                setTimeout(() => reject(new Error('Database query timeout')), 3000)
                            )
                        ]) as any;
                        if (user) return user;
                    } catch (findError: any) {
                        logger.error(`[findOrCreateUser] ❌ Failed to re-fetch after P2002:`, findError);
                        throw new Error(`Database connection failed: ${findError.message}`);
                    }
                }

                // Only log as error for genuinely unexpected failures
                logger.error(`[findOrCreateUser] ❌ Failed to create user:`, {
                    error: createError.message,
                    code: createError.code,
                    clerkUserId,
                });
                
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
                select: { settings: true },
            });
            const settings = (user?.settings ?? {}) as Record<string, unknown>;
            const tz = typeof settings.timezone === 'string'
                ? sanitizeTimezone(settings.timezone)
                : 'UTC';
            await awardDailyLogin(userId, tz);
            logger.info(`Updated login streak + XP for user ${userId}`);
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

        // Ensure user exists after findOrCreateUser
        if (!user) {
            throw new Error('Failed to find or create user');
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

            // Fetch existing first to check its current fields
            const existingUser = await prisma.user.findUnique({
                where: { clerkUserId }
            });

            const updateData: any = {
                email: primaryEmail.emailAddress,
                emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
            };

            if (existingUser) {
                // Protect custom displayName
                if (!existingUser.displayName && clerkUser.firstName) {
                    updateData.displayName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
                }
                // Protect custom avatar
                if (!existingUser.avatar || existingUser.avatar.includes('clerk.com')) {
                    updateData.avatar = clerkUser.imageUrl || undefined;
                }
            } else {
                updateData.displayName = `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim();
                updateData.avatar = clerkUser.imageUrl || undefined;
            }

            const user = await prisma.user.upsert({
                where: { clerkUserId },
                update: updateData,
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
