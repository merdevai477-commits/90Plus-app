/**
 * Clerk Webhook Routes
 * 
 * Handles webhook events from Clerk:
 * - user.created: Create user in database, generate username
 * - user.updated: Update user data in database
 * - user.deleted: Remove user from database
 */

import { Router, Request, Response } from 'express';
import { Webhook } from 'svix';
import { clerkClient } from '@clerk/express';
import { generateUsername } from '../utils/username.utils';
import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

const router = Router();

// Clerk Webhook Secret from environment
const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET || '';

interface ClerkWebhookEvent {
    type: string;
    data: {
        id: string;
        email_addresses?: Array<{
            id: string;
            email_address: string;
            verification?: { status: string };
        }>;
        primary_email_address_id?: string;
        first_name?: string;
        last_name?: string;
        image_url?: string;
        username?: string;
        created_at?: number;
        updated_at?: number;
        public_metadata?: Record<string, any>;
        private_metadata?: Record<string, any>;
        external_accounts?: Array<{
            provider: string;
        }>;
    };
}

/**
 * Verify webhook signature
 */
function verifyWebhook(req: Request): ClerkWebhookEvent | null {
    if (!WEBHOOK_SECRET) {
        logger.warn('⚠️ CLERK_WEBHOOK_SECRET not configured');
        return null;
    }

    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
        logger.error('❌ Missing svix headers');
        return null;
    }

    try {
        const wh = new Webhook(WEBHOOK_SECRET);
        const payload = JSON.stringify(req.body);
        const evt = wh.verify(payload, {
            'svix-id': svix_id,
            'svix-timestamp': svix_timestamp,
            'svix-signature': svix_signature,
        }) as ClerkWebhookEvent;

        return evt;
    } catch (err) {
        logger.error('❌ Webhook verification failed:', err);
        return null;
    }
}

/**
 * Get primary email from Clerk user data
 */
function getPrimaryEmail(data: ClerkWebhookEvent['data']): string | null {
    if (!data.email_addresses || !data.primary_email_address_id) {
        return null;
    }

    const primaryEmail = data.email_addresses.find(
        (email) => email.id === data.primary_email_address_id
    );

    return primaryEmail?.email_address || null;
}

/**
 * Check if user registered via OAuth
 */
function isOAuthUser(data: ClerkWebhookEvent['data']): boolean {
    return !!(data.external_accounts && data.external_accounts.length > 0);
}

/**
 * Handle user.created event
 */
async function handleUserCreated(data: ClerkWebhookEvent['data']): Promise<void> {
    logger.info('📧 Processing user.created webhook for:', data.id);

    const email = getPrimaryEmail(data);
    if (!email) {
        logger.error('❌ No email found for user:', data.id);
        throw new Error('No email found');
    }

    // Check if user already exists (idempotency)
    const existingUser = await prisma.user.findUnique({
        where: { clerkUserId: data.id },
    });

    if (existingUser) {
        logger.info('ℹ️ User already exists, skipping:', data.id);
        return;
    }

    // Generate unique username
    const username = await generateUsername({
        email,
        firstName: data.first_name,
        lastName: data.last_name,
        isOAuth: isOAuthUser(data),
    });

    // Create user in database
    const user = await prisma.user.create({
        data: {
            clerkUserId: data.id,
            email,
            username,
            displayName: `${data.first_name || ''} ${data.last_name || ''}`.trim() || username,
            avatar: data.image_url,
            emailVerified: data.email_addresses?.[0]?.verification?.status === 'verified',
            coins: 50, // Welcome bonus
            level: 1,
            xp: 0,
        },
    });

    logger.info('✅ User created in database:', user.id, 'username:', username);

    // Update Clerk user metadata with generated username
    try {
        await clerkClient.users.updateUser(data.id, {
            publicMetadata: {
                ...data.public_metadata,
                username,
                dbUserId: user.id,
            },
        });
        logger.info('✅ Clerk metadata updated with username:', username);
    } catch (err) {
        logger.error('⚠️ Failed to update Clerk metadata:', err);
        // Don't throw - user is already created in DB
    }
}

/**
 * Handle user.updated event
 */
