/**
 * Strong Captain AI battery against production chat.
 *
 * Usage: npx tsx scripts/diag-chat-battery.ts
 */
/// <reference types="node" />
import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';

const BASE =
  process.env.DIAG_API_URL ||
  'https://90plus-app-production-1808.up.railway.app/api';

const QUERIES = [
  'حكيمي معاه كام شامبيونز ليج؟',
  'يامال معاه كاس عالم ولا لا؟',
  'بيانات اخر سيزون لمحمد صلاح',
  'الاهلي معاه كام افريقيا؟',
  'ميسي معاه كام كاس عالم؟',
  'مباريات اليوم في الدوري البوليفي؟',
  'اين يلعب ديبوريم حاليا؟',
  'في ماتش لايف دلوقتي؟ لو فيه قولّي النتيجة والدقيقة',
];

async function getToken(): Promise<string> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const users = await clerk.users.getUserList({ limit: 15 });
  for (const u of users.data) {
    const s = await clerk.sessions.getSessionList({ userId: u.id, status: 'active' });
    if (s.data.length) return (await clerk.sessions.getToken(s.data[0].id)).jwt;
  }
  throw new Error('No active Clerk session');
}

function parseSse(raw: string) {
  let reply = '';
  let done: any = null;
  let error: any = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const j = JSON.parse(payload);
      if (typeof j.token === 'string') reply += j.token;
      if (j.error) error = j;
      if (j.remaining !== undefined || j.usedModel || j.toolsUsed) done = j;
    } catch {
      /* ignore */
    }
  }
  return { reply, done, error };
}

async function main() {
  console.log('API', BASE);
  const health = await fetch(`${BASE}/health`);
  console.log('health', health.status, (await health.text()).slice(0, 120));

  const token = await getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-user-timezone': 'Africa/Cairo',
  };

  const lim = await fetch(`${BASE}/chat/limit`, { headers });
  console.log('limit', await lim.text());

  let pass = 0;
  let fail = 0;

  for (const q of QUERIES) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: q, conversationId: null }),
    });
    const raw = await res.text();
    const { reply, done, error } = parseSse(raw);
    const ms = Date.now() - t0;
    const ok = res.status === 200 && !error && reply.trim().length > 0;
    if (ok) pass += 1;
    else fail += 1;

    console.log('\n====', ok ? 'PASS' : 'FAIL', q);
    console.log('HTTP', res.status, 'ms', ms);
    if (error) console.log('ERROR', JSON.stringify(error));
    console.log(
      'provider/model/tools:',
      done?.usedProvider ?? '-',
      '/',
      done?.usedModel ?? '-',
      '/',
      JSON.stringify(done?.toolsUsed ?? []),
    );
    console.log('reply:', reply.slice(0, 450).replace(/\n/g, ' '));
  }

  console.log('\n======== SUMMARY ========');
  console.log(`pass=${pass} fail=${fail} total=${QUERIES.length}`);
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('BATTERY FAILED', e?.message ?? e);
  process.exit(1);
});
