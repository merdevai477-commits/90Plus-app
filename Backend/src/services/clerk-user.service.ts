import { PrismaClient } from '@prisma/client';
import { clerkClient } from '@clerk/clerk-sdk-node';

const prisma = new PrismaClient();

export class ClerkUserService {
    /**
     * Find or create user from Clerk ID
     * This syncs Clerk user data with our database
     */
    static async findOrCreateUser(clerkUserId: string) {
        try {
            // Check if user exists in our database
            let user = await prisma.user.findUnique({
                where: { clerkUserId },
            });

            if (user) {
                return user;
            }

            // User doesn't exist, fetch from Clerk and create
            const clerkUser = await clerkClient.users.getUser(clerkUserId);

            // Get primary email
            const primaryEmail = clerkUser.emailAddresses.find(
                (email) => email.id === clerkUser.primaryEmailAddressId
            );

            if (!primaryEmail) {
                throw new Error('No email found for user');
            }

            // Generate username from email or Clerk username
            const baseUsername = clerkUser.username || 
                primaryEmail.emailAddress.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '');
            
            let username = baseUsername;
            let counter = 1;

            // Ensure unique username
            while (await prisma.user.findUnique({ where: { username } })) {
                username = `${baseUsername}${counter}`;
                counter++;
                if (counter > 9999) {
                    username = `${baseUsername}_${Date.now()}`;
                    break;
                }
            }

            // Create user in our database
            user = await prisma.user.create({
                data: {
                    clerkUserId,
                    email: primaryEmail.emailAddress,
                    username,
                    displayName: `${clerkUser.firstName || ''} ${clerkUser.lastName || ''}`.trim() || username,
                    avatar: clerkUser.imageUrl || undefined,
                    emailVerified: clerkUser.emailAddresses[0]?.verification?.status === 'verified',
                    coins: 50, // Welcome bonus
                    level: 1,
                    xp: 0,
                },
            });

            console.log('✅ New user created from Clerk:', user.id);
            return user;
        } catch (error) {
            console.error('Error in findOrCreateUser:', error);
            throw error;
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
            console.error('Error syncing user from Clerk:', error);
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
