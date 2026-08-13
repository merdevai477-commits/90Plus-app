const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const cols = await p.$queryRawUnsafe(`select column_name from information_schema.columns where table_name='users' order by ordinal_position limit 20`);
  console.log(cols.map(c=>c.column_name).join(', '));
  const u = await p.user.findMany({ take: 5, orderBy: { createdAt: 'desc' } });
  console.table(u.map(x => ({ id: x.id, clerk: x.clerkUserId ?? x.clerk_id ?? '?', email: x.email })));
  await p.$disconnect();
})();
