/**
 * Push token & delivery audit.
 * Usage:
 *   npx tsx --project tsconfig.scripts.json scripts/audit-push-tokens.ts
 *   npx tsx --project tsconfig.scripts.json scripts/audit-push-tokens.ts --send-test --clerk-user-id user_xxx
 *   npx tsx --project tsconfig.scripts.json scripts/audit-push-tokens.ts --send-all
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

async function auditUsers() {
    console.log('\n========== 1–3. USER TOKEN STATS ==========\n');

    const totalUsers = await prisma.user.count({ where: { isDeleted: false } });
    const withToken = await prisma.user.count({
        where: { isDeleted: false, expoPushToken: { not: null } },
    });
    const withTokenAndConsent = await prisma.user.count({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            pushNotificationsConsent: true,
        },
    });
    const consentNoToken = await prisma.user.count({
        where: {
            isDeleted: false,
            pushNotificationsConsent: true,
            OR: [{ expoPushToken: null }, { expoPushToken: '' }],
        },
    });
    const tokenNoConsent = await prisma.user.count({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            pushNotificationsConsent: false,
        },
    });

    console.log(`Total active users:              ${totalUsers}`);
    console.log(`expoPushToken NOT NULL:          ${withToken}`);
    console.log(`token + consent=true:            ${withTokenAndConsent}`);
    console.log(`consent=true but NO token:       ${consentNoToken}`);
    console.log(`token but consent=false:         ${tokenNoConsent}`);

    const formatRows = await prisma.$queryRaw<Array<{ fmt: string; cnt: bigint }>>`
        SELECT
            CASE
                WHEN "expoPushToken" IS NULL OR "expoPushToken" = '' THEN 'empty'
                WHEN "expoPushToken" LIKE 'ExponentPushToken[%' THEN 'ExponentPushToken[...]'
                WHEN "expoPushToken" LIKE 'ExpoPushToken[%' THEN 'ExpoPushToken[...]'
                ELSE 'other_format'
            END AS fmt,
            COUNT(*)::bigint AS cnt
        FROM users
        WHERE "isDeleted" = false
        GROUP BY 1
        ORDER BY cnt DESC
    `;
    console.log('\nToken format breakdown:');
    for (const r of formatRows) {
        console.log(`  ${r.fmt}: ${r.cnt}`);
    }

    console.log('\n========== 2. FIRST 20 USERS WITH TOKEN ==========\n');
    const sample = await prisma.user.findMany({
        where: { isDeleted: false, expoPushToken: { not: null } },
        select: {
            username: true,
            displayName: true,
            expoPushToken: true,
            pushNotificationsConsent: true,
            clerkUserId: true,
            updatedAt: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
    });

    if (sample.length === 0) {
        console.log('(no users with expoPushToken)');
    } else {
        for (const u of sample) {
            console.log(JSON.stringify({
                username: u.username,
                displayName: u.displayName,
                clerkUserId: u.clerkUserId,
                pushNotificationsConsent: u.pushNotificationsConsent,
                expoPushToken: u.expoPushToken,
                updatedAt: u.updatedAt.toISOString(),
            }, null, 2));
            console.log('---');
        }
    }
}

async function auditRecentNotifications() {
    console.log('\n========== 4. LAST 50 NOTIFICATIONS (DB proxy — no ticket log table) ==========\n');

    const recent = await prisma.notification.findMany({
        orderBy: { createdAt: 'desc' },
        take: 50,
        select: {
            id: true,
            type: true,
            title: true,
            userId: true,
            createdAt: true,
        },
    });

    console.log(`Fetched ${recent.length} notification rows (inbox records — push may still fail silently).`);
    console.log('Note: Backend does NOT persist Expo ticket/receipt results per send.');
    console.log('Success/failure counts below require a live test send or Railway log grep.\n');

    const byType: Record<string, number> = {};
    for (const n of recent) {
        byType[n.type] = (byType[n.type] || 0) + 1;
    }
    console.log('By type:', byType);
}

async function sendTestWithFullExpoResponse(clerkUserId?: string, username?: string) {
    console.log('\n========== 8. LIVE TEST PUSH (ticket + receipt) ==========\n');

    const user = await prisma.user.findFirst({
        where: clerkUserId ? { clerkUserId } : username ? { username } : undefined,
        select: {
            id: true,
            username: true,
            clerkUserId: true,
            expoPushToken: true,
            pushNotificationsConsent: true,
        },
    });

    if (!user) {
        console.error('User not found for test send');
        return;
    }

    console.log('Target user:', {
        username: user.username,
        clerkUserId: user.clerkUserId,
        pushNotificationsConsent: user.pushNotificationsConsent,
    });

    if (!user.expoPushToken) {
        console.error('❌ No expoPushToken — open app on physical device and grant notifications first.');
        return;
    }

    const token = user.expoPushToken;
    console.log('\nExpo Token used (full):', token);

    if (!Expo.isExpoPushToken(token)) {
        console.error('❌ Token fails Expo.isExpoPushToken validation');
        return;
    }

    const title = arg('--title') ?? '90Plus Test';
    const body = arg('--body') ?? 'If you see this, remote push works';

    const message: ExpoPushMessage = {
        to: token,
        sound: 'default',
        title,
        body,
        data: { type: 'TEST', source: 'audit-push-tokens.ts' },
        priority: 'high',
        channelId: 'general',
    };

    console.log('\n--- Outbound ExpoPushMessage ---');
    console.log(JSON.stringify(message, null, 2));

    const chunks = expo.chunkPushNotifications([message]);
    let allTickets: unknown[] = [];
    const receiptIds: string[] = [];

    for (const chunk of chunks) {
        const ticketChunk = await expo.sendPushNotificationsAsync(chunk);
        allTickets = allTickets.concat(ticketChunk);
        for (const t of ticketChunk) {
            if ((t as { status?: string }).status === 'ok' && (t as { id?: string }).id) {
                receiptIds.push((t as { id: string }).id);
            }
        }
    }

    console.log('\n--- Ticket Response (raw from Expo) ---');
    console.log(JSON.stringify(allTickets, null, 2));

    let receipts: Record<string, unknown> = {};
    if (receiptIds.length > 0) {
        console.log('\nWaiting 15s for Expo receipts...');
        await new Promise((r) => setTimeout(r, 15_000));
        const receiptChunks = expo.chunkPushNotificationReceiptIds(receiptIds);
        for (const rc of receiptChunks) {
            const part = await expo.getPushNotificationReceiptsAsync(rc);
            receipts = { ...receipts, ...part };
        }
    }

    console.log('\n--- Receipt Response (raw from Expo) ---');
    console.log(JSON.stringify(receipts, null, 2));

    const ticketOk = allTickets.filter((t) => (t as { status?: string }).status === 'ok').length;
    const ticketErr = allTickets.filter((t) => (t as { status?: string }).status === 'error').length;
    const receiptOk = Object.values(receipts).filter((r) => (r as { status?: string }).status === 'ok').length;
    const receiptErr = Object.values(receipts).filter((r) => (r as { status?: string }).status === 'error').length;

    console.log('\nSummary:');
    console.log(`  Tickets:  ok=${ticketOk}  error=${ticketErr}`);
    console.log(`  Receipts: ok=${receiptOk}  error=${receiptErr}`);

    if (receiptErr > 0) {
        console.log('\nReceipt error details:');
        for (const [id, r] of Object.entries(receipts)) {
            if ((r as { status?: string }).status === 'error') {
                console.log(`  ${id}:`, JSON.stringify(r));
            }
        }
    }
    if (ticketErr > 0) {
        console.log('\nTicket error details:');
        for (const t of allTickets) {
            if ((t as { status?: string }).status === 'error') {
                console.log(JSON.stringify(t));
            }
        }
    }
}

async function sendTestToAllUsersWithToken() {
    console.log('\n========== 9. BULK TEST PUSH (all users with expoPushToken) ==========\n');

    const users = await prisma.user.findMany({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
        select: {
            username: true,
            clerkUserId: true,
            expoPushToken: true,
            pushNotificationsConsent: true,
        },
        orderBy: { updatedAt: 'desc' },
    });

    const title = arg('--title') ?? '90Plus Test';
    const body = arg('--body') ?? 'If you see this, remote push works';

    console.log(`Found ${users.length} user(s) with a stored token.\n`);

    let sent = 0;
    let skipped = 0;
    let ticketOk = 0;
    let ticketErr = 0;

    for (const user of users) {
        const token = user.expoPushToken!;
        console.log(`--- ${user.username} (${user.clerkUserId}) ---`);

        if (!Expo.isExpoPushToken(token)) {
            console.log('  SKIP: invalid token format');
            skipped++;
            continue;
        }

        const message: ExpoPushMessage = {
            to: token,
            sound: 'default',
            title,
            body,
            data: { type: 'TEST', source: 'audit-push-tokens.ts', clerkUserId: user.clerkUserId },
            priority: 'high',
            channelId: 'general',
        };

        try {
            const chunks = expo.chunkPushNotifications([message]);
            for (const chunk of chunks) {
                const tickets = await expo.sendPushNotificationsAsync(chunk);
                console.log('  Tickets:', JSON.stringify(tickets));
                for (const t of tickets) {
                    if ((t as { status?: string }).status === 'ok') ticketOk++;
                    else ticketErr++;
                }
            }
            sent++;
        } catch (e) {
            console.log('  ERROR:', e instanceof Error ? e.message : String(e));
            ticketErr++;
        }
    }

    console.log('\nBulk summary:');
    console.log(`  Users with token: ${users.length}`);
    console.log(`  Attempted sends:  ${sent}`);
    console.log(`  Skipped:          ${skipped}`);
    console.log(`  Ticket ok:        ${ticketOk}`);
    console.log(`  Ticket error:     ${ticketErr}`);
    console.log('(Receipt check omitted in bulk — use --send-test for one user + receipts)\n');
}

async function main() {
    try {
        await auditUsers();
        await auditRecentNotifications();

        const sendTest = process.argv.includes('--send-test');
        const sendAll = process.argv.includes('--send-all');
        const clerkUserId = arg('--clerk-user-id') || process.env.TEST_CLERK_USER_ID;
        const username = arg('--username');

        if (sendAll) {
            await sendTestToAllUsersWithToken();
        } else if (sendTest) {
            await sendTestWithFullExpoResponse(clerkUserId, username);
        } else {
            console.log('\n(Run with --send-test --clerk-user-id <id> or --send-all)\n');
        }
    } finally {
        await prisma.$disconnect();
    }
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
