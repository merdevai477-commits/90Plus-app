import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { getQuestionsChallengeSession, submitQuestionsChallengeAnswer } from '../src/services/questions-challenges.service';
import { parseSessionProgress, deriveProgressFields, computeFinalResult } from '../src/services/questions-challenges.session.service';

(async () => {
  const uid = `grid_dbg2_${Date.now()}`;
  const s: any = await getQuestionsChallengeSession(uid, 'football-grid', 'en', 'UTC');
  const [row]: any = await prisma.$queryRawUnsafe(`select content from public.daily_question_challenges where type='FOOTBALL_GRID' and language='en' and "refreshDate"=current_date`);
  const keyed = row.content.questions;
  const correct = (id: string) => keyed.find((q: any) => q.id === id).answer.correctIds[0];

  // answer q1 correctly (the true current question)
  const q1 = s.question.id;
  const r: any = await submitQuestionsChallengeAnswer(uid, 'football-grid',
    { challengeId: s.challengeId, questionId: q1, selectedIds: [correct(q1)], elapsedTime: 2, language: 'en' }, 'UTC');
  console.log('SUBMIT', q1, { isCorrect: r.isCorrect, score: r.score });

  const u = await prisma.user.findFirst({ where: { clerkUserId: uid }, select: { id: true } });
  const [prog]: any = await prisma.$queryRawUnsafe(`select score, "answeredPayload" from public.user_question_challenges where "userId"=$1`, u!.id);
  console.log('DB score =', prog.score);
  console.log('PAYLOAD =', JSON.stringify(prog.answeredPayload).slice(0, 600));

  const parsed = parseSessionProgress(prog.answeredPayload);
  console.log('PARSED sessionStatus =', parsed.sessionStatus, 'currentIndex =', (parsed as any).currentIndex, 'keys =', Object.keys(parsed.byQuestionId));
  const evalPoints = (qid: string, rec: any) => {
    const q = keyed.find((x: any) => x.id === qid);
    const sel = new Set(rec.selectedIds.map((v: string) => v.toLowerCase()));
    const cor = new Set((q.answer.correctIds ?? []).map((v: string) => v.toLowerCase()));
    return sel.size === cor.size && [...cor].every(c => sel.has(c)) ? 1 : 0;
  };
  console.log('computeFinalResult =', JSON.stringify(computeFinalResult(parsed, keyed, evalPoints as any)));
  console.log('deriveProgressFields =', JSON.stringify(deriveProgressFields(parsed, keyed, evalPoints as any)));

  const after: any = await getQuestionsChallengeSession(uid, 'football-grid', 'en', 'UTC');
  console.log('SESSION score =', after.score, 'currentQuestion =', after.currentQuestion, 'pct =', after.completionPercentage);

  await prisma.user.deleteMany({ where: { clerkUserId: uid } });
  await prisma.$disconnect(); await closeRedis().catch(()=>{}); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
