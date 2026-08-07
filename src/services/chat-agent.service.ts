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

const TOOL_USAGE_PREAMBLE = `
أدوات البيانات (مهم جدًا):
- أي معلومة وقتية (نادي لاعب حالي، سن، إحصائيات الموسم، مباريات، نتيجة، دقيقة، تشكيل، أحداث) لازم تجيبها من الأدوات قبل ما ترد.
- لو السؤال عن لاعب → search_player (ثم get_player_career لو سأل عن ألقاب/مسيرة).
- لو مباريات النهاردة → get_today_matches. لو لايف دلوقتي → get_live_matches.
- لو سؤال عن ماتش معين بالاسم → resolve_match أولًا عشان تجيب fixtureId، بعدين get_match_details و/أو get_match_lineup.
- لو الترتيب → get_standings. لو الهدافين → get_top_scorers. لو فريق → get_team_info.
- ممكن تنادي أكتر من أداة في نفس الخطوة.
- ماتخمنش أرقام من ذاكرتك. لو الأداة رجّعت خطأ أو فاضي، قول إن البيانات مش متاحة دلوقتي.
- لو السؤال واسع جدًا: ادّي 1–2 معلومة أساسية فقط، بعدين اسأل المستخدم عايز يتابع في إيه (مثلاً: التشكيل، الأحداث، ولا الترتيب؟).
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

    const stream = (await client.chat.completions.create({
      model,
      messages,
      tools: AGENT_TOOLS,
      tool_choice: 'auto',
      temperature: 0.35,
      max_tokens: 2048,
      stream: true,
      // OpenRouter extension — disable Qwen thinking tokens for snappy tool use
      reasoning: { effort: 'none' },
    } as any)) as unknown as AsyncIterable<{
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

    for await (const chunk of stream) {
      if (params.signal?.aborted) break;
      const choice = chunk.choices[0];
      if (!choice) continue;
      if (choice.finish_reason) finishReason = choice.finish_reason;

      const delta = choice.delta as {
        content?: string | null;
        tool_calls?: Array<{
          index?: number;
          id?: string;
          type?: string;
          function?: { name?: string; arguments?: string };
        }>;
      };

      if (delta.tool_calls?.length) {
        sawToolCalls = true;
        mergeToolCallDelta(toolCallAcc, delta.tool_calls);
      }
      const token = delta.content ?? '';
      if (token) {
        stepContent += token;
        // Tool turns almost never emit content; stream answer tokens live.
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
      messages.push(...results);
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

  if (!fullText) {
    throw new Error('chat_agent_empty_response');
  }
  return { fullText, usedModel: model, toolsUsed };
}

export { isChatAgentConfigured, resolveAgentModel };
