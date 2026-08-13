const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const rows = await p.$queryRawUnsafe(`
    select to_char("refreshDate",'YYYY-MM-DD') d, type, language, status, source,
           jsonb_array_length(coalesce(content->'questions','[]'::jsonb)) qn
      from public.daily_question_challenges
     where "refreshDate" >= current_date - 3
     order by d desc, type, language`);
  console.table(rows);
  const grid = await p.$queryRawUnsafe(`
    select to_char("refreshDate",'YYYY-MM-DD') d, language, status, source
      from public.daily_question_challenges where type='FOOTBALL_GRID' order by "refreshDate" desc limit 10`);
  console.log('GRID HISTORY', grid);
  await p.$disconnect();
})();
