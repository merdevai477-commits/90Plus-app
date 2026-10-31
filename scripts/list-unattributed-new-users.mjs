/**
 * Read-only: users created in the last 14 days with no share_win_referrals row.
 * Manual review only — never auto-credits.
 *
 * Usage: node --env-file=.env scripts/list-unattributed-new-users.mjs
 */

import { PrismaClient } from '@prisma/client';

const p = new PrismaClient();

try {
  const rows = await p.$queryRaw`
    SELECT u.id, u.username, u."createdAt"
    FROM users u
    WHERE u."createdAt" > NOW() - INTERVAL '14 days'
      AND u."isDeleted" = false
      AND NOT EXISTS (
        SELECT 1 FROM share_win_referrals r WHERE r."referredUserId" = u.id
      )
    ORDER BY u."createdAt" DESC
  `;
  console.log(JSON.stringify(rows, null, 2));
  console.log(`\nTotal: ${rows.length}`);
} finally {
  await p.$disconnect();
}
