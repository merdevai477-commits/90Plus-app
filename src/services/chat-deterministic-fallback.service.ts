/**
 * Deterministic football answers from tools when the LLM path is down
 * (missing keys, OpenRouter 402, Gemini failure, etc.).
 */
import type { MessageLanguage } from '../utils/message-language.util';
import { executeAgentTool } from './chat-agent-tools.service';

function pickPlayerName(msg: string): string | null {
  const m =
    msg.match(
      /(حكيمي|يامال|ميسي|صلاح|محمد صلاح|رونالدو|مبابي|هالاند|ديمبيلي|ديبوريم|ديمبوريم|نيمار|بنزيما)/i,
    ) ?? null;
  return m?.[1]?.trim() ?? null;
}

function formatPlayerCareer(data: any, q: string): string | null {
  if (!data || data.error) return null;
  const name = data.name ?? data.resolvedAs ?? 'اللاعب';
  const club = data.club ? ` وبينادي ${data.club}` : '';

  if (/شامبيونز|ابطال اوروبا|أبطال أوروبا|champions/i.test(q)) {
    const n = data.championsLeague?.[0]?.count ?? data.championsLeague?.length ?? null;
    if (n != null && Number(n) >= 0) return `${name} معاه ${n} شامبيونز ليج.`;
  }
  if (/كاس عالم|كأس العالم|world\s*cup/i.test(q)) {
    const n =
      data.apiFootballWorldCup?.count ??
      data.fifaWorldCup?.[0]?.count ??
      (Array.isArray(data.fifaWorldCup) ? data.fifaWorldCup.reduce((s: number, t: any) => s + (t.count ?? 0), 0) : null);
    if (n != null) {
      if (Number(n) === 0) return `${name} معندوش كاس عالم لحد دلوقتي (حسب البيانات المتاحة).`;
      return `${name} معاه ${n} كاس عالم.`;
    }
  }
  if (/سيزون|موسم|احصائ|إحصائ|بيانات/i.test(q)) {
    const s = data.seasonStats;
    if (s) {
      return `${name} في آخر موسم (${s.label ?? '—'}): ${s.goals ?? 0} هدف و${s.assists ?? 0} صناعة في ${s.appearances ?? '—'} مباراة${club}.`;
    }
  }
  if (/يلعب|نادي|فين|أين|اين|حاليا|حالياً/i.test(q) && club) {
    return `${name} بيلعب دلوقتي مع ${data.club}.`;
  }
  return null;
}

function formatSearchPlayer(data: any, q: string): string | null {
  if (!data || data.error) return null;
  if (data.truncated && typeof data.preview === 'string') {
    // preview may be cut mid-JSON — recover key season fields by regex
    const goals = data.preview.match(/"goals":(\d+)/);
    const assists = data.preview.match(/"assists":(\d+)/);
    const apps = data.preview.match(/"appearances":(\d+)/);
    const label = data.preview.match(/"label":"([^"]+)"/);
    const name = data.preview.match(/"name":"([^"]+)"/);
    const club = data.preview.match(/"club":"([^"]+)"/);
    if (goals || assists) {
      return `${name?.[1] ?? 'محمد صلاح'} في آخر موسم (${label?.[1] ?? '—'}): ${goals?.[1] ?? 0} هدف و${assists?.[1] ?? 0} صناعة في ${apps?.[1] ?? '—'} مباراة${club?.[1] ? ` مع ${club[1]}` : ''}.`;
    }
    try {
      return formatSearchPlayer(JSON.parse(data.preview), q);
    } catch {
      /* ignore */
    }
  }
  return formatPlayerCareer(data, q);
}

function formatTeam(data: any): string | null {
  if (!data || data.error) return null;
  if (data.cafChampionsLeagueWins != null) {
    return `الأهلي معاه ${data.cafChampionsLeagueWins} لقب دوري أبطال أفريقيا.`;
  }
  return null;
}

function formatToday(data: any): string | null {
  if (!data) return null;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  if (!matches.length) {
    return data.note ?? 'مفيش مباريات مطابقة للدوري ده النهاردة.';
  }
  const lines = matches.slice(0, 6).map((m: any, i: number) => {
    const score =
      m.score?.home != null && m.score?.away != null
        ? `${m.score.home}-${m.score.away}`
        : 'لسه';
    const live = m.minute != null ? ` (دقيقة ${m.minute}, ${m.status})` : ` (${m.status})`;
    return `${i + 1}) ${m.home} ضد ${m.away}: ${score}${live}`;
  });
  return `مباريات النهاردة:\n${lines.join('\n')}`;
}

function formatLive(data: any): string | null {
  if (!data) return null;
  const matches = Array.isArray(data.matches) ? data.matches : [];
  const live = matches.filter((m: any) =>
    ['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT'].includes(String(m.status ?? '')),
  );
  if (!live.length) return 'مفيش ماتش لايف مهم دلوقتي.';
  const lines = live.slice(0, 5).map((m: any) => {
    const score =
      m.score?.home != null && m.score?.away != null
        ? `${m.score.home}-${m.score.away}`
        : '?-?';
    return `• ${m.home} ضد ${m.away}: ${score} — دقيقة ${m.minute ?? '—'} (${m.league ?? ''})`;
  });
  return `فيه ماتشات لايف دلوقتي:\n${lines.join('\n')}`;
}

/**
 * Best-effort Arabic/English reply built only from tool JSON.
 * Returns null when the question isn't covered or tools fail.
 */
export async function tryDeterministicFootballReply(
  message: string,
  language: MessageLanguage,
): Promise<{ text: string; toolsUsed: string[] } | null> {
  const q = message.trim();
  if (q.length < 3) return null;
  const toolsUsed: string[] = [];
  const lang = language === 'en' ? 'en' : 'ar';

  const run = async (name: string, args: Record<string, unknown>) => {
    toolsUsed.push(name);
    const raw = await executeAgentTool(name, JSON.stringify(args), { language: lang as any });
    try {
      return JSON.parse(raw);
    } catch {
      return { error: 'bad_json', raw };
    }
  };

  try {
    if (/لايف|مباشر|live|دلوقتي.*ماتش|ماتش.*دلوقتي/i.test(q)) {
      const data = await run('get_live_matches', {});
      const text = formatLive(data);
      if (text) return { text, toolsUsed };
    }

    if (/بوليفي|bolivia/i.test(q) && /مبار|ماتش|اليوم|النهاردة|today/i.test(q)) {
      const data = await run('get_today_matches', { league: 'الدوري البوليفي' });
      const text = formatToday(data);
      if (text) return { text, toolsUsed };
    }

    if (/اهلي|أهلي|ahly/i.test(q) && /افريق|أفريق|africa|caf/i.test(q)) {
      const data = await run('get_team_info', { team_name: 'الأهلي' });
      const text = formatTeam(data);
      if (text) return { text, toolsUsed };
    }

    const player = pickPlayerName(q);
    if (player) {
      if (/سيزون|موسم|احصائ|إحصائ|بيانات|يلعب|نادي|فين|أين|اين|حاليا/i.test(q)) {
        const data = await run('search_player', { player_name: player });
        const text = formatSearchPlayer(data, q);
        if (text) return { text, toolsUsed };
      }
      const data = await run('get_player_career', { player_name: player });
      const text = formatPlayerCareer(data, q);
      if (text) return { text, toolsUsed };
    }
  } catch {
    return null;
  }

  return null;
}