async function handleUserUpdated(data: ClerkWebhookEvent['data']): Promise<void> {
    logger.info('📧 Processing user.updated webhook for:', data.id);

    const email = getPrimaryEmail(data);

    // Fetch existing user to ensure we don't overwrite custom app data
    const existingUser = await prisma.user.findUnique({
        where: { clerkUserId: data.id }
    });

    // Determine what to update without wiping custom avatars or display names
    const updateData: any = {
        email: email || undefined,
        emailVerified: data.email_addresses?.[0]?.verification?.status === 'verified',
    };

    if (existingUser) {
        // Only update displayName if the user hasn't customized it (i.e. it matches their old Clerk name or is missing)
        // Or if you prefer, just never overwrite it from Clerk after creation.
        // Let's protect it: if they already have a displayName, we leave it alone.
        if (!existingUser.displayName && data.first_name) {
            updateData.displayName = `${data.first_name || ''} ${data.last_name || ''}`.trim();
        }

        // Only update avatar if they don't have one, OR if they are still using the Clerk avatar.
        // If they uploaded a custom one to media.90plus.app, it won't contain 'clerk.com'.
        // This ensures reinstalling/logging-in doesn't wipe their custom uploaded picture.
        if (!existingUser.avatar || existingUser.avatar.includes('clerk.com')) {
            updateData.avatar = data.image_url;
        }
    } else {
        // Fallback if they don't exist yet (though they should)
        updateData.displayName = `${data.first_name || ''} ${data.last_name || ''}`.trim() || undefined;
        updateData.avatar = data.image_url;
    }

    // Update user in database
    const updatedUser = await prisma.user.update({
        where: { clerkUserId: data.id },
        data: updateData,
    });

    logger.info('✅ User updated in database:', updatedUser.id);
}

/**
 * Handle user.deleted event
 */
async function handleUserDeleted(data: ClerkWebhookEvent['data']): Promise<void> {
    logger.info('📧 Processing user.deleted webhook for:', data.id);

    // Delete user from database (cascade will handle related data)
    try {
        await prisma.user.delete({
            where: { clerkUserId: data.id },
        });
        logger.info('✅ User deleted from database:', data.id);
    } catch (err: any) {
        if (err.code === 'P2025') {
            logger.info('ℹ️ User already deleted or not found:', data.id);
        } else {
            throw err;
        }
    }
}

/**
 * POST /api/webhooks/clerk
 * Main webhook endpoint
 */
router.post('/', async (req: Request, res: Response): Promise<void> => {
    logger.info('🔔 Received Clerk webhook');

    // For development without signature verification
    let event: ClerkWebhookEvent | null;

    if (process.env.NODE_ENV === 'development' && !WEBHOOK_SECRET) {
        logger.warn('⚠️ Development mode: Skipping webhook verification');
        event = req.body as ClerkWebhookEvent;
    } else {
        event = verifyWebhook(req);

        if (!event) {
            res.status(401).json({
                status: 'ERROR',
                message: 'Invalid webhook signature',
            });
            return;
        }
    }

    const eventType = event.type;
    const eventData = event.data;

    logger.info(`📧 Webhook event: ${eventType}`);

    try {
        switch (eventType) {
            case 'user.created':
                await handleUserCreated(eventData);
                break;

            case 'user.updated':
                await handleUserUpdated(eventData);
                break;

            case 'user.deleted':
                await handleUserDeleted(eventData);
                break;

            default:
                logger.info(`ℹ️ Unhandled event type: ${eventType}`);
        }

        res.status(200).json({
            status: 'SUCCESS',
            message: `Webhook processed: ${eventType}`,
        });
    } catch (error: any) {
        logger.error(`❌ Webhook error for ${eventType}:`, error);

        res.status(500).json({
            status: 'ERROR',
            message: error.message || 'Webhook processing failed',
        });
    }
});

/**
 * GET /api/webhooks/clerk/health
 * Health check endpoint
 */
router.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'OK',
        message: 'Clerk webhook endpoint is ready',
        webhookSecretConfigured: !!WEBHOOK_SECRET,
    });
});

export default router;
