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
import {
  buildGroundedFactReply,
  buildGroundingSystemMessage,
  extractGroundedFacts,
} from './chat-grounding.service';

const MAX_STEPS = 3;
const AGENT_STREAM_MAX_TOKENS = 480;
const AGENT_FINAL_MAX_TOKENS = 420;

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
قواعد البيانات (صارمة — زي بروفايل اللاعب في التطبيق):
- أي سؤال عن لاعب/نادي/مباراة/ألقاب/إحصائيات = لازم أداة أولًا. متجاوبش من ذاكرتك أبدًا.
- اسم مش متأكد إنه لاعب ولا نادي ولا دوري ولا مدرب → search_football أولًا. لو رجّعت quickFacts أو source جاوب منها على طول — أداة واحدة بس في الدور، ومتستدعيش search_player بعد ما السيرش رجّع بروفايل.
- لاعب (نادي حالي، سيزون، أهداف، ألقاب، فين بيلعب) → search_player لو الاسم واضح، أو search_football لو الاسم غامض/فيه غلطة. للألقاب زوّد get_player_career. لو معاك athlete_id من السيرش مرّره.
- أهداف لاعب في بطولة محددة (كأس العالم / دوري الأبطال) → get_player_career. استخدم worldCupGoals.total للـWorld Cup و uclSummary للأبطال. لو worldCupGoals = null قول إن مفيش بيانات كأس عالم مؤكدة للاعب ده — ممنوع تخمّن رقم.
- فريق + ألقاب أفريقيا/بطولات → get_team_info أو تفاصيل search_football للنادي. استخدم cafChampionsLeagueWins / answerHint فقط.
- مدرب فريق أو منتخب (مين المدرب/المدير الفني، مدرب منتخب مصر) → search_football للنادي أو get_team_info، واستخدم حقل coach زي ما هو. منتخب مصر = Egypt.
- تشكيلة / لاعبين الفريق / مين في الفريق → get_team_squad (team_name أو competitor_id من السيرش).
- هداف الفريق / صنّاع اللعب → get_team_scorers. لو المستخدم قال «الفريق» من غير اسم، استخدم النادي اللي اتحدد في الشات قبل كده (مثلاً الأهلي المصري).
- تفاصيل مباراة انتهت / آخر ماتش / اللي خلص / مين سجل في الماتش / نتيجة آخر مباراة للفريق → get_team_match (when=last_finished). استخدم النادي الحالي في الشات. جاوب بالنتيجة والأهداف والتشكيل من الأداة بس.
- اسم قصير مشترك زي «الأهلي» من غير مصري/سعودي: لو الأداة رجّعت need_clarification اسأل «قصدك الأهلي المصري ولا الأهلي السعودي؟» واستنى الرد. بعد ما يحدد، اعتبره النادي ده لباقي الأسئلة.
- مباريات النهاردة → get_today_matches (بترجع live/finished/upcoming). مباريات دوري معيّن (اي اللي انتهى/لايف/جاي) → get_today_matches مع league. أهم المباريات الجاية → get_today_matches مع when="upcoming". لايف دلوقتي بس → get_live_matches.
- ماتش نادي معيّن (لعب امتى/الجاية/بيلعب دلوقتي) → get_team_match أو resolve_match باسم النادي، وبعدها get_match_details لو محتاج تفاصيل أكتر.
- ترتيب دوري أو بطولة مش من الأبطال المشهورين → search_football (competition) أو get_standings.
- في المباريات: قدّم اللايف الأول (الدقيقة + النتيجة)، بعدين اللي خلص (النتيجة النهائية)، بعدين الجاي (معاد البداية). استخدم جدول لو فيه 3 صفوف أو أكتر.
- اعتمد على quickFacts و seasonStats و answerHint من نتيجة الأداة. لو seasonStats موجودة متقولش "مفيش بيانات".
- لو نتيجة الأداة فيها status="need_clarification" أو فيها suggestions/hits: اسأل المستخدم للتأكيد "قصدك <الاسم>؟" واستنى ردّه — ممنوع تخترع لاعب أو تجاوب من ذاكرتك. ولو مفيش نتيجة خالص اطلب الاسم الكامل أو اسم النادي بلطف.
- لاعب متوسط الشهرة أو اسم فيه غلطة إملائية: اعتمد على نتيجة search_football أو search_player (بتعمل تصحيح وبحث ذكي). متقولش "مش لاقيه" طول ما فيه suggestions.

