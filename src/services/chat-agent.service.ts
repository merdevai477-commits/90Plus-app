/**
 * Football chat agent — OpenRouter Qwen tool-calling loop.
 * Streams final answer tokens via onToken; executes AGENT_TOOLS between steps.
 */

import OpenAI from 'openai';
import type {
  ChatCompletionMessageParam,
  ChatCompletionMessageToolCall,
} from 'openai/resources/chat/completions';
import { logger } from '../utils/logger';
import type { MessageLanguage } from '../utils/message-language.util';
import {
  AGENT_TOOLS,
  executeAgentTool,
  isChatAgentConfigured,
  resolveAgentModel,
} from './chat-agent-tools.service';

const MAX_STEPS = 5;
const AGENT_STREAM_MAX_TOKENS = 900;
const AGENT_FINAL_MAX_TOKENS = 700;

function isCreditBudgetError(err: unknown): boolean {
  const msg = String((err as Error)?.message ?? err ?? '');
  return /\b402\b/.test(msg) || /requires more credits|can only afford/i.test(msg);
}

async function createAgentCompletion(
  client: OpenAI,
  body: Record<string, unknown>,
): Promise<any> {
  try {
    return await client.chat.completions.create(body as any);
  } catch (err) {
    if (!isCreditBudgetError(err)) throw err;
    const current = Number(body.max_tokens ?? AGENT_STREAM_MAX_TOKENS);
    const reduced = Math.max(256, Math.min(current, 512));
    if (reduced >= current) throw err;
    logger.warn(
      `[chat-agent] OpenRouter credit budget hit — retrying with max_tokens=${reduced}`,
    );
    return await client.chat.completions.create({
      ...body,
      max_tokens: reduced,
    } as any);
  }
}

const TOOL_USAGE_PREAMBLE = `
أدوات البيانات (مهم جدًا):
- أي معلومة وقتية (نادي لاعب حالي، سن، إحصائيات الموسم، مباريات، نتيجة، دقيقة، تشكيل، أحداث، ألقاب) لازم تجيبها من الأدوات قبل ما ترد.
- لو السؤال عن لاعب → search_player. لو ألقاب/كاس عالم/بطولات → get_player_career (مهم).
- لو مباريات النهاردة عمومًا → get_today_matches. لو دوري معيّن (مصري/بريمير…) → get_today_matches مع league.
- لو لايف دلوقتي → get_live_matches.
- لو سؤال عن ماتش معين بالاسم → resolve_match أولًا عشان تجيب fixtureId، بعدين get_match_details و/أو get_match_lineup.
- لو الترتيب → get_standings. لو الهدافين → get_top_scorers. لو فريق → get_team_info.
- ممكن تنادي أكتر من أداة في نفس الخطوة.
- للألقاب: استخدم الأرقام من الأداة فقط (fifaWorldCup / apiFootballWorldCup). لو المصدر يقول 1 متقولش 2.
- ماتخمنش أرقام من ذاكرتك. لو الأداة رجّعت خطأ أو فاضي، قول إن البيانات مش متاحة دلوقتي.
- لو السؤال واسع جدًا: ادّي 1–2 معلومة أساسية فقط، بعدين اسأل المستخدم عايز يتابع في إيه.
- ماتذكرش أسماء الأدوات أو API للمستخدم.
`.trim();

export interface AgentHistoryItem {
  role: 'user' | 'assistant';
  content: string;
}

export interface RunFootballAgentParams {
  systemPrompt: string;
  history: AgentHistoryItem[];
  userMessage: string;
  language: MessageLanguage;
  onToken: (token: string) => void;
  signal?: AbortSignal;
}

export interface RunFootballAgentResult {
  fullText: string;
  usedModel: string;
  toolsUsed: string[];
}

function buildClient(): OpenAI | null {
  const apiKey = process.env.OPENROUTER_API_KEY ?? process.env.AI_API_KEY ?? '';
  if (!apiKey) return null;
  const baseURL =
    process.env.OPENROUTER_BASE_URL ??
    process.env.AI_BASE_URL ??
    'https://openrouter.ai/api/v1';
  return new OpenAI({
    apiKey,
    baseURL,
    defaultHeaders: {
      'HTTP-Referer': 'https://90plus.pro',
      'X-Title': '90Plus AI Agent',
    },
  });
}

type ToolCallAcc = {
  id: string;
  type: 'function';
  function: { name: string; arguments: string };
};

function mergeToolCallDelta(
  acc: Map<number, ToolCallAcc>,
  deltas: Array<{
    index?: number;
    id?: string;
    type?: string;
    function?: { name?: string; arguments?: string };
  }>,
): void {
  for (const d of deltas) {
    const idx = d.index ?? 0;
    const cur = acc.get(idx) ?? {
      id: '',
      type: 'function' as const,
      function: { name: '', arguments: '' },
    };
    if (d.id) cur.id = d.id;
    if (d.function?.name) cur.function.name += d.function.name;
    if (d.function?.arguments) cur.function.arguments += d.function.arguments;
    acc.set(idx, cur);
  }
}

function toToolCalls(acc: Map<number, ToolCallAcc>): ChatCompletionMessageToolCall[] {
  return [...acc.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([, t]) => ({
      id: t.id || `call_${t.function.name}_${Math.random().toString(36).slice(2, 8)}`,
      type: 'function' as const,
      function: {
        name: t.function.name,
        arguments: t.function.arguments || '{}',
      },
    }));
}

