/**
 * QUESTIONS → THE EXISTING FOOTBALL AI AGENT
 * =============================================================================
 *
 * The Questions hub's only route to the AI. It does NOT define a model, a
 * provider, a tool set, or a football data path of its own — all of that is the
 * existing agent implementation, consumed here:
 *
 *   chat-agent-tools.service.ts .... AGENT_TOOLS (the documented football tool
 *                                    schemas), executeAgentTool (their real
 *                                    executors), resolveAgentModel,
 *                                    isChatAgentConfigured
 *   chat-agent.service.ts .......... createAgentOpenAIClient (the OpenRouter
 *                                    client, with its credentials and headers)
 *   chat-grounding.service.ts ...... extractGroundedFacts /
 *                                    buildGroundingSystemMessage — the same
 *                                    "the tool number is the only truth" pin
 *                                    the chat agent puts on the model
 *
 * WHY THIS EXISTS AT ALL, next to runFootballAgent()
 * --------------------------------------------------
 * `runFootballAgent` is the CHAT surface: it streams prose, carries the chat
 * persona preamble, budgets ~900 tokens for one conversational reply, and can
 * short-circuit to a deterministic sentence. A Questions round is a single
 * structured JSON document of six questions. Reusing it would mean rewriting
 * it, and the agent implementation is the source of truth here, not something
 * to bend. So this module runs the SAME agent — same model, same tools, same
 * executors, same grounding — and differs only in what it asks for back: JSON
 * instead of a spoken answer.
 *
 * Everything factual still comes from the agent's own tools. The loop below
 * executes whatever tool calls the model makes through `executeAgentTool`, so a
 * Questions round is grounded by exactly the same code path a chat answer is.
 *
 * GEMINI FALLBACK
 * ----------------
 * Every mode's candidate payload (questions-challenges.ai-prompt.ts) already
 * embeds the real entities a round needs, so tool calls are an optional extra,
 * not a requirement — the same shape the Daily Quiz already authors over with
 * Gemini and no tools (quiz-generator.service.ts). When OpenRouter is not
 * configured, or a run fails (most commonly a 402 "insufficient credits"),
 * this module retries the exact same system/user prompts through Gemini's
 * plain JSON generation instead of returning null. The ENTITY SELECTION RULE
 * still binds: a Gemini-authored round is validated by the same round contract
 * as an OpenRouter one before it can be published.
 */

import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import { logger } from '../utils/logger';
import type { MessageLanguage } from '../utils/message-language.util';
import { parseModelJson } from '../utils/ai-json';
import {
  AGENT_TOOLS,
  executeAgentTool,
  isChatAgentConfigured,
  resolveAgentModel,
} from './chat-agent-tools.service';
import { createAgentOpenAIClient } from './chat-agent.service';
import { buildGroundingSystemMessage, extractGroundedFacts } from './chat-grounding.service';
import { generateGeminiText, isGeminiQuizConfigured, resolveGeminiQuizModel } from './gemini-text.client';

/** Tool-call rounds allowed before we give up on a mode's round. */
const MAX_TOOL_STEPS = 4;

/**
 * A six-question round is a much bigger document than a chat reply.
 * Override with QUESTIONS_ROUND_MAX_TOKENS.
 */
function resolveRoundMaxTokens(): number {
  const raw = process.env.QUESTIONS_ROUND_MAX_TOKENS?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 600) return parsed;
  }
  return 3_500;
}

/**
 * Preferred lower bound for a stable, fully-populated round.
 * Override with QUESTIONS_ROUND_MIN_TOKENS.
 */
function resolveRoundMinTokens(): number {
  const raw = process.env.QUESTIONS_ROUND_MIN_TOKENS?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 400) return parsed;
  }
  return 900;
}

/** Below this, a round is effectively impossible and we should stop retrying. */
const ROUND_HARD_MIN_TOKENS = 400;
/** How many times we can shrink max_tokens after OpenRouter 402 responses. */
const ROUND_402_MAX_RETRIES = 3;

/**
 * Gemini isn't billed against max_tokens the way OpenRouter is, so the fallback
 * gets a generous fixed budget instead of inheriting OpenRouter's
 * credit-trimmed value. Override with QUESTIONS_ROUND_GEMINI_MAX_TOKENS.
 */
function resolveRoundGeminiMaxTokens(): number {
  const raw = process.env.QUESTIONS_ROUND_GEMINI_MAX_TOKENS?.trim();
  if (raw) {
    const parsed = Number.parseInt(raw, 10);
    if (Number.isFinite(parsed) && parsed >= 2_000) return parsed;
  }
  return 12_000;
}

/**
 * OpenRouter answers "402 … can only afford N" when the key's balance is below
 * the requested max_tokens. The chat agent has its own handling for this, but
 * its retry floor (512) is sized for a conversational reply and would never fit
 * a round — so the budget is trimmed to what the account can actually afford
 * here instead, rather than changing the chat agent's behaviour.
 */
