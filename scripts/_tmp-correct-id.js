const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const p = new PrismaClient();
(async () => {
  const lang = process.argv[3] || 'en';
  const rows = await p.$queryRawUnsafe(
    `select content from public.daily_question_challenges
      where type='FOOTBALL_GRID' and language=$1 and "refreshDate"=current_date`, lang);
  const q = rows[0].content.questions.find((x) => x.id === process.argv[2]);
  console.log(q ? q.answer.correctIds[0] : '');
  await p.$disconnect();
})();
