/**
 * RECOMPUTE EVERY USER'S LEVEL FROM THEIR XP
 *
 * `users.level` is a cached derivation of `users.xp`: the XP service writes it
 * whenever XP moves. So when the level CURVE changes, every row that has not
 * had an XP event since keeps a level from the old curve — the profile, the
 * header and the leaderboard would then disagree with the same user's XP.
 *
 * This pass rewrites the cached column from `levelFromXp`, the one formula
 * every consumer reads (100 XP per level: level N needs N × 100). It touches
 * nothing else: no XP is awarded, no transaction is written, and a row whose
 * level is already right is left alone.
 *
 * Run it once after a level-curve change.
 *
 *   npx ts-node --transpile-only scripts/recompute-user-levels.ts
 *   npx ts-node --transpile-only scripts/recompute-user-levels.ts --dry-run
 */

import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { levelFromXp } from '../src/services/xp.service';

const DRY_RUN = process.argv.includes('--dry-run');
const PAGE_SIZE = 500;

async function main(): Promise<void> {
  let cursor: string | undefined;
  let scanned = 0;
  let corrected = 0;

  for (;;) {
    const users = await prisma.user.findMany({
      take: PAGE_SIZE,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: 'asc' },
      select: { id: true, xp: true, level: true },
    });
    if (users.length === 0) break;
    cursor = users[users.length - 1]!.id;

    for (const user of users) {
      scanned += 1;
      const level = levelFromXp(user.xp);
      if (level === user.level) continue;

      corrected += 1;
      if (!DRY_RUN) {
        await prisma.user.update({ where: { id: user.id }, data: { level } });
      }
    }
  }

  console.log(
    `${DRY_RUN ? '[dry run] ' : ''}scanned ${scanned} users, ${corrected} level(s) ${
      DRY_RUN ? 'would be' : ''
    } corrected`,
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await prisma.$disconnect();
  });