function affordableMaxTokens(err: unknown): number | null {
  const message =
    (err as { error?: { message?: string } })?.error?.message ??
    (err as Error)?.message ??
    String(err ?? '');
  if (!/\b402\b/.test(message) && !/requires more credits|can only afford/i.test(message)) {
    return null;
  }
  const match = message.match(/can only afford (\d+)/i);
  if (!match) return null;
  const affordable = Number.parseInt(match[1]!, 10);
  return Number.isFinite(affordable) ? Math.floor(affordable * 0.95) : null;
}

export interface QuestionsAgentParams {
  system: string;
  user: string;
  language: MessageLanguage;
  /** Label used in logs, e.g. "guess-player:en:2026-06-10". */
  label: string;
  temperature?: number;
}

export interface QuestionsAgentResult {
  payload: Record<string, unknown>;
  model: string;
  /** Agent tools the model actually called while building this round. */
  toolsUsed: string[];
}

/** True when either provider — OpenRouter (tool-calling) or Gemini (fallback) — is reachable. */
export function isQuestionsAgentAvailable(): boolean {
  return isChatAgentConfigured() || isGeminiQuizConfigured();
}

/**
 * Runs one round through Gemini's plain JSON generation — no tool calls, since
 * the candidate payload already embeds every entity the prompt needs. Used
 * when OpenRouter is unconfigured or its run failed.
 */
