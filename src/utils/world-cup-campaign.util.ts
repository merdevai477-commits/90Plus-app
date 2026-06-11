import { getWorldCupTabState } from '../services/app-features.service';
import type { MessageLanguage } from './message-language.util';

export interface WorldCupCampaignConfig {
  active: boolean;
  leagueId: number;
  season: number;
}

export function getWorldCupCampaignConfig(nowMs: number = Date.now()): WorldCupCampaignConfig {
  const wc = getWorldCupTabState(nowMs);
  return {
    active: wc.campaignMode,
    leagueId: wc.leagueId,
    season: wc.season,
  };
}

/** Strict scope rule — Captain AI must not discuss non-WC football during campaign. */
export function buildWorldCupCampaignLockPrompt(language: MessageLanguage): string {
  if (language === 'ar') {
    return [
      'قاعدة كأس العالم 2026 (صارمة — أولوية قصوى)',
      '',
      'التطبيق في وضع حملة كأس العالم. أي سؤال عن مباريات، نتائج، أخبار، أو إحصائيات (اليوم أو غيره) يجب أن يقتصر على كأس العالم 2026 فقط.',
      'لا تذكر الدوريات المحلية، دوري الأبطال، أو أي مسابقات أخرى.',
      'إذا سأل المستخدم عن "مباريات اليوم" أو "إحصائيات اليوم" أو "أخبار اليوم" → أجب فقط عن مباريات/نتائج/إحصائيات كأس العالم 2026.',
      'إذا لم تتوفر بيانات كأس العالم في السياق → قل بوضوح أنه لا توجد مباريات كأس العالم ذات صلة الآن، ولا تخترع نتائج من مسابقات أخرى.',
      'لا تستخدم معرفتك العامة عن مباريات خارج كأس العالم في هذه الفترة.',
    ].join('\n');
  }

  return [
    'WORLD CUP 2026 CAMPAIGN RULE (STRICT — highest priority)',
    '',
    'The app is in World Cup campaign mode. Any question about matches, results, news, or statistics (today or otherwise) must cover ONLY FIFA World Cup 2026.',
    'Do NOT mention domestic leagues, UEFA Champions League, or any other competitions.',
    'If the user asks for "today\'s matches", "today\'s stats", or "today\'s news" → answer ONLY with World Cup 2026 fixtures/results/stats.',
    'If no World Cup data is available in context → say clearly there are no relevant World Cup matches right now; never invent scores from other competitions.',
    'Do not use general knowledge about non-World-Cup football during this campaign period.',
  ].join('\n');
}

export function formatFixturesForChatContext(
  fixtures: any[],
  heading: string,
): string | null {
  if (!Array.isArray(fixtures) || fixtures.length === 0) return null;

  const rows = fixtures.slice(0, 25).map((f: any) => {
    const home = f.teams?.home?.name ?? '—';
    const away = f.teams?.away?.name ?? '—';
    const gh = f.goals?.home ?? '-';
    const ga = f.goals?.away ?? '-';
    const status = f.fixture?.status?.short ?? '';
    const elapsed = f.fixture?.status?.elapsed;
    const date = f.fixture?.date ? String(f.fixture.date).slice(11, 16) : '';
    const minute =
      status === 'NS' || status === 'TBD'
        ? date || 'scheduled'
        : elapsed != null
          ? `${elapsed}'`
          : status || 'LIVE';
    return `${home} ${gh}-${ga} ${away} (${minute})`;
  });

  return `${heading} (${rows.length}):\n${rows.join('\n')}`;
}

export function filterFixturesByLeague(fixtures: any[], leagueId: number): any[] {
  return (fixtures ?? []).filter((f) => f?.league?.id === leagueId);
}

export function localDateKey(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
