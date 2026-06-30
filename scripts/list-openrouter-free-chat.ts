/**
 * List free OpenRouter models suitable for chat (Arabic + English).
 * npx ts-node scripts/list-openrouter-free-chat.ts
 */
import 'dotenv/config';

type Model = {
  id: string;
  name?: string;
  description?: string;
  context_length?: number;
  pricing?: { prompt?: string; completion?: string };
  architecture?: { modality?: string; instruct_type?: string | null };
  top_provider?: { max_completion_tokens?: number };
};

async function main() {
  const key = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!key) throw new Error('OPENROUTER_API_KEY missing');

  const res = await fetch('https://openrouter.ai/api/v1/models', {
    headers: { Authorization: `Bearer ${key}` },
  });
  const json = (await res.json()) as { data?: Model[] };
  const all = json.data ?? [];

  const free = all.filter((m) => {
    const p = parseFloat(m.pricing?.prompt ?? '1');
    const c = parseFloat(m.pricing?.completion ?? '1');
    return p === 0 && c === 0;
  });

  const chatLike = free.filter((m) => {
    const id = m.id.toLowerCase();
    const mod = m.architecture?.modality ?? '';
    if (mod && !mod.includes('text')) return false;
    if (/embed|whisper|tts|vision-only|image|audio|video|ocr|rerank|moderation/.test(id)) return false;
    return true;
  });

  chatLike.sort((a, b) => (b.context_length ?? 0) - (a.context_length ?? 0));

  console.log(`Total models: ${all.length}`);
  console.log(`Free (0/0 pricing): ${free.length}`);
  console.log(`Free chat-like: ${chatLike.length}\n`);

  for (const m of chatLike) {
    const ctx = m.context_length ? `${Math.round(m.context_length / 1024)}k ctx` : '? ctx';
    console.log(`${m.id}`);
    console.log(`  name: ${m.name ?? '-'}`);
    console.log(`  ${ctx}`);
    if (m.description) console.log(`  desc: ${m.description.slice(0, 120).replace(/\s+/g, ' ')}...`);
    console.log('');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