قاعدة الالتزام بالأرقام (أهم قاعدة — مخالفتها = رد غلط):
- الرقم اللي في الأداة هو الحقيقة الوحيدة. أرقام الألقاب من (quickFacts.worldCupTitles / quickFacts.championsLeagueTitles / cafChampionsLeagueWins) بس. لو العدد 1 قول 1، ولو 0 قول 0 — ممنوع تزوّد ولا تقلّل.
- لو عدد كاس العالم = 1 يبقى اللاعب فاز بكاس عالم فعلًا. ممنوع تقول "ماكسبش" أو "لسه صغير" أو تعكس الرقم اللي في الأداة بناءً على ذاكرتك أو سن اللاعب.
- ممنوع منعًا باتًا تضيف من ذاكرتك: سنة بطولة، اسم منتخب، اسم نادي، أو نسخة/إصدار بطولة — إلا لو مكتوبة صراحة في نتيجة الأداة (مثال: apiFootballWorldCup.wins). متقولش "كأس العالم 2022" لو السنة مش موجودة في الأداة.
- نادي اللاعب الحالي: استخدم قيمة club / quickFacts.currentClub من الأداة بالظبط (مثال: حكيمي = باريس سان جيرمان). ممنوع تذكر نادي قديم أو نادي من ذاكرتك.
- ممنوع أي سرد تاريخي أو تعليق زيادة حوالين البطولة — جاوب على السؤال بالرقم/النادي وبس.

