import 'dotenv/config';
import OpenAI from 'openai';

const model = process.argv[2] ?? 'qwen/qwen3-next-80b-a3b-instruct:free';
const prompt =
    process.argv[3] ??
    'ازيك؟ مين أفضل لاعب مصري في التاريخ؟ جاوب جملة واحدة بالعامية المصرية.';

async function main() {
    const client = new OpenAI({
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseURL: 'https://openrouter.ai/api/v1',
        defaultHeaders: { 'HTTP-Referer': 'https://90plus.pro', 'X-Title': '90Plus' },
    });
    try {
        const c = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 100,
            temperature: 0.4,
        });
        console.log('model:', model);
        console.log('reply:', c.choices[0]?.message?.content);
        console.log('tokens:', c.usage);
    } catch (e: unknown) {
        const err = e as { status?: number; message?: string; error?: unknown };
        console.log('ERR status:', err.status);
        console.log('ERR message:', err.message);
        console.log('ERR body:', JSON.stringify(err.error ?? {}));
    }
}

main();