/**
 * Run the football tool-calling agent. Throws if OpenRouter is not configured
 * or the loop fails before producing any answer tokens.
 */
export async function runFootballAgent(
  params: RunFootballAgentParams,
): Promise<RunFootballAgentResult> {
  if (!isChatAgentConfigured()) {
    throw new Error('chat_agent_not_configured');
  }
  const client = buildClient();
  if (!client) throw new Error('chat_agent_no_client');

  const model = resolveAgentModel();
  const toolsUsed: string[] = [];
  let fullText = '';
  let lastToolPayloads: string[] = [];

  const messages: ChatCompletionMessageParam[] = [
    {
      role: 'system',
      content: `${params.systemPrompt}\n\n${TOOL_USAGE_PREAMBLE}`,
    },
    ...params.history
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content }) as ChatCompletionMessageParam),
    { role: 'user', content: params.userMessage },
  ];

  for (let step = 0; step < MAX_STEPS; step++) {
    if (params.signal?.aborted) break;

    const toolCallAcc = new Map<number, ToolCallAcc>();
    let stepContent = '';
    let sawToolCalls = false;
    let finishReason: string | null = null;

    let stream: AsyncIterable<{
      choices: Array<{
        finish_reason?: string | null;
        delta?: {
          content?: string | null;
          tool_calls?: Array<{
            index?: number;
            id?: string;
            type?: string;
            function?: { name?: string; arguments?: string };
          }>;
        };
      }>;
    }>;

    try {
      stream = (await createAgentCompletion(client, {
        model,
        messages,
        tools: AGENT_TOOLS,
        tool_choice: step === 0 ? 'auto' : 'auto',
        temperature: 0.35,
        max_tokens: AGENT_STREAM_MAX_TOKENS,
        stream: true,
        reasoning: { effort: 'none' },
      })) as unknown as typeof stream;
    } catch (err) {
      logger.error(
        `[chat-agent] OpenRouter create failed step=${step}:`,
        (err as Error)?.message ?? err,
      );
      throw err;
    }

    for await (const chunk of stream) {
      if (params.signal?.aborted) break;
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta;
      if (delta?.tool_calls?.length) {
        sawToolCalls = true;
        mergeToolCallDelta(toolCallAcc, delta.tool_calls);
      }
      const token = delta?.content ?? '';
      if (token) {
        stepContent += token;
        if (!sawToolCalls) {
          fullText += token;
          params.onToken(token);
        }
      }
    }

    const toolCalls = toToolCalls(toolCallAcc);

    if (toolCalls.length > 0) {
      fullText = '';
      messages.push({
        role: 'assistant',
        content: stepContent || null,
        tool_calls: toolCalls,
      });

      const results = await Promise.all(
        toolCalls.map(async (tc) => {
          const fn =
            tc.type === 'function'
              ? tc.function
              : { name: 'unknown', arguments: '{}' };
          const name = fn.name;
          toolsUsed.push(name);
          logger.info(`[chat-agent] tool call: ${name}`);
          const content = await executeAgentTool(name, fn.arguments, {
            language: params.language,
          });
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content,
          };
        }),
      );
      lastToolPayloads = results.map((r) => r.content);
      messages.push(...results);

      // After tools: prefer a non-streaming final answer (more reliable than SSE).
      if (step < MAX_STEPS - 1) {
        try {
          const final = await createAgentCompletion(client, {
            model,
            messages,
            temperature: 0.35,
            max_tokens: AGENT_FINAL_MAX_TOKENS,
            stream: false,
            reasoning: { effort: 'none' },
          });
          const answer =
            final.choices?.[0]?.message?.content?.trim() ??
            '';
          if (answer) {
            fullText = answer;
            params.onToken(answer);
            return { fullText, usedModel: model, toolsUsed };
          }
          // If empty, continue the loop for another streaming attempt.
          logger.warn('[chat-agent] non-stream final answer empty — retrying loop');
        } catch (err) {
          logger.warn(
            '[chat-agent] non-stream final failed, continuing loop:',
            (err as Error)?.message ?? err,
          );
        }
      }
      continue;
    }

    // Final answer turn already streamed via onToken
    if (stepContent) {
      if (!fullText) {
        fullText = stepContent;
        params.onToken(stepContent);
      }
      return { fullText, usedModel: model, toolsUsed };
    }

    logger.warn(
      `[chat-agent] empty step finish=${finishReason ?? 'none'} step=${step}`,
    );
    break;
  }

  // Soft fallback: never leave the user with a blank service error if tools ran.
  if (!fullText && lastToolPayloads.length > 0) {
    const fallback =
      params.language === 'en'
        ? 'I pulled the latest data but could not finish the reply. Please ask again in a moment.'
        : 'جيب البيانات اللحظية بس الرد اتقطع. جرّب تبعت السؤال تاني بعد لحظات.';
    fullText = fallback;
    params.onToken(fallback);
    return { fullText, usedModel: model, toolsUsed };
  }

  if (!fullText) {
    throw new Error('chat_agent_empty_response');
  }
  return { fullText, usedModel: model, toolsUsed };
}

export { isChatAgentConfigured, resolveAgentModel };