الأسلوب (صاحب كروي محترف):
- ابدأ بالإجابة المباشرة في أول سطر، و**بولد** للرقم/النادي/الاسم المهم.
- بعد كده لو مفيد: ٢–٤ نقط قصيرة، أو جدول Markdown مضغوط للبيانات المتعددة (مباريات، إحصائيات مواسم، ترتيب، مقارنات).
- لهجة مصرية ودودة وطبيعية زي صاحب بيفهم كورة — محترم ومضبوط، من غير حشو ولا سرد تاريخي زيادة ولا إيموجي كتير.
- الدقة أهم حاجة: الأسلوب الحلو ماينفعش يغيّر أي رقم/نادي — الأرقام والنوادي من الأداة بس.
- ماتذكرش أسماء الأدوات أو API للمستخدم.
`.trim();

function skipEntityPrefetch(message: string): boolean {
  const m = message.trim();
  if (m.length < 2) return true;
  if (/^(hi|hello|hey|اهلا|أهلا|السلام|سلام|ازيك|عامل ايه|صباح|مساء)[\s!.,؟?]*$/i.test(m)) {
    return true;
  }
  return /(?:مباريات|ماتشات|matches)\s*(?:النهاردة|اليوم|today)\s*$/i.test(m)
    || /^(?:لايف|مباشر|live)\s*(?:دلوقتي)?\s*$/i.test(m)
    || /مين بيلعب دلوقتي|اي اللي لعب/i.test(m);
}

/** Pull the likely player/club/league name out of a question so 365 search isn't handed the whole sentence. */
function extractSearchQuery(message: string): string | null {
  let s = message.replace(/[؟?!,.،]/g, ' ').replace(/\s+/g, ' ').trim();
  if (s.length < 2) return null;
  const stripped = s
    .replace(
      /مين(?:\s+هو|\s+هي)?|من هو|من هي|who(?:'s| is)?|كام|عدد|فين(?:\s+بيلعب)?|بيلعب\s+فين|where(?:\s+does)?|how many|ايه|إيه|ترتيب|جدول/gi,
      ' ',
    )
    .replace(/\s+/g, ' ')
    .trim();
  const q = stripped.length >= 2 ? stripped : s;
  if (/^(مباريات|ماتشات|matches|النهاردة|اليوم|today|لايف|مباشر|live)$/i.test(q)) return null;
  return q;
}

function formatPrefetchClarification(parsed: any, language: MessageLanguage): string | null {
  if (!parsed || parsed.status !== 'need_clarification') return null;
  const names: string[] = [];
  if (Array.isArray(parsed.suggestions) && parsed.suggestions.length) {
    for (const s of parsed.suggestions) {
      names.push(s.label || (s.country ? `${s.name} (${s.country})` : s.name));
    }
  } else {
    const hits = parsed.hits ?? {};
    for (const c of hits.clubs ?? []) names.push(c.country ? `${c.name} (${c.country})` : c.name);
    for (const c of hits.nationalTeams ?? []) names.push(c.name);
    for (const p of hits.players ?? []) names.push(p.club ? `${p.name} (${p.club})` : p.name);
    for (const p of hits.coaches ?? []) names.push(p.name);
    for (const c of hits.competitions ?? []) names.push(c.name);
  }
  if (!names.length) return null;
  const listed = names.slice(0, 4).map((n) => `**${n}**`).join(language === 'en' ? ' or ' : ' ولا ');
  return language === 'en'
    ? `Which club did you mean — ${listed}?`
    : `قصدك أنهي؟ ${listed}؟`;
}

function isTeamFollowUp(message: string): boolean {
  return /هداف|هدافين|تشكيلة|قائمة|اللاعبين|لاعبين(?:\s+ال?فريق)?|سكواد|squad|scorer|roster|line[- ]?up|نجوم ال?فريق|مين في الفريق/i.test(
    message,
  );
}

/** Last finished / match details about the conversation's focus club — not today's slate. */
function isLastMatchFollowUp(message: string): boolean {
  if (/(?:مباريات|ماتشات|matches)\s*(?:النهاردة|اليوم|today)/i.test(message)) return false;
  return (
    /آخر\s*(?:مباراة|ماتش)|المباراة الأخيرة|last\s+match/i.test(message) ||
    /(?:الماتش|المباراة).{0,24}(?:خلص|انتهى|انتهت)/i.test(message) ||
    /(?:اللي|اللى)\s+(?:خلص|انتهى|انتهت)/i.test(message) ||
    /تفاصيل\s*(?:ال)?(?:مباراة|ماتش|match)/i.test(message) ||
    /مباراة\s+انتهت/i.test(message) ||
    /أحداث\s*(?:ال)?(?:مباراة|ماتش)/i.test(message) ||
    /مين\s+سجل/i.test(message) ||
    /تشكيل(?:ة)?\s*(?:ال)?(?:مباراة|ماتش)/i.test(message) ||
    /finished\s+match|match\s+details/i.test(message) ||
    /(?:نتيجة|تفاصيل).{0,16}(?:الماتش|المباراة|مباراة)/i.test(message)
  );
}

function looksLikeClubName(message: string): boolean {
  return /أهلي|اهلي|زمالك|ريال|برشلون|ليفربول|سيتي|ارسنال|أرسنال|بيراميدز|المصري|نصر|هلال|اتحاد|يوفنتوس|بايرن|تشيلسي|فريق|نادي|منتخب/i.test(
    message,
  );
}

function isClubFollowUp(message: string): boolean {
  return isTeamFollowUp(message) || isLastMatchFollowUp(message);
}

function extractFocusTeamFromHistory(
  history: Array<{ role: string; content: string }>,
  currentMessage: string,
): string | null {
  if (looksLikeClubName(currentMessage) && !isClubFollowUp(currentMessage)) {
    return extractSearchQuery(currentMessage);
  }
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role === 'user' && looksLikeClubName(msg.content) && !isClubFollowUp(msg.content)) {
      return extractSearchQuery(msg.content) ?? msg.content.trim();
    }
    if (msg.role === 'assistant') {
      const labels = [...msg.content.matchAll(/\*\*([^*]+(?:المصري|السعودي|مصر|سعود)[^*]*)\*\*/g)];
      if (labels.length) return labels[0][1];
      const bold = [...msg.content.matchAll(/\*\*([^*]{3,40})\*\*/g)].map((m) => m[1]);
      const club = bold.find((b) => looksLikeClubName(b));
      if (club) return club;
    }
  }
  return null;
}

function formatSquadReply(parsed: any, language: MessageLanguage): string | null {
  if (!parsed || parsed.error || parsed.status === 'need_clarification') return null;
  const team = parsed.teamName ?? (language === 'en' ? 'The team' : 'الفريق');
  const line = (title: string, rows: Array<{ name?: string; jersey?: number | null }>) => {
    if (!rows?.length) return '';
    const names = rows
      .slice(0, 8)
      .map((p) => (p.jersey ? `${p.name} (${p.jersey})` : p.name))
      .join(language === 'en' ? ', ' : '، ');
    return `- ${title}: ${names}`;
  };
  const parts = [
    language === 'en' ? `**${team}** squad:` : `تشكيلة **${team}**:`,
    line(language === 'en' ? 'GK' : 'حراسة', parsed.goalkeepers),
    line(language === 'en' ? 'DEF' : 'دفاع', parsed.defenders),
    line(language === 'en' ? 'MID' : 'وسط', parsed.midfielders),
    line(language === 'en' ? 'FWD' : 'هجوم', parsed.forwards),
  ].filter(Boolean);
  return parts.length > 1 ? parts.join('\n') : null;
}

function formatScorersReply(parsed: any, language: MessageLanguage): string | null {
  if (!parsed || parsed.error || parsed.status === 'need_clarification') return null;
  const top = Array.isArray(parsed.topScorers) ? parsed.topScorers : [];
  if (!top.length) return null;
  const team = parsed.teamName ?? (language === 'en' ? 'The team' : 'الفريق');
  const first = top[0];
  const rest = top.slice(1, 5).map((r: any) => `${r.name} (${r.value})`).join(language === 'en' ? ', ' : '، ');
  if (language === 'en') {
    return `**${team}** top scorer is **${first.name}** with **${first.value}** goals.${rest ? ` Then: ${rest}.` : ''}`;
  }
  return `هدّاف **${team}** هو **${first.name}** بـ **${first.value}** هدف.${rest ? ` وراه: ${rest}.` : ''}`;
}

function formatTeamMatchReply(parsed: any, language: MessageLanguage): string | null {
  if (!parsed || parsed.error || parsed.status === 'need_clarification') return null;
  const match = parsed.match;
  if (!match?.home || !match?.away) return null;
  const hs = match.score?.home;
  const as = match.score?.away;
  const score = hs != null && as != null ? `${hs}–${as}` : language === 'en' ? 'TBD' : 'لسه';
  const league = match.league ? ` · ${match.league}` : '';
  const header =
    language === 'en'
      ? `**${match.home} ${score} ${match.away}**${league}`
      : `**${match.home} ${score} ${match.away}**${league}`;

  const events = Array.isArray(parsed.events) ? parsed.events : [];
  const goals = events.filter((e: any) => {
    const t = String(e.type ?? '');
    const d = String(e.detail ?? '');
    if (/missed/i.test(d)) return false;
    return /goal/i.test(t) || /goal/i.test(d);
  });
  const goalBits = goals.map((e: any) => {
    const min = e.minute != null ? `${e.minute}'` : '';
    const own = /own/i.test(String(e.detail ?? ''))
      ? language === 'en'
        ? ' OG'
        : ' (عكس)'
      : '';
    const pen =
      /penalty/i.test(String(e.detail ?? '')) && !/own/i.test(String(e.detail ?? ''))
        ? language === 'en'
          ? ' pen'
          : ' (جزاء)'
        : '';
    return `${e.player ?? '?'}${own}${pen} ${min}`.trim();
  });
  const goalLine = goalBits.length
    ? language === 'en'
      ? `Goals: ${goalBits.join(', ')}`
      : `الأهداف: ${goalBits.join('، ')}`
    : '';

  const team = String(parsed.teamName ?? '');
  const lineups = Array.isArray(parsed.lineups) ? parsed.lineups : [];
  const ours =
    (team
      ? lineups.find((l: any) =>
          String(l?.team ?? '')
            .toLowerCase()
            .includes(team.toLowerCase().slice(0, 6)),
        )
      : null) ?? lineups[0];
  const xi = Array.isArray(ours?.startXI) ? ours.startXI.filter(Boolean).slice(0, 11) : [];
  const xiLine =
    xi.length >= 7
      ? language === 'en'
        ? `${ours?.team ?? 'XI'} (${ours?.formation ?? 'XI'}): ${xi.join(', ')}`
        : `${ours?.team ?? 'التشكيلة'} (${ours?.formation ?? 'XI'}): ${xi.join('، ')}`
      : '';

  return [header, goalLine && `- ${goalLine}`, xiLine && `- ${xiLine}`].filter(Boolean).join('\n');
}

