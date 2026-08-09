/**
 * THE PROJECT'S QUIZ AI, called for the Questions hub.
 *
 * Same provider stack the daily quiz pack already runs on
 * (quiz-generator.service.ts): Google Gemini direct when a quiz key is
 * configured, OpenRouter otherwise. This is deliberately NOT the chat pipeline
 * — /api/chat/stream is a user-facing conversation surface and is not the
 * question source (OMAR_QUIZ_AI_FOOTBALL_API.md §0/§8).
 *
 * The client only speaks JSON: it returns the parsed object the model produced,
 * or null. Deciding whether that object is a usable round is the generator's
 * job (questions-challenges.ai-generator.service.ts).
 */

import OpenAI from 'openai';
import { logger } from '../utils/logger';
import { parseModelJson } from '../utils/ai-json';
import {
  generateGeminiText,
  isGeminiQuizConfigured,
  resolveGeminiQuizModel,
} from './gemini-text.client';
import { resolveQuizMaxTokens } from '../constants/quiz-generation.constants';

/** Parse retries within one provider before giving up on a call. */
const AI_PARSE_MAX_RETRIES = 2;

export interface QuestionsAiCallParams {
  system: string;
  user: string;
  temperature?: number;
  /** Label used in logs, e.g. the mode being generated. */
  label: string;
}

export interface QuestionsAiResult {
  payload: Record<string, unknown>;
  model: string;
}

function buildOpenRouterClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ?? process.env.AI_BASE_URL ?? 'https://openrouter.ai/api/v1';
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'HTTP-Referer': 'https://90plus.pro',
      'X-Title': '90Plus Questions',
    },
  });
}

/** True when some quiz AI provider is reachable at all. */
export function isQuestionsAiConfigured(): boolean {
  if (isGeminiQuizConfigured()) return true;
  return Boolean(process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY);
}

function asObject(parsed: unknown): Record<string, unknown> | null {
  if (Array.isArray(parsed)) return { questions: parsed };
  if (parsed && typeof parsed === 'object') return parsed as Record<string, unknown>;
  return null;
}

async function callGemini(params: QuestionsAiCallParams): Promise<QuestionsAiResult | null> {
  const temperature = params.temperature ?? 0.7;
  let lastModel = resolveGeminiQuizModel();

  for (let attempt = 1; attempt <= AI_PARSE_MAX_RETRIES; attempt += 1) {
    const { content, model } = await generateGeminiText({
      system: params.system,
      user: params.user,
      model: resolveGeminiQuizModel(),
      // Second attempt cools down: a model that just emitted unparsable JSON is
      // usually being too creative with the envelope.
      temperature: attempt === 1 ? temperature : Math.min(temperature, 0.4),
      maxOutputTokens: resolveQuizMaxTokens(),
      jsonMode: true,
    });
    lastModel = model;

    const payload = asObject(parseModelJson(content));
    if (payload) return { payload, model };

    logger.warn('[QuestionsAI] Gemini returned unparsable JSON', {
      label: params.label,
      attempt,
      model,
      length: content.length,
      preview: content.slice(0, 160).replace(/\s+/g, ' '),
    });
  }

  logger.warn('[QuestionsAI] Gemini exhausted parse retries', { label: params.label, model: lastModel });
  return null;
}

async function callOpenRouter(params: QuestionsAiCallParams): Promise<QuestionsAiResult | null> {
  const client = buildOpenRouterClient();
  if (!client) return null;

  const model = process.env.OPENROUTER_QUIZ_MODEL ?? 'google/gemini-2.5-flash';
  const temperature = params.temperature ?? 0.7;

  for (let attempt = 1; attempt <= AI_PARSE_MAX_RETRIES; attempt += 1) {
    const completion = await client.chat.completions.create({
      model,
      temperature: attempt === 1 ? temperature : Math.min(temperature, 0.4),
      messages: [
        { role: 'system', content: params.system },
        { role: 'user', content: params.user },
      ],
      max_tokens: resolveQuizMaxTokens(),
      response_format: { type: 'json_object' },
    });

    const content = completion.choices[0]?.message?.content ?? '';
    const payload = asObject(parseModelJson(content));
    if (payload) return { payload, model };

    logger.warn('[QuestionsAI] OpenRouter returned unparsable JSON', {
      label: params.label,
      attempt,
      model,
      finishReason: completion.choices[0]?.finish_reason,
      preview: content.slice(0, 160).replace(/\s+/g, ' '),
    });
  }

  return null;
}

/**
 * Ask the quiz AI for one JSON object. Returns null when the model could not be
 * reached or never produced parsable JSON — callers must treat that as a
 * generation failure, never as a reason to fall back to authored content.
 */
export async function callQuestionsAiJson(
  params: QuestionsAiCallParams,
): Promise<QuestionsAiResult | null> {
  try {
    if (isGeminiQuizConfigured()) {
      return await callGemini(params);
    }
    return await callOpenRouter(params);
  } catch (err) {
    logger.error('[QuestionsAI] call failed', {
      label: params.label,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}
