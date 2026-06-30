/**
 * Amazon Bedrock chat client — OpenAI-compatible streaming wrapper for ConverseStream.
 * Used when AI_PROVIDER=bedrock (Claude Haiku 4.5 on AWS credits).
 */

import {
    BedrockRuntimeClient,
    ConverseStreamCommand,
    type Message,
} from '@aws-sdk/client-bedrock-runtime';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

export const DEFAULT_BEDROCK_CHAT_MODEL =
    'anthropic.claude-haiku-4-5-20251001-v1:0';

type StreamChunk = {
    choices: Array<{ delta?: { content?: string } }>;
};

export type BedrockChatStreamClient = {
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

function toBedrockInput(messages: ChatCompletionMessageParam[]): {
    system: { text: string }[];
    messages: Message[];
} {
    const systemParts: string[] = [];
    const bedrockMessages: Message[] = [];

    for (const msg of messages) {
        const text = messageText(msg.content).trim();
        if (!text) continue;

        if (msg.role === 'system') {
            systemParts.push(text);
            continue;
        }

        if (msg.role === 'user' || msg.role === 'assistant') {
            bedrockMessages.push({
                role: msg.role,
                content: [{ text }],
            });
        }
    }

    return {
        system: systemParts.map((text) => ({ text })),
        messages: bedrockMessages,
    };
}

function resolveBedrockRegion(): string {
    return (
        process.env.AWS_BEDROCK_REGION ??
        process.env.AWS_REGION ??
        'us-east-1'
    );
}

function resolveBedrockModel(): string {
    return (
        process.env.AWS_BEDROCK_CHAT_MODEL ??
        process.env.BEDROCK_CHAT_MODEL ??
        DEFAULT_BEDROCK_CHAT_MODEL
    );
}

function hasExplicitBedrockCredentials(): boolean {
    return !!(process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY);
}

export function isBedrockChatConfigured(): boolean {
    return (process.env.AI_PROVIDER ?? '').trim().toLowerCase() === 'bedrock';
}

export function buildBedrockChatClient(): BedrockChatStreamClient | null {
    if (!isBedrockChatConfigured()) return null;

    const region = resolveBedrockRegion();
    const defaultModel = resolveBedrockModel();

    const credentials = hasExplicitBedrockCredentials()
        ? {
              accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
              secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
              ...(process.env.AWS_SESSION_TOKEN
                  ? { sessionToken: process.env.AWS_SESSION_TOKEN }
                  : {}),
          }
        : undefined;

    const runtime = new BedrockRuntimeClient({
        region,
        ...(credentials ? { credentials } : {}),
    });

    return {
        chat: {
            completions: {
                create: async (params) => {
                    const modelId = params.model || defaultModel;
                    const { system, messages } = toBedrockInput(params.messages);

                    const command = new ConverseStreamCommand({
                        modelId,
                        ...(system.length > 0 ? { system } : {}),
                        messages,
                        inferenceConfig: {
                            maxTokens: params.max_tokens,
                            temperature: params.temperature,
                        },
                    });

                    const response = await runtime.send(command);
                    const stream = response.stream;
                    if (!stream) {
                        throw new Error('Bedrock ConverseStream returned no stream');
                    }

                    return {
                        async *[Symbol.asyncIterator]() {
                            for await (const event of stream) {
                                const token = event.contentBlockDelta?.delta?.text;
                                if (token) {
                                    yield { choices: [{ delta: { content: token } }] };
                                }
                            }
                        },
                    };
                },
            },
        },
    };
}

export function resolveBedrockChatModel(): string {
    return resolveBedrockModel();
}
