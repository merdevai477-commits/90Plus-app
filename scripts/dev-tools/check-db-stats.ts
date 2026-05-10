/**
 * Check Database Statistics
 * فحص إحصائيات قاعدة البيانات
 */

import prisma from './src/lib/prisma';

async function main() {
    console.log('\n📊 Database Statistics\n');
    console.log('='.repeat(50));

    try {
        // Count cached fixtures
        const fixturesCount = await (prisma as any).cachedFixture.count();
        console.log(`\n🏟️  Cached Fixtures (المباريات المحفوظة): ${fixturesCount}`);

        // Count cached leagues
        const leaguesCount = await (prisma as any).cachedLeague.count();
        console.log(`🏆 Cached Leagues (الدوريات المحفوظة): ${leaguesCount}`);

        // Count cached teams
        const teamsCount = await (prisma as any).cachedTeam.count();
        console.log(`⚽ Cached Teams (الفرق المحفوظة): ${teamsCount}`);

        // Count cached players
        const playersCount = await (prisma as any).cachedPlayer.count();
        console.log(`👤 Cached Players (اللاعبين المحفوظين): ${playersCount}`);

        // Count cached H2H
        const h2hCount = await (prisma as any).cachedH2H.count();
        console.log(`🤝 Cached H2H (المواجهات المباشرة): ${h2hCount}`);

        // Get fixtures by status
        console.log('\n📈 Fixtures by Status:');
        const fixturesByStatus = await (prisma as any).cachedFixture.groupBy({
            by: ['status'],
            _count: true,
            orderBy: { _count: { status: 'desc' } }
        });
        fixturesByStatus.forEach((s: any) => {
            console.log(`   ${s.status}: ${s._count} matches`);
        });

        // Get oldest and newest fixtures
        console.log('\n📅 Date Range:');
        const oldestFixture = await (prisma as any).cachedFixture.findFirst({
            orderBy: { matchDate: 'asc' },
            select: { matchDate: true, homeTeamName: true, awayTeamName: true }
        });
        const newestFixture = await (prisma as any).cachedFixture.findFirst({
            orderBy: { matchDate: 'desc' },
            select: { matchDate: true, homeTeamName: true, awayTeamName: true }
        });
        if (oldestFixture) {
            console.log(`   Oldest: ${new Date(oldestFixture.matchDate).toLocaleDateString('ar-EG')} - ${oldestFixture.homeTeamName} vs ${oldestFixture.awayTeamName}`);
        }
        if (newestFixture) {
            console.log(`   Newest: ${new Date(newestFixture.matchDate).toLocaleDateString('ar-EG')} - ${newestFixture.homeTeamName} vs ${newestFixture.awayTeamName}`);
        }

        // Get sample of finished matches
        console.log('\n🏁 Sample of Finished Matches (آخر 5 مباريات منتهية):');
        const finishedMatches = await (prisma as any).cachedFixture.findMany({
            where: { status: 'FT' },
            select: {
                homeTeamName: true,
                awayTeamName: true,
                homeScore: true,
                awayScore: true,
                matchDate: true,
                leagueName: true
            },
            orderBy: { matchDate: 'desc' },
            take: 5
        });
        finishedMatches.forEach((m: any) => {
            console.log(`   ${m.homeTeamName} ${m.homeScore}-${m.awayScore} ${m.awayTeamName} (${m.leagueName}) - ${new Date(m.matchDate).toLocaleDateString('ar-EG')}`);
        });

        // Check predictions
        console.log('\n🎯 Predictions Statistics:');
        const totalPredictions = await (prisma as any).prediction.count();
        const resolvedPredictions = await (prisma as any).prediction.count({ where: { isCorrect: { not: null } } });
        const unresolvedPredictions = await (prisma as any).prediction.count({ where: { isCorrect: null } });
        console.log(`   Total: ${totalPredictions}`);
        console.log(`   Resolved: ${resolvedPredictions}`);
        console.log(`   Unresolved: ${unresolvedPredictions}`);

        console.log('\n' + '='.repeat(50));
        console.log('✅ Database check complete!\n');

    } catch (error) {
        console.error('Error:', error);
    } finally {
        await prisma.$disconnect();
    }
}

main();
