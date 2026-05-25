/**
 * Backfill cached_fixtures for calendar navigation (-60 to +14 days).
 *
 * Usage (set DATABASE_URL + FOOTBALL_API_KEY in .env or env):
 *   npm run backfill:fixtures
 *   npm run backfill:fixtures -- --days-past=30 --days-future=7
 *   npm run backfill:fixtures -- --dry-run
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function parseArgs(): { daysPast: number; daysFuture: number; dryRun: boolean } {
    const args = process.argv.slice(2);
    let daysPast = 60;
    let daysFuture = 14;
    let dryRun = false;

    for (const arg of args) {
        if (arg === '--dry-run') dryRun = true;
        else if (arg.startsWith('--days-past=')) {
            daysPast = Math.max(1, parseInt(arg.split('=')[1], 10) || 60);
        } else if (arg.startsWith('--days-future=')) {
            daysFuture = Math.max(0, parseInt(arg.split('=')[1], 10) || 14);
        }
    }

    return { daysPast, daysFuture, dryRun };
}

function formatDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}

function sleep(ms: number): Promise<void> {
    return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
    const { daysPast, daysFuture, dryRun } = parseArgs();

    if (!process.env.DATABASE_URL) {
        console.error('❌ DATABASE_URL is required');
        process.exit(1);
    }
    if (!process.env.FOOTBALL_API_KEY) {
        console.error('❌ FOOTBALL_API_KEY is required');
        process.exit(1);
    }

    const { footballService } = await import('../src/services/football.service');
    const { matchCacheService } = await import('../src/services/match-cache.service');

    if (!footballService.isConfigured()) {
        console.error('❌ Football API not configured');
        process.exit(1);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dates: string[] = [];
    for (let i = -daysPast; i <= daysFuture; i++) {
        const d = new Date(today);
        d.setDate(d.getDate() + i);
        dates.push(formatDate(d));
    }

    console.log(`\n📅 Backfill ${dates.length} days (${dates[0]} → ${dates[dates.length - 1]})${dryRun ? ' [DRY RUN]' : ''}\n`);

    let totalFixtures = 0;
    let totalUpserted = 0;
    let errors = 0;

    for (let i = 0; i < dates.length; i++) {
        const dateStr = dates[i];
        try {
            const fixtures = await footballService.getFixtures({ date: dateStr });
            totalFixtures += fixtures.length;
            console.log(`[${i + 1}/${dates.length}] ${dateStr}: ${fixtures.length} fixtures`);

            if (!dryRun && fixtures.length > 0) {
                const n = await matchCacheService.upsertFixtures(fixtures);
                totalUpserted += n;
            }

            // Respect API rate limits (~10 req/min on free tier)
            await sleep(6500);
        } catch (err) {
            errors++;
            console.error(`  ⚠️ ${dateStr} failed:`, err instanceof Error ? err.message : err);
            await sleep(10000);
        }
    }

    console.log('\n✅ Backfill complete');
    console.log(`   Fixtures fetched: ${totalFixtures}`);
    if (!dryRun) console.log(`   Upserted: ${totalUpserted}`);
    console.log(`   Errors: ${errors}\n`);

    process.exit(errors > 0 ? 1 : 0);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
