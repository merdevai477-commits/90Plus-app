/**
 * Fix reels stuck in PROCESSING or incorrectly FAILED when Mux asset is ready.
 *
 * Usage:
 *   npm run fix:stuck-reels
 *   npm run fix:stuck-reels -- --dry-run
 */
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

function maskDatabaseUrl(url: string | undefined): string {
  if (!url) return '(not set)';
  try {
    const u = new URL(url);
    return `${u.protocol}//${u.username ? '***@' : ''}${u.host}${u.pathname}`;
  } catch {
    return '(invalid DATABASE_URL)';
  }
}

async function assertDatabaseReachable(): Promise<void> {
  if (!process.env.DATABASE_URL) {
    console.error('\n❌ DATABASE_URL is not set in .env\n');
    process.exit(1);
  }

  console.log(`Database host: ${maskDatabaseUrl(process.env.DATABASE_URL)}\n`);

  const { default: prisma } = await import('../src/lib/prisma');
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err: any) {
    const msg = err?.message ?? String(err);
    console.error('\n❌ Cannot reach the database from this machine.\n');
    console.error(msg);
    console.error(`
This script needs a working DATABASE_URL (same as production).

Common fixes:
  1. Railway → your Postgres service → ensure it is running (not paused).
  2. Copy a fresh "Public network" connection URL into .env as DATABASE_URL.
  3. Add sslmode if missing: ...?sslmode=require
  4. If the port changed after redeploy, update .env (host was trolley.proxy.rlwy.net:51741).
  5. Or run heal on deploy: startup in main.ts already heals FAILED reels < 7 days.

`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  await assertDatabaseReachable();

  const { healStuckReels } = await import('../src/services/reel-mux-heal.service');

  console.log(`Reel Mux heal — dryRun=${dryRun}\n`);

  const summary = await healStuckReels({
    dryRun,
    statuses: ['PROCESSING', 'FAILED'],
    notify: !dryRun,
    invalidateCaches: !dryRun,
  });

  console.log('\nSummary:', summary);
  console.log(dryRun ? '\n(dry-run — no DB writes)\n' : '\nDone.\n');
}

main()
  .catch((err) => {
    console.error(err?.message ?? err);
    process.exit(1);
  })
  .finally(async () => {
    try {
      const { default: prisma } = await import('../src/lib/prisma');
      await prisma.$disconnect();
    } catch {
      /* ignore */
    }
  });