async function streamFinalAnswer(
  client: OpenAI,
  model: string,
  messages: ChatCompletionMessageParam[],
  onToken: (token: string) => void,
  signal?: AbortSignal,
): Promise<string> {
  const stream = (await createAgentCompletion(client, {
    model,
    messages,
    temperature: 0.2,
    max_tokens: AGENT_FINAL_MAX_TOKENS,
    stream: true,
    reasoning: { effort: 'none' },
  })) as AsyncIterable<{
    choices: Array<{ delta?: { content?: string | null } }>;
  }>;
  let full = '';
  for await (const chunk of stream) {
    if (signal?.aborted) break;
    const token = chunk.choices[0]?.delta?.content ?? '';
    if (!token) continue;
    full += token;
    onToken(token);
  }
  return full.trim();
}

function shouldRequireTools(message: string): boolean {
  const m = message.trim();
  if (m.length < 2) return false;
  if (/^(hi|hello|hey|اهلا|أهلا|السلام|سلام|ازيك|عامل ايه|صباح|مساء)[\s!.,؟?]*$/i.test(m)) {
    return false;
  }
  return /(مين|كام|عدد|فين|أين|اين|يلعب|سيزون|موسم|بيانات|احصائ|إحصائ|كاس|كأس|شامبيونز|افريق|أفريق|اهلي|أهلي|مبار|ماتش|لايف|مباشر|اليوم|النهاردة|الجايه|الجاية|القادمة|القادمه|اهداف|أهداف|صنع|تروفي|ألقاب|القاب|نادي|دوري|مدرب|مدير فني|منتخب|ترتيب|جدول|هداف|تشكيلة|قائمة|لاعبين|coach|manager|where|how many|season|trophy|champions|live|today|upcoming|next|goals|assists|club|squad|scorer)/i.test(
    m,
  );
}
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

