/**
 * Strict grounding for the Captain AI tool-calling agent.
 *
 * The Qwen agent fetches correct football data but tends to EMBELLISH or
 * CONTRADICT it from memory — inventing World Cup years, wrong current clubs,
 * "hasn't won / too young" narratives, or extra tournament editions that are
 * not in the tool JSON. These helpers close that gap:
 *
 *   1. `extractGroundedFacts` — robustly parses the tool payloads (even when
 *      capped/truncated by jsonCap) into authoritative scalar facts.
 *   2. `buildGroundingSystemMessage` — an Arabic facts block injected right
 *      before the final answer that pins the model to those numbers/club.
 *   3. `buildGroundedFactReply` — a deterministic, tool-only reply for the
 *      high-risk single-fact questions (trophy counts / current club) so the
 *      LLM can never contradict or embellish the number.
 *
 * The tool numbers are treated as the single source of truth; these helpers
 * never invent or alter them (if worldCupTitles=1 the reply says 1).
 */
import type { MessageLanguage } from '../utils/message-language.util';

export interface PlayerFact {
  name: string | null;
  currentClub: string | null;
  worldCupTitles: number | null;
  championsLeagueTitles: number | null;
  latestSeasonLine: string | null;
}

export interface TeamFact {
  teamName: string | null;
  cafChampionsLeagueWins: number | null;
}

export interface GroundedFacts {
  players: PlayerFact[];
  teams: TeamFact[];
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function toStr(v: unknown): string | null {
  if (v == null) return null;
  const s = String(v).trim();
  return s.length ? s : null;
}

/**
 * Recover the key scalar facts from a (possibly truncated) JSON string.
 * quickFacts/club/name sit near the top of the payload, so they survive the
 * 9k-char cap even when the trailing arrays are dropped.
 */
function recoverFromString(raw: string): { player?: PlayerFact; team?: TeamFact } {
  const out: { player?: PlayerFact; team?: TeamFact } = {};

  const cafMatch = raw.match(/"cafChampionsLeagueWins":\s*(\d+)/);
  if (cafMatch) {
    out.team = {
      teamName: raw.match(/"teamName":\s*"([^"]+)"/)?.[1] ?? null,
      cafChampionsLeagueWins: Number(cafMatch[1]),
    };
  }

  if (/"currentClub"|365scores_profile|"worldCupTitles"/.test(raw)) {
    const wc = raw.match(/"worldCupTitles":\s*(\d+)/)?.[1];
    const ucl = raw.match(/"championsLeagueTitles":\s*(\d+)/)?.[1];
    out.player = {
      name: raw.match(/"name":\s*"([^"]+)"/)?.[1] ?? null,
      currentClub:
        raw.match(/"currentClub":\s*"([^"]+)"/)?.[1] ??
        raw.match(/"club":\s*"([^"]+)"/)?.[1] ??
        null,
      worldCupTitles: wc != null ? Number(wc) : null,
      championsLeagueTitles: ucl != null ? Number(ucl) : null,
      latestSeasonLine: raw.match(/"latestSeasonLine":\s*"([^"]+)"/)?.[1] ?? null,
    };
  }

  return out;
}

function playerFromObject(obj: any): PlayerFact {
  const qf = obj.quickFacts ?? {};
  return {
    name: toStr(obj.name ?? obj.resolvedAs),
    currentClub: toStr(obj.club ?? qf.currentClub),
    worldCupTitles: toNum(
      qf.worldCupTitles ?? obj.apiFootballWorldCup?.count ?? obj.fifaWorldCup?.[0]?.count,
    ),
    championsLeagueTitles: toNum(
      qf.championsLeagueTitles ?? obj.championsLeague?.[0]?.count,
    ),
    latestSeasonLine: toStr(qf.latestSeasonLine),
  };
}

