import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { getQuestionsChallengeSession, submitQuestionsChallengeAnswer } from '../src/services/questions-challenges.service';

(async () => {
  const uid = `grid_dbg_${Date.now()}`;
  const s: any = await getQuestionsChallengeSession(uid, 'football-grid', 'en', 'UTC');
  const [row]: any = await prisma.$queryRawUnsafe(`select content from public.daily_question_challenges where type='FOOTBALL_GRID' and language='en' and "refreshDate"=current_date`);
  const keyed = row.content.questions;
  const correct = (id: string) => keyed.find((q: any) => q.id === id).answer.correctIds[0];

  const q2 = keyed[1].id;
  const r: any = await submitQuestionsChallengeAnswer(uid, 'football-grid',
    { challengeId: s.challengeId, questionId: q2, selectedIds: [correct(q2)], elapsedTime: 2, language: 'en' }, 'UTC');
  console.log('SUBMIT RESULT:', { isCorrect: r.isCorrect, score: r.score, pointsEarned: r.pointsEarned, completionPercentage: r.completionPercentage });

  const u = await prisma.user.findFirst({ where: { clerkUserId: uid }, select: { id: true } });
  const [prog]: any = await prisma.$queryRawUnsafe(`select score, "completionPercentage", "answeredPayload" from public.user_question_challenges where "userId"=$1`, u!.id);
  console.log('DB ROW score =', prog.score, 'pct =', prog.completionPercentage);
  console.log('byQuestionId =', JSON.stringify(prog.answeredPayload.byQuestionId, null, 1).slice(0, 900));

  const after: any = await getQuestionsChallengeSession(uid, 'football-grid', 'en', 'UTC');
  console.log('SESSION score =', after.score, 'currentQuestion =', after.currentQuestion, 'finalResult =', JSON.stringify(after.finalResult));
  console.log('content.questions[1].answer present? ', keyed[1].answer !== undefined);

  await prisma.user.deleteMany({ where: { clerkUserId: uid } });
  await prisma.$disconnect(); await closeRedis().catch(()=>{}); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
