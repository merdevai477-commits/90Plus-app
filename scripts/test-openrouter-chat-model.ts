/**
 * Smoke-test OpenRouter chat model (Arabic / English / dialect).
 * npx ts-node scripts/test-openrouter-chat-model.ts [model-id]
 */
import 'dotenv/config';
import OpenAI from 'openai';

const MODEL =
    process.argv[2]?.trim() ??
    process.env.OPENROUTER_CHAT_MODEL ??
    'qwen/qwen3-next-80b-a3b-instruct:free';

const PROMPTS = [
    { label: 'English', text: 'Who won the 2022 World Cup? Reply in one short sentence.' },
    { label: 'Arabic (MSA)', text: 'من فاز بكأس العالم 2022؟ جاوب في جملة واحدة.' },
    {
        label: 'Egyptian dialect',
        text: 'ازيك؟ قولّي مين أفضل لاعب مصري في التاريخ في جملة واحدة بالعامية المصرية.',
    },
];

async function main() {
    const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
    if (!apiKey) throw new Error('OPENROUTER_API_KEY missing');

    const client = new OpenAI({
        apiKey,
        baseURL: process.env.OPENROUTER_BASE_URL ?? 'https://openrouter.ai/api/v1',
        defaultHeaders: {
            'HTTP-Referer': 'https://90plus.pro',
            'X-Title': '90Plus AI Chat Test',
        },
    });

    console.log(`Model: ${MODEL}\n`);

    for (const { label, text } of PROMPTS) {
        const started = Date.now();
        const completion = await client.chat.completions.create({
            model: MODEL,
            messages: [{ role: 'user', content: text }],
            max_tokens: 120,
            temperature: 0.4,
        });
        const reply = completion.choices[0]?.message?.content?.trim() ?? '(empty)';
        const usage = completion.usage;
        console.log(`--- ${label} ---`);
        console.log(`Q: ${text}`);
        console.log(`A: ${reply}`);
        console.log(
            `tokens in=${usage?.prompt_tokens ?? '?'} out=${usage?.completion_tokens ?? '?'} ${Date.now() - started}ms\n`,
        );
    }
}

main().catch((err) => {
    console.error('Failed:', err?.message ?? err);
    process.exit(1);
});
