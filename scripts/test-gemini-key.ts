/**
 * Quick Gemini native API smoke test.
 * npx ts-node scripts/test-gemini-key.ts
 */
import 'dotenv/config';

const key = process.env.GEMINI_API_KEY ?? process.env.GOOGLE_API_KEY ?? process.argv[2];
const model = process.env.GEMINI_CHAT_MODEL ?? 'gemini-3-flash-preview';

async function main() {
    if (!key) {
        console.error('Set GEMINI_API_KEY or pass key as argv[2]');
        process.exit(1);
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const res = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': key,
        },
        body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: 'قل مرحبا بجملة واحدة بالعامية المصرية' }] }],
            generationConfig: { maxOutputTokens: 128, temperature: 0.4 },
        }),
    });

    const text = await res.text();
    console.log('HTTP', res.status);
    console.log(text.slice(0, 800));
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
