const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const r = await p.$queryRawUnsafe(`
    select c.language, c.id, count(u.id)::int players, sum(case when u.completed then 1 else 0 end)::int completed
      from public.daily_question_challenges c
      left join public.user_question_challenges u on u."challengeId"=c.id
     where c.type='FOOTBALL_GRID' and c."refreshDate"=current_date
     group by 1,2`);
  console.table(r);
  await p.$disconnect();
})();