async function runQuestionsAgentViaGemini(
  params: QuestionsAgentParams,
): Promise<QuestionsAgentResult | null> {
  if (!isGeminiQuizConfigured()) return null;

  try {
    const { content, model } = await generateGeminiText({
      system: params.system,
      user: params.user,
      model: resolveGeminiQuizModel(),
      temperature: params.temperature ?? 0.6,
      maxOutputTokens: resolveRoundGeminiMaxTokens(),
      jsonMode: true,
    });

    const payload = parseModelJson(content);
    if (!payload || typeof payload !== 'object') {
      logger.warn('[QuestionsAgent] Gemini fallback returned no usable JSON', {
        label: params.label,
        model,
        preview: content.slice(0, 160).replace(/\s+/g, ' '),
      });
      return null;
    }

    logger.info('[QuestionsAgent] Gemini fallback produced a round', { label: params.label, model });
    return {
      payload: Array.isArray(payload) ? { questions: payload } : (payload as Record<string, unknown>),
      model,
      toolsUsed: [],
    };
  } catch (err) {
    logger.error('[QuestionsAgent] Gemini fallback failed', {
      label: params.label,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

type ToolCallAcc = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

function toToolCalls(calls: ChatCompletionMessageToolCall[] | undefined): ToolCallAcc[] {
  if (!Array.isArray(calls)) return [];
  return calls
    .filter((call) => call.type === 'function')
    .map((call) => ({
      id: call.id,
      type: 'function' as const,
      function: {
        name: (call as { function: { name: string } }).function.name,
        arguments: (call as { function: { arguments?: string } }).function.arguments || '{}',
      },
    }));
}

/**
 * Runs one Questions round through the existing OpenRouter tool-calling agent
 * and returns the JSON it produced, or null on any failure — callers fall back
 * to Gemini rather than treating null as the end of the road.
 */
async function runQuestionsAgentViaOpenRouter(
  params: QuestionsAgentParams,
): Promise<QuestionsAgentResult | null> {
  const provider = 'openrouter';
  if (!isChatAgentConfigured()) return null;

  const client = createAgentOpenAIClient();
  if (!client) return null;

  const model = resolveAgentModel();
  const toolsUsed: string[] = [];
  const toolPayloads: string[] = [];
  let maxTokens = resolveRoundMaxTokens();
  const preferredMinTokens = resolveRoundMinTokens();

  /**
   * One agent turn, trimming max_tokens as many times as needed (within cap)
   * when OpenRouter reports a 402 budget error.
   */
  const createCompletion = async (body: Record<string, unknown>): Promise<any> => {
    let lastError: unknown = null;

    for (let creditAttempt = 0; creditAttempt <= ROUND_402_MAX_RETRIES; creditAttempt += 1) {
      try {
        return await client.chat.completions.create({ ...body, max_tokens: maxTokens } as never);
      } catch (err) {
        lastError = err;
        const affordable = affordableMaxTokens(err);
        if (!affordable || affordable >= maxTokens || creditAttempt >= ROUND_402_MAX_RETRIES) {
          throw err;
        }

        const nextMax = Math.floor(affordable * 0.95);
        if (nextMax >= maxTokens) {
          throw err;
        }
        if (nextMax < ROUND_HARD_MIN_TOKENS) {
          logger.error('[QuestionsAgent] OpenRouter budget too low to write a round', {
            label: params.label,
            affordable: nextMax,
            needed: ROUND_HARD_MIN_TOKENS,
          });
          throw err;
        }

        if (nextMax < preferredMinTokens) {
          logger.warn('[QuestionsAgent] OpenRouter budget below preferred round minimum — trying best effort', {
            label: params.label,
            preferredMin: preferredMinTokens,
            retryWith: nextMax,
          });
        } else {
          logger.warn('[QuestionsAgent] OpenRouter 402 — retrying within the affordable budget', {
            label: params.label,
            from: maxTokens,
            to: nextMax,
          });
        }

        maxTokens = nextMax;
      }
    }

    throw lastError instanceof Error ? lastError : new Error(String(lastError ?? 'ROUND_AI_REQUEST_FAILED'));
  };

  const messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: params.system },
    { role: 'user', content: params.user },
  ];

  try {
    for (let step = 0; step < MAX_TOOL_STEPS; step += 1) {
      const completion = await createCompletion({
        model,
        messages,
        // The agent's own football tools — not a copy, not a subset.
        tools: AGENT_TOOLS,
        tool_choice: 'auto',
        temperature: params.temperature ?? 0.6,
        response_format: { type: 'json_object' },
        reasoning: { effort: 'none' },
      });

      const choice = completion.choices?.[0];
      const message = choice?.message;
      const calls = toToolCalls(message?.tool_calls);

      if (calls.length > 0) {
        messages.push({
          role: 'assistant',
          content: message?.content ?? null,
          tool_calls: message.tool_calls,
        } as ChatCompletionMessageParam);

        const results = await Promise.all(
          calls.map(async (call) => {
            toolsUsed.push(call.function.name);
            logger.info(`[QuestionsAgent] tool call: ${call.function.name}`, { label: params.label });
            // The agent's executor — the same one the chat agent runs.
            const content = await executeAgentTool(call.function.name, call.function.arguments, {
              language: params.language,
            });
            return { role: 'tool' as const, tool_call_id: call.id, content };
          }),
        );

        toolPayloads.push(...results.map((result) => result.content));
        messages.push(...results);

        // Same grounding pin the chat agent applies after tools run: the tool
        // payload is the only permitted source of a number, club or name.
        const grounding = buildGroundingSystemMessage(extractGroundedFacts(toolPayloads));
        if (grounding) {
          messages.push({ role: 'system', content: grounding });
        }
        continue;
      }

      const payload = parseModelJson(message?.content ?? '');
      if (payload && typeof payload === 'object') {
        return {
          payload: Array.isArray(payload)
            ? { questions: payload }
            : (payload as Record<string, unknown>),
          model,
          toolsUsed,
        };
      }

      logger.warn('[QuestionsAgent] agent returned no usable JSON', {
        label: params.label,
        provider,
        step,
        finishReason: choice?.finish_reason,
        preview: String(message?.content ?? '').slice(0, 160).replace(/\s+/g, ' '),
      });
      return null;
    }

    logger.warn('[QuestionsAgent] tool loop exhausted without a round', {
      label: params.label,
      provider,
    });
    return null;
  } catch (err) {
    logger.error('[QuestionsAgent] agent run failed', {
      label: params.label,
      provider,
      error: err instanceof Error ? err.message : String(err),
      stack: err instanceof Error ? err.stack : undefined,
    });
    return null;
  }
}

/**
 * Which provider this deployment wants to write rounds with. Same env var
 * isGeminiQuizConfigured() already reads, so provider choice stays stated in
 * exactly one place rather than being split between config and call order.
 */
function preferredQuizProvider(): 'gemini' | 'openrouter' {
  const provider = (process.env.QUIZ_AI_PROVIDER ?? process.env.AI_QUIZ_PROVIDER ?? 'gemini')
    .trim()
    .toLowerCase();
  return provider === 'openrouter' ? 'openrouter' : 'gemini';
}

/**
 * Runs one Questions round through the existing agent and returns the JSON it
 * produced, or null.
 *
 * Tries the configured provider (QUIZ_AI_PROVIDER) first and the other one as
 * fallback. That ordering used to be hardcoded to OpenRouter-first, which meant
 * a deployment that had deliberately selected Gemini still opened every single
 * round with an OpenRouter call — on a credit-less key that is a guaranteed 402
 * plus its retry ladder before any real attempt begins, paid for in latency on
 * a user-facing request. Null is still the only failure mode once both
 * providers have been tried: there is no authored-content path behind this.
 */
export async function runQuestionsAgent(
  params: QuestionsAgentParams,
): Promise<QuestionsAgentResult | null> {
  if (!isChatAgentConfigured() && !isGeminiQuizConfigured()) {
    logger.warn('[QuestionsAgent] no AI provider configured — Questions has no AI to call', {
      label: params.label,
    });
    return null;
  }

  const geminiFirst = preferredQuizProvider() === 'gemini' && isGeminiQuizConfigured();

  if (geminiFirst) {
    const result = await runQuestionsAgentViaGemini(params);
    if (result) return result;
    if (isChatAgentConfigured()) {
      logger.warn('[QuestionsAgent] Gemini attempt failed — falling back to OpenRouter', {
        label: params.label,
      });
    }
    return runQuestionsAgentViaOpenRouter(params);
  }

  if (isChatAgentConfigured()) {
    const result = await runQuestionsAgentViaOpenRouter(params);
    if (result) return result;
    if (isGeminiQuizConfigured()) {
      logger.warn('[QuestionsAgent] OpenRouter attempt failed — falling back to Gemini', {
        label: params.label,
      });
    }
  }

  return runQuestionsAgentViaGemini(params);
}
