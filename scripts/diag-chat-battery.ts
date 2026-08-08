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

// Reproduce EXACTLY what the mobile app sends. The app attaches a profile
// personalization suffix (from buildProfileSystemPromptSuffix) and prior
// conversation history on every message. The old battery sent neither, so it
// always hit the grounded tool agent and passed — while real users with a
// completed profile were silently routed to the legacy (stale) path.
const SAMPLE_SUFFIX = [
  '',
  'You are talking to a football player named Ahmed.',
  'Profile: Position=Winger, Age=22, Height=178, Weight=72kg, Preferred Foot=Right, Country=🇪🇬.',
  'Personalize your responses based on this profile.',
].join('\n');

const SAMPLE_HISTORY = [
  { role: 'user', content: 'ازيك' },
  { role: 'assistant', content: 'أهلًا بيك! جاهز أساعدك في كرة القدم والتمارين والتغذية. 🎯' },
];

// With the fix, a suffixed+historied request MUST still run the grounded path
// (tool agent, or the deterministic tools fallback on credit exhaustion).
// Anything else (gemini/openrouter/legacy) means the suffix bug is back.
const GROUNDED_PROVIDERS = new Set(['agent', 'tools']);

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

  let legacyPathHits = 0;

  for (const q of QUERIES) {
    const t0 = Date.now();
    const res = await fetch(`${BASE}/chat/stream`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        message: q,
        conversationId: null,
        systemPromptSuffix: SAMPLE_SUFFIX,
        history: SAMPLE_HISTORY,
      }),
    });
    const raw = await res.text();
    const { reply, done, error } = parseSse(raw);
    const ms = Date.now() - t0;
    const provider = done?.usedProvider ?? '-';
    // A suffixed request that lands on gemini/openrouter/legacy means the
    // grounded agent was bypassed — the exact regression we are guarding.
    const grounded = GROUNDED_PROVIDERS.has(provider);
    if (!grounded) legacyPathHits += 1;
    const ok =
      res.status === 200 && !error && reply.trim().length > 0 && grounded;
    if (ok) pass += 1;
    else fail += 1;

    console.log('\n====', ok ? 'PASS' : 'FAIL', q);
    console.log('HTTP', res.status, 'ms', ms);
    if (error) console.log('ERROR', JSON.stringify(error));
    if (!grounded) {
      console.log(
        `PATH WARNING: provider="${provider}" is NOT grounded — suffix bug regression?`,
      );
    }
    console.log(
      'provider/model/tools:',
      provider,
      '/',
      done?.usedModel ?? '-',
      '/',
      JSON.stringify(done?.toolsUsed ?? []),
    );
    console.log('reply:', reply.slice(0, 450).replace(/\n/g, ' '));
  }

  console.log('\n======== SUMMARY ========');
  console.log(`pass=${pass} fail=${fail} total=${QUERIES.length}`);
  console.log(
    `grounded-path=${QUERIES.length - legacyPathHits}/${QUERIES.length}` +
      (legacyPathHits > 0
        ? ` — ${legacyPathHits} fell to legacy path (suffix bug!)`
        : ' — suffix no longer disables the agent ✓'),
  );
  if (fail > 0) process.exitCode = 1;
}

main().catch((e) => {
  console.error('BATTERY FAILED', e?.message ?? e);
  process.exit(1);
});
