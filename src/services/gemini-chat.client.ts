/**
 * Google Gemini chat client — native Generative Language API streaming wrapper.
 * Uses x-goog-api-key (supports new AQ.* auth keys; not OpenAI-compatible routes).
 * Enabled when AI_PROVIDER=gemini.
 */

import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const DEFAULT_GEMINI_CHAT_MODEL = 'gemini-3-flash-preview';

type StreamChunk = {
    choices: Array<{ delta?: { content?: string } }>;
};

export type GeminiChatStreamClient = {
    chat: {
        completions: {
            create: (params: {
                model: string;
                messages: ChatCompletionMessageParam[];
                max_tokens?: number;
                temperature?: number;
                stream: true;
            }) => Promise<AsyncIterable<StreamChunk>>;
        };
    };
};

function messageText(content: ChatCompletionMessageParam['content']): string {
    if (typeof content === 'string') return content;
    if (!Array.isArray(content)) return '';
    return content
        .map((part) => {
            if (typeof part === 'string') return part;
            if (part.type === 'text') return part.text ?? '';
            return '';
        })
        .join('');
}

function toGeminiPayload(messages: ChatCompletionMessageParam[]): {
    systemInstruction?: { parts: Array<{ text: string }> };
    contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }>;
} {
    const systemParts: string[] = [];
    const contents: Array<{ role: 'user' | 'model'; parts: Array<{ text: string }> }> = [];

    for (const msg of messages) {
        const text = messageText(msg.content).trim();
        if (!text) continue;

        if (msg.role === 'system') {
            systemParts.push(text);
            continue;
        }

        if (msg.role === 'user') {
            contents.push({ role: 'user', parts: [{ text }] });
            continue;
        }

        if (msg.role === 'assistant') {
            contents.push({ role: 'model', parts: [{ text }] });
        }
    }

    if (contents.length === 0) {
        contents.push({ role: 'user', parts: [{ text: 'Hello' }] });
    }

    return {
        ...(systemParts.length
            ? { systemInstruction: { parts: [{ text: systemParts.join('\n\n') }] } }
            : {}),
        contents,
    };
}

function resolveGeminiApiKey(): string | null {
    return (
        process.env.GEMINI_API_KEY?.trim() ||
        process.env.GOOGLE_API_KEY?.trim() ||
        null
    );
}

function resolveGeminiBaseUrl(): string {
    return (
        process.env.GEMINI_BASE_URL?.trim() ||
        'https://generativelanguage.googleapis.com/v1beta'
    ).replace(/\/$/, '');
}

export function resolveGeminiChatModel(): string {
    return (
        process.env.GEMINI_CHAT_MODEL?.trim() ||
        process.env.AI_MODEL?.trim() ||
        DEFAULT_GEMINI_CHAT_MODEL
    );
}

export function resolveGeminiChatFallbackModel(): string {
    return (
        process.env.GEMINI_CHAT_FALLBACK_MODEL?.trim() ||
        'gemini-3.5-flash'
    );
}

export function isGeminiChatConfigured(): boolean {
    const provider = (process.env.AI_PROVIDER ?? '').trim().toLowerCase();
    return (provider === 'gemini' || provider === 'google') && !!resolveGeminiApiKey();
}

function extractTextFromGeminiChunk(payload: unknown): string {
    if (!payload || typeof payload !== 'object') return '';
    const candidates = (payload as { candidates?: unknown[] }).candidates;
    if (!Array.isArray(candidates) || !candidates.length) return '';

    const parts = (candidates[0] as { content?: { parts?: unknown[] } })?.content?.parts;
    if (!Array.isArray(parts)) return '';

    let out = '';
    for (const part of parts) {
        if (!part || typeof part !== 'object') continue;
        const text = (part as { text?: string }).text;
        if (typeof text === 'string' && text.length > 0) {
            out += text;
        }
    }
    return out;
}

async function* parseGeminiSseStream(body: ReadableStream<Uint8Array>): AsyncGenerator<string> {
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() ?? '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed.startsWith('data:')) continue;
                const data = trimmed.slice(5).trim();
                if (!data || data === '[DONE]') continue;

                try {
                    const parsed = JSON.parse(data) as unknown;
                    const text = extractTextFromGeminiChunk(parsed);
                    if (text) yield text;
                } catch {
                    /* ignore malformed SSE chunks */
                }
            }
        }
    } finally {
        reader.releaseLock();
    }
}

export function buildGeminiChatClient(): GeminiChatStreamClient | null {
    const apiKey = resolveGeminiApiKey();
    if (!apiKey || !isGeminiChatConfigured()) return null;

    const baseUrl = resolveGeminiBaseUrl();
    const defaultModel = resolveGeminiChatModel();

    return {
        chat: {
            completions: {
                create: async (params) => {
                    const model = params.model || defaultModel;
                    const url = `${baseUrl}/models/${encodeURIComponent(model)}:streamGenerateContent?alt=sse`;
                    const { systemInstruction, contents } = toGeminiPayload(params.messages);

                    const res = await fetch(url, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-goog-api-key': apiKey,
                        },
                        body: JSON.stringify({
                            ...(systemInstruction ? { systemInstruction } : {}),
                            contents,
                            generationConfig: {
                                maxOutputTokens: params.max_tokens,
                                temperature: params.temperature,
                            },
                        }),
                        signal: AbortSignal.timeout(120_000),
                    });

                    if (!res.ok) {
                        const errText = await res.text().catch(() => '');
                        throw new Error(
                            `Gemini stream HTTP ${res.status}: ${errText.slice(0, 300)}`,
                        );
                    }

                    if (!res.body) {
                        throw new Error('Gemini stream returned empty body');
                    }

                    return {
                        async *[Symbol.asyncIterator]() {
                            for await (const token of parseGeminiSseStream(res.body!)) {
                                yield { choices: [{ delta: { content: token } }] };
                            }
                        },
                    };
                },
            },
        },
    };
}
