/**
 * Test Gemini chat streaming client.
 * npx ts-node scripts/test-gemini-chat-stream.ts
 */
import 'dotenv/config';
import { buildGeminiChatClient, resolveGeminiChatModel } from '../src/services/gemini-chat.client';

async function main() {
    process.env.AI_PROVIDER = process.env.AI_PROVIDER ?? 'gemini';
    const client = buildGeminiChatClient();
    if (!client) {
        console.error('Gemini client not configured — set AI_PROVIDER=gemini and GEMINI_API_KEY');
        process.exit(1);
    }

    const model = resolveGeminiChatModel();
    console.log('Model:', model);

    const stream = await client.chat.completions.create({
        model,
        stream: true,
        temperature: 0.4,
        max_tokens: 128,
        messages: [
            { role: 'system', content: 'Reply in Egyptian Arabic dialect, one short sentence.' },
            { role: 'user', content: 'ازيك يا كابتن؟' },
        ],
    });

    let out = '';
    for await (const chunk of stream) {
        const token = chunk.choices[0]?.delta?.content ?? '';
        if (token) {
            out += token;
            process.stdout.write(token);
        }
    }
    console.log('\n\nTotal chars:', out.length);
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
