/**
 * Local mirror of POST /api/admin/push-debug (dry-run + send) against DATABASE_URL.
 * Usage:
 *   npx tsx scripts/push-debug-local.ts --clerk-user-id user_xxx --send false
 *   npx tsx scripts/push-debug-local.ts --clerk-user-id user_xxx --send true --title "90Plus Debug" --body "Android Push Test"
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Expo, ExpoPushMessage } from 'expo-server-sdk';

const prisma = new PrismaClient();
const expo = new Expo();

function arg(name: string): string | undefined {
    const i = process.argv.indexOf(name);
    return i >= 0 ? process.argv[i + 1] : undefined;
}

async function main() {
    const clerkUserId = arg('--clerk-user-id');
    const username = arg('--username');
    const send = (arg('--send') ?? 'false') === 'true';
    const title = arg('--title') ?? '90Plus Debug';
    const body = arg('--body') ?? 'Testing push notification';

    if (!clerkUserId && !username) {
        console.error('Need --clerk-user-id or --username');
        process.exit(1);
    }

    const user = await prisma.user.findFirst({
        where: clerkUserId ? { clerkUserId } : { username },
        select: {
            id: true,
            username: true,
            clerkUserId: true,
            expoPushToken: true,
            pushNotificationsConsent: true,
            updatedAt: true,
        },
    });

    if (!user) {
        console.log(JSON.stringify({
            success: false,
            userFound: false,
            user: clerkUserId ?? username,
            hasToken: false,
            consent: null,
            token: null,
            message: 'User not found',
        }, null, 2));
        return;
    }

    const token = user.expoPushToken?.trim() || null;
    const hasToken = !!(token && token.length > 0);

    const baseReport = {
        success: false,
        userFound: true,
        user: user.clerkUserId,
        username: user.username,
        hasToken,
        consent: user.pushNotificationsConsent,
        token,
        tokenPrefix: token ? `${token.substring(0, 35)}...` : null,
        updatedAt: user.updatedAt.toISOString(),
        pushAttempted: false,
        ticketStatus: null as string | null,
        ticketId: null as string | null,
        ticketError: null as string | null,
        tickets: null as unknown[] | null,
    };

    if (!hasToken || !token) {
        console.log(JSON.stringify({
            ...baseReport,
            message: 'No expoPushToken — open app on device, grant notifications, stay signed in',
        }, null, 2));
        return;
    }

    if (!send) {
        console.log(JSON.stringify({
            ...baseReport,
            success: true,
            message: 'User has token; send=false (dry run)',
        }, null, 2));
        return;
    }

    const message: ExpoPushMessage = {
        to: token,
        sound: 'default',
        title,
        body,
        data: { type: 'DEBUG_TEST', source: 'push-debug-local.ts' },
        priority: 'high',
        channelId: 'general',
    };

    const chunks = expo.chunkPushNotifications([message]);
    const allTickets: unknown[] = [];
    let ticketStatus: string | null = null;
    let ticketId: string | null = null;
    let ticketError: string | null = null;

    for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        allTickets.push(...ticketChunk);
        for (const t of ticketChunk) {
            const st = (t as { status?: string }).status;
            if (st === 'ok') {
                ticketStatus = 'ok';
                ticketId = (t as { id?: string }).id ?? null;
            } else if (st === 'error') {
                ticketStatus = 'error';
                ticketError = (t as { message?: string }).message ?? 'Expo ticket error';
                const errCode = (t as { details?: { error?: string } }).details?.error;
                if (errCode) ticketError = `${ticketError} (${errCode})`;
            }
        }
    }

    console.log(JSON.stringify({
        ...baseReport,
        success: ticketStatus === 'ok',
        pushAttempted: true,
        ticketStatus,
        ticketId,
        ticketError,
        tickets: allTickets,
        outboundMessage: message,
        message: ticketStatus === 'ok' ? 'Push ticket ok — check device' : ticketError ?? 'Push failed',
    }, null, 2));
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
