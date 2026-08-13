import 'dotenv/config';
import { buildFootballGridBoard } from '../src/services/questions-challenges.grid-data';
import prisma from '../src/lib/prisma';

(async () => {
  const today = process.argv[2] ?? new Date().toISOString().slice(0, 10);
  for (const lang of ['en', 'ar'] as const) {
    const t = Date.now();
    const board = await buildFootballGridBoard(lang, today);
    if (!board) { console.log(`[${lang}] NO BOARD`); continue; }
    console.log(`\n[${lang}] built in ${Date.now() - t}ms  pool=${board.players.length}`);
    console.log(`[${lang}] rows=`, board.rows.map(r => `${r.label}(${r.refId},${r.kind})`).join(' | '));
    console.log(`[${lang}] cols=`, board.columns.map(c => `${c.label}(${c.refId})`).join(' | '));
    const ans = new Set<string>();
    for (const [k, v] of board.cells) {
      const a = board.answers.get(k)!;
      ans.add(a.id);
      console.log(`   ${k}: candidates=${v.length}  answer=${a.name}`);
    }
    console.log(`[${lang}] DISTINCT ANSWERS = ${ans.size}/9`);
  }
  await prisma.$disconnect();
  process.exit(0);
})().catch(e => { console.error(e); process.exit(1); });
