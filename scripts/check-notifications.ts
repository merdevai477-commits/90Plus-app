/**
 * Notification platform smoke test.
 *
 * Verifies the unified notification pipeline end-to-end against the same
 * database the API server uses. Designed to be safe to run repeatedly.
 *
 * Run with: `npm run check:notifications`
 *
 * Required env:
 *   - DATABASE_URL  (same one the API uses)
 *   - TEST_CLERK_USER_ID — the Clerk user ID of a real user with an
 *     `expoPushToken` we can send a single GENERAL push to.
 *
 * Optional env:
 *   - SKIP_PUSH=1 — skip the Expo round-trip and only verify the DB row /
 *     preference toggles. Useful when running on CI without a real device.
 *
 * Exit codes:
 *   0 — everything passed
 *   1 — any check failed (output explains which)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const REQUIRED_ENUM_VALUES = [
    'LEVEL_UP',
    'LEADERBOARD_TOP3',
    'LEADERBOARD_TOP10',
    'REPORT_SUBMITTED',
    'REPORT_RESOLVED',
    'AVATAR_UPLOAD',
    'AI_CHECKIN',
    'COOLDOWN_EXPIRED',
    'DAILY_QUIZ_RENEWED',
    'LUCKY_WHEEL_RENEWED',
    'VIDEO_PROCESSED',
];

const REQUIRED_PREF_COLUMNS = [
    'matchCards',
    'matchSubs',
    'matchVar',
    'matchLineups',
    'socialShare',
    'dailyQuiz',
    'cooldown',
    'levelUp',
    'reportUpdates',
    'avatarUpload',
    'videoProcessed',
    'leaderboard',
    'aiCoach',
];

function ok(msg: string) { console.log('✅', msg); }
function fail(msg: string): never {
    console.error('❌', msg);
    process.exitCode = 1;
    throw new Error(msg);
}

async function checkSchema(prisma: PrismaClient): Promise<void> {
    console.log('\n[Schema] Verifying NotificationType enum + NotificationPreferences columns...');

    const enumRows: Array<{ enumlabel: string }> = await prisma.$queryRawUnsafe(`
        SELECT enumlabel FROM pg_enum
        WHERE enumtypid = (SELECT oid FROM pg_type WHERE typname = 'NotificationType')
    `);
    const labels = new Set(enumRows.map((r) => r.enumlabel));
    const missing = REQUIRED_ENUM_VALUES.filter((v) => !labels.has(v));
    if (missing.length > 0) {
        fail(`NotificationType enum missing values: ${missing.join(', ')}`);
    }
    ok(`NotificationType enum has all ${REQUIRED_ENUM_VALUES.length} required values`);

    const colRows: Array<{ column_name: string }> = await prisma.$queryRawUnsafe(`
        SELECT column_name FROM information_schema.columns
        WHERE table_name = 'notification_preferences'
    `);
    const cols = new Set(colRows.map((r) => r.column_name));
    const missingCols = REQUIRED_PREF_COLUMNS.filter((c) => !cols.has(c));
    if (missingCols.length > 0) {
        fail(`notification_preferences missing columns: ${missingCols.join(', ')}`);
    }
    ok(`notification_preferences has all ${REQUIRED_PREF_COLUMNS.length} required columns`);
}

async function checkUser(prisma: PrismaClient, clerkUserId: string) {
    console.log(`\n[User] Looking up TEST_CLERK_USER_ID = ${clerkUserId}`);
    const user = await prisma.user.findUnique({
        where: { clerkUserId },
        select: {
            id: true,
            displayName: true,
            username: true,
            expoPushToken: true,
            pushNotificationsConsent: true,
            settings: true,
        },
    });
    if (!user) fail(`No user found for clerkUserId=${clerkUserId}`);
    ok(`Found user ${user!.id} (${user!.displayName || user!.username})`);
    if (!user!.expoPushToken) {
        console.warn('   ⚠️  user has no expoPushToken — push will be skipped');
    }
    if (!user!.pushNotificationsConsent) {
        console.warn('   ⚠️  user has pushNotificationsConsent=false — push will be skipped');
    }
    return user!;
}

async function sendTestPush(userId: string): Promise<string | null> {
    if (process.env.SKIP_PUSH === '1') {
        console.log('\n[Push] SKIP_PUSH=1 → not enqueuing a push');
        return null;
    }
    console.log('\n[Push] Dispatching GENERAL test notification via notifyUser...');
    // Import lazily so we don't initialize Bull/Redis until we need to.
    const { notifyUser } = await import('../src/services/notify.service');
    const { NotificationType } = await import('../src/services/notification.service');
    const idempotencyKey = `check-notifications:${userId}:${Date.now()}`;
    const result = await notifyUser({
        userId,
        type: NotificationType.GENERAL,
        title: '✅ check-notifications.ts',
        message: 'Unified notification pipeline self-test',
        data: { screen: '/notifications', source: 'check-notifications' },
        idempotencyKey,
        bypassPreferences: true,
    });
    if (!result.delivered) {
        fail(`notifyUser refused to deliver: reason=${result.reason}`);
    }
    ok(`notifyUser returned delivered=true (idempotencyKey=${idempotencyKey})`);
    return idempotencyKey;
}

async function verifyRow(prisma: PrismaClient, userId: string): Promise<void> {
    // Bull workers are async — wait a bit for the row to land.
    const deadline = Date.now() + 10_000;
    while (Date.now() < deadline) {
        const recent = await prisma.notification.findFirst({
            where: {
                userId,
                type: 'GENERAL',
                createdAt: { gte: new Date(Date.now() - 60_000) },
            },
            select: { id: true, title: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        if (recent && /check-notifications/i.test(recent.title)) {
            ok(`DB row created: ${recent.id} (${recent.title}) at ${recent.createdAt.toISOString()}`);
            return;
        }
        await new Promise((r) => setTimeout(r, 500));
    }
    if (process.env.SKIP_PUSH === '1') return; // not enqueued, so no row expected
    fail('Did not see a GENERAL notification row land within 10s');
}

async function main(): Promise<void> {
    const clerkUserId = process.env.TEST_CLERK_USER_ID;
    if (!clerkUserId) {
        console.warn(
            '\n⚠️  TEST_CLERK_USER_ID not set — only running schema checks.\n' +
            '   Set it in .env to run the full push round-trip.',
        );
    }

    const prisma = new PrismaClient();
    try {
        await checkSchema(prisma);

        if (clerkUserId) {
            const user = await checkUser(prisma, clerkUserId);
            await sendTestPush(user.id);
            await verifyRow(prisma, user.id);
        }

        console.log('\n🎉 Notifications smoke test passed.');
    } finally {
        await prisma.$disconnect();
        // Bull queues hold open Redis connections; force exit so the script
        // returns instead of hanging on an open repeatable cron job.
        setTimeout(() => process.exit(process.exitCode ?? 0), 250).unref();
    }
}

main().catch((err) => {
    console.error('\n💥 Notifications smoke test failed:', err?.message ?? err);
    process.exit(1);
});
