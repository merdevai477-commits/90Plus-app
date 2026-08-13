const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const u = await p.user.findFirst({ where: { clerkUserId: process.argv[2] } });
  if (!u) { console.log('no backend user'); return; }
  const n = await p.userQuestionChallenge.deleteMany({ where: { userId: u.id } });
  await p.user.update({ where: { id: u.id }, data: { xp: 0, level: 1 } });
  console.log('cleared progress rows:', n.count);
  await p.$disconnect();
})();