/**
 * The agent's OpenRouter client. Exported (as createAgentOpenAIClient) so other
 * agent surfaces — the Questions round builder — reuse these exact credentials,
 * base URL and headers instead of resolving their own. Behaviour unchanged.
 */
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

  const startedAt = Date.now();
  const focusTeam = extractFocusTeamFromHistory(params.history, params.userMessage);
  if (focusTeam) {
    messages[0] = {
      role: 'system',
      content:
        `${String(messages[0].content)}\n\n` +
        (params.language === 'en'
          ? `Conversation focus club: ${focusTeam}. If the user says "the team" / scorers / squad / last match, they mean this club.`
          : `النادي الحالي في الشات: ${focusTeam}. لو المستخدم قال الفريق / الهداف / التشكيلة / اللاعبين / تفاصيل الماتش اللي خلص فالمقصود النادي ده.`),
    };
  }

  const matchFollowUp = isLastMatchFollowUp(params.userMessage);
  const followUp = isTeamFollowUp(params.userMessage) || matchFollowUp;
  const prefetchQuery =
    followUp
      ? focusTeam
      : !skipEntityPrefetch(params.userMessage) && shouldRequireTools(params.userMessage)
        ? extractSearchQuery(params.userMessage)
        : null;
  const prefetchTool = followUp
    ? matchFollowUp
      ? 'get_team_match'
      : /هداف|scorer|goals?|assist|صناع/i.test(params.userMessage)
        ? 'get_team_scorers'
        : /مدرب|coach|مدير فني/i.test(params.userMessage)
          ? 'get_team_info'
          : 'get_team_squad'
    : prefetchQuery
      ? 'search_football'
      : null;

  if (prefetchQuery && prefetchTool) {
    const tPrefetch = Date.now();
    try {
      const args =
        prefetchTool === 'search_football'
          ? { query: prefetchQuery }
          : { team_name: prefetchQuery };
      const payload = await executeAgentTool(prefetchTool, JSON.stringify(args), {
        language: params.language,
        userMessage: params.userMessage,
      });
      toolsUsed.push(prefetchTool);
      logger.info(
        `[chat-agent] prefetch ${prefetchTool} q="${prefetchQuery}" ${Date.now() - tPrefetch}ms`,
      );
      let parsed: any = null;
      try {
        parsed = JSON.parse(payload);
      } catch {
        parsed = null;
      }
      const clarify = formatPrefetchClarification(parsed, params.language);
      if (clarify) {
        fullText = clarify;
        params.onToken(clarify);
        logger.info(`[chat-agent] prefetch clarify ${Date.now() - startedAt}ms`);
        return { fullText, usedModel: model, toolsUsed };
      }
      const scored = formatScorersReply(parsed, params.language);
      if (scored && prefetchTool === 'get_team_scorers') {
        fullText = scored;
        params.onToken(scored);
        logger.info(`[chat-agent] prefetch scorers ${Date.now() - startedAt}ms`);
        return { fullText, usedModel: model, toolsUsed };
      }
      const squad = formatSquadReply(parsed, params.language);
      if (squad && prefetchTool === 'get_team_squad') {
        fullText = squad;
        params.onToken(squad);
        logger.info(`[chat-agent] prefetch squad ${Date.now() - startedAt}ms`);
        return { fullText, usedModel: model, toolsUsed };
      }
      const lastMatch = formatTeamMatchReply(parsed, params.language);
      if (lastMatch && prefetchTool === 'get_team_match') {
        fullText = lastMatch;
        params.onToken(lastMatch);
        logger.info(`[chat-agent] prefetch team-match ${Date.now() - startedAt}ms`);
        return { fullText, usedModel: model, toolsUsed };
      }
      if (parsed && !parsed.error && (parsed.status === 'ok' || parsed.source || parsed.quickFacts)) {
        lastToolPayloads = [payload];
        messages.push({
          role: 'assistant',
          content: null,
          tool_calls: [
            {
              id: `prefetch_${prefetchTool}`,
              type: 'function',
              function: {
                name: prefetchTool,
                arguments: JSON.stringify(args),
              },
            },
          ],
        });
        messages.push({
          role: 'tool',
          tool_call_id: `prefetch_${prefetchTool}`,
          content: payload,
        });
        const groundedFacts = extractGroundedFacts(lastToolPayloads);
        const groundingMsg = buildGroundingSystemMessage(groundedFacts);
        if (groundingMsg) {
          messages.push({ role: 'system', content: groundingMsg });
        }
        const groundedReply = buildGroundedFactReply(
          params.userMessage,
          groundedFacts,
          params.language,
        );
        if (groundedReply) {
          fullText = groundedReply;
          params.onToken(groundedReply);
          logger.info(`[chat-agent] prefetch grounded ${Date.now() - startedAt}ms`);
          return { fullText, usedModel: model, toolsUsed };
        }
        fullText = await streamFinalAnswer(
          client,
          model,
          messages,
          params.onToken,
          params.signal,
        );
        logger.info(
          `[chat-agent] prefetch+stream total=${Date.now() - startedAt}ms chars=${fullText.length}`,
        );
        if (fullText) return { fullText, usedModel: model, toolsUsed };
      }
    } catch (err) {
      logger.warn(
        `[chat-agent] prefetch failed, falling through to tool loop:`,
        (err as Error)?.message ?? err,
      );
    }
  }

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
        parallel_tool_calls: false,
        tool_choice:
          step === 0 && shouldRequireTools(params.userMessage) ? 'required' : 'auto',
        temperature: 0.2,
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
          const tTool = Date.now();
          const content = await executeAgentTool(name, fn.arguments, {
            language: params.language,
            userMessage: params.userMessage,
          });
          logger.info(`[chat-agent] tool ${name} ${Date.now() - tTool}ms`);
          return {
            role: 'tool' as const,
            tool_call_id: tc.id,
            content,
          };
        }),
      );
      lastToolPayloads = results.map((r) => r.content);
      messages.push(...results);

      // ─── Strict grounding ────────────────────────────────────────────────
      // The model fetches correct data but embellishes/contradicts it from
      // memory (invented WC years, wrong current club, "hasn't won" narratives).
      // Pin it to the tool numbers/club and, for high-risk single-fact
      // questions, answer deterministically so it can never contradict them.
      const groundedFacts = extractGroundedFacts(lastToolPayloads);
      const groundingMsg = buildGroundingSystemMessage(groundedFacts);
      if (groundingMsg) {
        messages.push({ role: 'system', content: groundingMsg });
      }

      const groundedReply = buildGroundedFactReply(
        params.userMessage,
        groundedFacts,
        params.language,
      );
      if (groundedReply) {
        fullText = groundedReply;
        params.onToken(groundedReply);
        return { fullText, usedModel: model, toolsUsed };
      }

      // After tools: stream the final answer so the user sees tokens immediately.
      if (step < MAX_STEPS - 1) {
        try {
          const answer = await streamFinalAnswer(
            client,
            model,
            messages,
            params.onToken,
            params.signal,
          );
          if (answer) {
            fullText = answer;
            logger.info(`[chat-agent] streamed final ${Date.now() - startedAt}ms`);
            return { fullText, usedModel: model, toolsUsed };
          }
          logger.warn('[chat-agent] streamed final answer empty — retrying loop');
        } catch (err) {
          logger.warn(
            '[chat-agent] streamed final failed, continuing loop:',
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
export { buildClient as createAgentOpenAIClient };
