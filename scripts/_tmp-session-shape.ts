import 'dotenv/config';
import prisma from '../src/lib/prisma';
import { closeRedis } from '../src/lib/redis';
import { getQuestionsChallengeSession } from '../src/services/questions-challenges.service';

(async () => {
  const s: any = await getQuestionsChallengeSession(`grid_shape_${Date.now()}`, 'football-grid', 'en', 'UTC');
  console.log('TOP KEYS:', Object.keys(s).join(', '));
  console.log('content keys:', Object.keys(s.content ?? {}).join(', '));
  console.log('content.questions len:', (s.content?.questions ?? []).length);
  console.log('currentQuestion:', s.currentQuestion, 'total:', s.totalQuestions, 'status:', s.status);
  console.log('question:', JSON.stringify(s.question, null, 1)?.slice(0, 1400));
  const first = (s.content?.questions ?? [])[0];
  console.log('\ncontent.questions[0] keys:', Object.keys(first ?? {}).join(', '));
  await prisma.$disconnect(); await closeRedis().catch(()=>{}); process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