/** Parse the raw tool result strings captured during the agent loop. */
export function extractGroundedFacts(payloads: string[]): GroundedFacts {
  const players: PlayerFact[] = [];
  const teams: TeamFact[] = [];

  for (const raw of payloads) {
    if (!raw) continue;

    let obj: any = null;
    try {
      obj = JSON.parse(raw);
    } catch {
      obj = null;
    }

    // Truncated payloads (jsonCap) or unparseable → regex recovery.
    if (!obj || typeof obj !== 'object' || obj.truncated || obj.error) {
      const source = obj?.truncated && typeof obj.preview === 'string' ? obj.preview : String(raw);
      const rec = recoverFromString(source);
      if (rec.player && hasPlayerSignal(rec.player)) players.push(rec.player);
      if (rec.team) teams.push(rec.team);
      continue;
    }

    if (obj.cafChampionsLeagueWins != null) {
      teams.push({
        teamName: toStr(obj.teamName),
        cafChampionsLeagueWins: toNum(obj.cafChampionsLeagueWins),
      });
    }

    const qf = obj.quickFacts;
    const looksLikePlayer =
      obj.source === '365scores_profile' ||
      qf?.currentClub != null ||
      qf?.worldCupTitles != null ||
      qf?.championsLeagueTitles != null ||
      obj.club != null;
    if (looksLikePlayer) {
      const p = playerFromObject(obj);
      if (hasPlayerSignal(p)) players.push(p);
    }
  }

  return { players, teams };
}

function hasPlayerSignal(p: PlayerFact): boolean {
  return (
    p.currentClub != null ||
    p.worldCupTitles != null ||
    p.championsLeagueTitles != null ||
    p.latestSeasonLine != null
  );
}

/**
 * Authoritative facts block injected as a system message before the final
 * answer. Pins the model to the tool numbers and forbids memory embellishment.
 */
export function buildGroundingSystemMessage(facts: GroundedFacts): string | null {
  const lines: string[] = [];

  for (const p of facts.players) {
    const parts: string[] = [];
    if (p.name) parts.push(`اللاعب: ${p.name}`);
    if (p.currentClub) parts.push(`النادي الحالي: ${p.currentClub}`);
    if (p.worldCupTitles != null) parts.push(`كاس العالم: ${p.worldCupTitles}`);
    if (p.championsLeagueTitles != null)
      parts.push(`دوري أبطال أوروبا: ${p.championsLeagueTitles}`);
    if (p.latestSeasonLine) parts.push(`آخر موسم: ${p.latestSeasonLine}`);
    if (parts.length) lines.push('• ' + parts.join(' | '));
  }

  for (const t of facts.teams) {
    const parts: string[] = [];
    if (t.teamName) parts.push(`الفريق: ${t.teamName}`);
    if (t.cafChampionsLeagueWins != null)
      parts.push(`دوري أبطال أفريقيا: ${t.cafChampionsLeagueWins}`);
    if (parts.length) lines.push('• ' + parts.join(' | '));
  }

  if (!lines.length) return null;

  return [
    '════ حقائق مؤكدة من بيانات التطبيق (365Scores) — دي المصدر الوحيد للأرقام والنادي ════',
    ...lines,
    '',
    'قواعد صارمة للإجابة النهائية (اتبعها حرفيًا وإلا الرد غلط):',
    '- استخدم الأرقام والنادي زي ما هي فوق بالظبط. لو العدد 1 قول 1، ولو 0 قول 0 — ممنوع تغيّر الرقم.',
    '- لو عدد البطولة أكبر من 0 يبقى اللاعب فاز بيها فعلًا — ممنوع تقول "لسه ماكسبش" أو "لسه صغير" أو تنفي البطولة.',
    '- لو العدد 0 قول إنه لسه ماكسبها من غير ما تخترع رقم.',
    '- ممنوع منعًا باتًا تضيف من ذاكرتك سنة بطولة، اسم منتخب، اسم نادي، أو اسم بطولة/نسخة مش موجودة في الحقائق فوق.',
    '- اذكر النادي الحالي للاعب زي ما هو فوق بالظبط، ومتقولش نادي تاني من ذاكرتك.',
    '- رد مختصر وواقعي زي ريل تايم، من غير سرد تاريخي أو تخمين.',
  ].join('\n');
}

