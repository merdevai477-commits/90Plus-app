import * as dotenv from 'dotenv';
dotenv.config();

async function main() {
    const { PrismaClient } = await import('@prisma/client');
    const prisma = new PrismaClient();

    try {
        const reels = await prisma.reel.findMany({
            where: { isDeleted: false, status: 'READY' },
            select: { id: true, user: true, userId: true },
            orderBy: { createdAt: 'desc' },
            take: 20
        });

        console.log(`Checking ${reels.length} reels...`);
        let issuesFound = 0;
        
        for (const reel of reels) {
            if (!reel.user) {
                console.log(`🚨 Reel ${reel.id} has NO user (userId: ${reel.userId})`);
                issuesFound++;
            }
        }
        
        console.log(`Done. Found ${issuesFound} issues.`);
    } finally {
        await prisma.$disconnect();
    }
}

main().catch(console.error);
