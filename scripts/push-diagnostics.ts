/**
 * Push token DB diagnostics (Phase 4).
 * Usage: npx tsx scripts/push-diagnostics.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    const totalUsers = await prisma.user.count({ where: { isDeleted: false } });
    const withToken = await prisma.user.count({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
    });
    const withConsent = await prisma.user.count({
        where: { isDeleted: false, pushNotificationsConsent: true },
    });
    const tokenAndConsent = await prisma.user.count({
        where: {
            isDeleted: false,
            pushNotificationsConsent: true,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
    });

    const sample = await prisma.user.findMany({
        where: {
            isDeleted: false,
            expoPushToken: { not: null },
            NOT: { expoPushToken: '' },
        },
        select: {
            username: true,
            expoPushToken: true,
            pushNotificationsConsent: true,
            clerkUserId: true,
        },
        orderBy: { updatedAt: 'desc' },
        take: 20,
    });

    console.log('');
    console.log('========== PUSH DB DIAGNOSTICS ==========');
    console.log(`Total users:                   ${totalUsers}`);
    console.log(`Users with expoPushToken:      ${withToken}`);
    console.log(`Users with consent=true:       ${withConsent}`);
    console.log(`Users with token + consent:    ${tokenAndConsent}`);
    console.log('');
    console.log('First 20 tokens:');
    if (sample.length === 0) {
        console.log('  (none)');
    } else {
        for (const u of sample) {
            console.log(
                `  - ${u.username} consent=${u.pushNotificationsConsent} token=${u.expoPushToken}`,
            );
        }
    }
    console.log('=========================================');
    console.log('');
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
