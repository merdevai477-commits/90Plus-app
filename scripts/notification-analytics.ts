/**
 * Deep notification analytics from production DB.
 * Usage: DATABASE_URL=... npx tsx scripts/notification-analytics.ts
 */
import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const activeUsers = await prisma.user.count({ where: { isDeleted: false } });

    const consentTrue = await prisma.user.count({
        where: { isDeleted: false, pushNotificationsConsent: true },
    });
    const consentFalse = await prisma.user.count({
        where: { isDeleted: false, pushNotificationsConsent: false },
    });

    const withToken = await prisma.user.count({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
    });
    const tokenAndConsent = await prisma.user.count({
        where: {
            isDeleted: false,
            pushNotificationsConsent: true,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
    });
    const consentNoToken = await prisma.user.count({
        where: {
            isDeleted: false,
            pushNotificationsConsent: true,
            OR: [{ expoPushToken: null }, { expoPushToken: '' }],
        },
    });

    const totalNotifications = await prisma.notification.count();
    const usersWithAnyNotification = await prisma.notification.groupBy({
        by: ['userId'],
        _count: { id: true },
    });
    const usersWithUnread = await prisma.notification.groupBy({
        by: ['userId'],
        where: { isRead: false },
        _count: { id: true },
    });

    const byType = await prisma.notification.groupBy({
        by: ['type'],
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
    });

    const readStats = await prisma.notification.groupBy({
        by: ['isRead'],
        _count: { id: true },
    });

    const eventCount = await prisma.notificationEvent.count().catch(() => -1);

    const topRecipients = await prisma.$queryRaw<
        Array<{
            username: string;
            displayName: string | null;
            clerkUserId: string | null;
            pushConsent: boolean;
            hasToken: boolean;
            notifCount: bigint;
            unreadCount: bigint;
            lastNotifAt: Date | null;
        }>
    >`
        SELECT
            u.username,
            u."displayName",
            u."clerkUserId",
            u."pushNotificationsConsent" AS "pushConsent",
            (u."expoPushToken" IS NOT NULL AND u."expoPushToken" <> '') AS "hasToken",
            COUNT(n.id)::bigint AS "notifCount",
            COUNT(n.id) FILTER (WHERE n."isRead" = false)::bigint AS "unreadCount",
            MAX(n."createdAt") AS "lastNotifAt"
        FROM users u
        INNER JOIN notifications n ON n."userId" = u.id
        WHERE u."isDeleted" = false
        GROUP BY u.id, u.username, u."displayName", u."clerkUserId",
                 u."pushNotificationsConsent", u."expoPushToken"
        ORDER BY "notifCount" DESC
        LIMIT 25
    `;

    const perUserByType = await prisma.$queryRaw<
        Array<{ username: string; type: string; cnt: bigint }>
    >`
        SELECT u.username, n.type::text AS type, COUNT(*)::bigint AS cnt
        FROM notifications n
        JOIN users u ON u.id = n."userId"
        WHERE u."isDeleted" = false
        GROUP BY u.username, n.type
        ORDER BY u.username, cnt DESC
    `;

    const recent = await prisma.notification.findMany({
        take: 30,
        orderBy: { createdAt: 'desc' },
        select: {
            id: true,
            type: true,
            title: true,
            message: true,
            isRead: true,
            createdAt: true,
            user: {
                select: { username: true, displayName: true, expoPushToken: true, pushNotificationsConsent: true },
            },
        },
    });

    const usersNeverNotified = await prisma.user.count({
        where: {
            isDeleted: false,
            notifications: { none: {} },
        },
    });

    const tokenUsers = await prisma.user.findMany({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
        select: {
            username: true,
            displayName: true,
            pushNotificationsConsent: true,
            _count: { select: { notifications: true } },
        },
    });

    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║           90Plus — تقرير الإشعارات من قاعدة البيانات      ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');

    console.log('── المستخدمون ──');
    console.log(`  نشطون (غير محذوفين):              ${activeUsers}`);
    console.log(`  وافقوا pushNotificationsConsent:  ${consentTrue} (لا: ${consentFalse})`);
    console.log(`  عندهم expoPushToken:               ${withToken}`);
    console.log(`  consent + token (جاهزون لـ Push):  ${tokenAndConsent}`);
    console.log(`  consent لكن بدون token:            ${consentNoToken}`);
    console.log(`  لم يستلموا أي إشعار inbox أبداً:   ${usersNeverNotified}`);

    console.log('\n── سجل الإشعارات (inbox في التطبيق) ──');
    console.log('  ملاحظة: كل صف = إشعار سُجّل في DB (غالباً مع محاولة Push)');
    console.log('  لا يوجد جدول tickets من Expo — التسليم الفعلي للجهاز غير مؤكد 100%');
    console.log(`  إجمالي الإشعارات:                 ${totalNotifications}`);
    console.log(`  مستخدمون لديهم ≥1 إشعار:          ${usersWithAnyNotification.length}`);
    console.log(`  مستخدمون لديهم غير مقروء:         ${usersWithUnread.length}`);
    for (const r of readStats) {
        console.log(`  isRead=${r.isRead}: ${r._count.id}`);
    }

    if (eventCount >= 0) {
        console.log(`\n  notification_events (SENT/OPENED): ${eventCount} صف`);
        if (eventCount === 0) {
            console.log('  ⚠️  الجدول فارغ — لا تتبع فتح Push منفصل في DB');
        }
    }

    console.log('\n── حسب النوع (كل المستخدمين) ──');
    for (const row of byType) {
        console.log(`  ${row.type.padEnd(22)} ${row._count.id}`);
    }

    console.log('\n── أعلى 25 مستلم (inbox) ──');
    for (const r of topRecipients) {
        const token = r.hasToken ? 'token✓' : 'no-token';
        const consent = r.pushConsent ? 'consent✓' : 'consent✗';
        console.log(
            `  ${r.username.padEnd(18)} | ${String(r.notifCount)} إشعار (${String(r.unreadCount)} غير مقروء) | ${consent} ${token} | آخر: ${r.lastNotifAt?.toISOString().slice(0, 16) ?? '—'}`,
        );
    }

    console.log('\n── المستخدمون الـ5 بتوكن + عدد إشعاراتهم ──');
    for (const u of tokenUsers) {
        console.log(
            `  ${u.username.padEnd(18)} | ${u._count.notifications} إشعار | consent=${u.pushNotificationsConsent}`,
        );
    }

    console.log('\n── تفصيل: نوع الإشعار لكل مستخدم (لمن لديه inbox) ──');
    const byUser = new Map<string, Array<{ type: string; cnt: number }>>();
    for (const row of perUserByType) {
        const list = byUser.get(row.username) ?? [];
        list.push({ type: row.type, cnt: Number(row.cnt) });
        byUser.set(row.username, list);
    }
    for (const [username, types] of [...byUser.entries()].sort((a, b) => {
        const sumA = a[1].reduce((s, t) => s + t.cnt, 0);
        const sumB = b[1].reduce((s, t) => s + t.cnt, 0);
        return sumB - sumA;
    })) {
        const summary = types.map((t) => `${t.type}:${t.cnt}`).join(', ');
        console.log(`  ${username}: ${summary}`);
    }

    console.log('\n── آخر 30 إشعار (الأحدث) ──');
    for (const n of recent) {
        const who = n.user.username;
        const token = n.user.expoPushToken ? '🔑' : '—';
        console.log(
            `  ${n.createdAt.toISOString().slice(0, 19)} | ${who.padEnd(16)} | ${n.type.padEnd(18)} | read=${n.isRead} ${token} | ${n.title.slice(0, 40)}`,
        );
    }

    console.log('\n');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
