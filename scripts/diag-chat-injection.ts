/**
 * Diagnostic: does /chat/stream inject football data / use the tool agent?
 * Prints, per query: HTTP, toolsUsed, dataSources, provider/model, reply preview.
 *
 * Usage: npx tsx scripts/diag-chat-injection.ts
 */
/// <reference types="node" />
import 'dotenv/config';
import { createClerkClient } from '@clerk/backend';

const BASE =
  process.env.DIAG_API_URL ||
  'https://90plus-app-production-1808.up.railway.app/api';

async function getToken(): Promise<string> {
  const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
  const users = await clerk.users.getUserList({ limit: 10 });
  for (const u of users.data) {
    const s = await clerk.sessions.getSessionList({ userId: u.id, status: 'active' });
    if (s.data.length) return (await clerk.sessions.getToken(s.data[0].id)).jwt;
  }
  throw new Error('No active Clerk session found');
}

function parseSse(raw: string): {
  reply: string;
  done: any | null;
  error: any | null;
} {
  let reply = '';
  let done: any | null = null;
  let error: any | null = null;
  for (const line of raw.split('\n')) {
    if (!line.startsWith('data:')) continue;
    const payload = line.slice(5).trim();
    if (!payload) continue;
    try {
      const j = JSON.parse(payload);
      if (typeof j.token === 'string') reply += j.token;
      if (j.error) error = j;
      if (j.remaining !== undefined || j.usedModel || j.dataSources || j.toolsUsed) {
        done = j;
      }
    } catch {
      /* ignore non-JSON keepalives */
    }
  }
  return { reply, done, error };
}

async function main() {
  const token = await getToken();
  const headers = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    'x-user-timezone': 'Africa/Cairo',
  };

  const queries = [
    'مبابي بيلعب فين دلوقتي؟',
    'كام سنة عمر لامين يامال؟',
    'محمد صلاح سجل كام هدف الموسم ده؟',
    'مباريات النهاردة ايه؟',
    'من هو ميسي؟',
    'رونالدو في أنهي نادي دلوقتي؟',
  ];

  for (const q of queries) {
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ message: q, conversationId: null }),
    });
    const raw = await res.text();
    const { reply, done, error } = parseSse(raw);
    console.log('\n==== Q:', q);
    console.log('HTTP', res.status);
    if (error) console.log('ERROR:', JSON.stringify(error));
    console.log(
      'toolsUsed:',
      done?.toolsUsed ? JSON.stringify(done.toolsUsed) : 'NONE',
    );
    console.log(
      'dataSources:',
      done?.dataSources ? JSON.stringify(done.dataSources) : 'NONE',
    );
    console.log(
      'provider/model:',
      done ? `${done.usedProvider ?? '-'} / ${done.usedModel ?? '-'}` : '-',
    );
    console.log('reply:', reply.slice(0, 300).replace(/\n/g, ' '));
  }
}

main().catch((e) => {
  console.error('DIAG FAILED:', e?.message ?? e);
  process.exit(1);
});