const RE_AFRICA = /افريق|أفريق|africa|caf|كاف/i;
const RE_UCL = /شامبيونز|تشامبيونز|أبطال\s*أوروبا|ابطال\s*اوروبا|أبطال\s*اوروبا|ابطال\s*أوروبا|champions/i;
const RE_WC = /كاس\s*عالم|كأس\s*العالم|مونديال|world\s*cup/i;
const RE_CLUB =
  /(فين|اين|أين|وين)\s*(بيلعب|يلعب)|(بيلعب|يلعب)\s*(فين|اين|أين|وين)|نادي(ه)?\s*(الحالي|حالي)|ناديه|بيلعب\s*(دلوقتي|حاليا|حالياً)|where\b.*\bplay|which\s+club|plays?\s+for|current\s+club/i;
const RE_WANTS_DETAIL =
  /مسير|سيرة|تاريخ|احكي|إحكي|احكيلي|قصة|تفاصيل|بالتفصيل|تحليل|قارن|مقارن|اعرض\s*كل|كل\s*الألقاب|كل\s*البطولات|career|biography|history|tell me about|in detail/i;

/**
 * Deterministic, tool-only reply for the high-risk single-fact questions
 * (trophy counts / current club). Returns null for anything else so the LLM
 * (constrained by the grounding block) still handles nuanced questions.
 */
export function buildGroundedFactReply(
  message: string,
  facts: GroundedFacts,
  language: MessageLanguage,
): string | null {
  const q = message.trim();
  if (!q) return null;
  // Rich "tell me about his career" requests stay on the LLM path.
  if (RE_WANTS_DETAIL.test(q)) return null;

  const en = language === 'en';
  const isAfrica = RE_AFRICA.test(q);
  const isUcl = RE_UCL.test(q);
  const isWc = RE_WC.test(q);
  const isClub = RE_CLUB.test(q);

  // Team — CAF Champions League titles (e.g. Al Ahly).
  if (isAfrica) {
    const t = facts.teams.find((x) => x.cafChampionsLeagueWins != null);
    if (t?.cafChampionsLeagueWins != null) {
      const name = t.teamName ?? (en ? 'The team' : 'الفريق');
      return en
        ? `${name} has ${t.cafChampionsLeagueWins} CAF Champions League titles.`
        : `${name} معاه ${t.cafChampionsLeagueWins} لقب دوري أبطال أفريقيا.`;
    }
  }

  const p = facts.players.find(hasPlayerSignal);
  if (!p) return null;
  const name = p.name ?? (en ? 'The player' : 'اللاعب');
  const clubTail = p.currentClub
    ? en
      ? ` (currently at ${p.currentClub})`
      : ` (بيلعب دلوقتي مع ${p.currentClub})`
    : '';

  // Champions League count — name the current club too (Hakimi → PSG).
  if (isUcl && !isAfrica && p.championsLeagueTitles != null) {
    const n = p.championsLeagueTitles;
    if (en) {
      return n === 0
        ? `${name} hasn't won the Champions League yet${clubTail}.`
        : `${name} has ${n} Champions League title${n === 1 ? '' : 's'}${clubTail}.`;
    }
    return n === 0
      ? `${name} لسه ماكسبش دوري أبطال أوروبا${clubTail}.`
      : `${name} معاه ${n} دوري أبطال أوروبا${clubTail}.`;
  }

  // World Cup count / yes-no (Yamal, Messi).
  if (isWc && p.worldCupTitles != null) {
    const n = p.worldCupTitles;
    if (en) {
      return n === 0
        ? `${name} hasn't won a World Cup (per available data).`
        : `${name} has ${n} World Cup title${n === 1 ? '' : 's'}.`;
    }
    return n === 0
      ? `${name} لسه معندوش كاس عالم (حسب البيانات المتاحة).`
      : n === 1
        ? `${name} معاه كاس عالم واحد.`
        : `${name} معاه ${n} كاس عالم.`;
  }

  // Current club (Dembele → PSG).
  if (isClub && p.currentClub) {
    return en
      ? `${name} currently plays for ${p.currentClub}.`
      : `${name} بيلعب دلوقتي مع ${p.currentClub}.`;
  }

  return null;
}
