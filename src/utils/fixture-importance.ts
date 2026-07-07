/**
 * Ranks fixtures by perceived importance (league tier, live status, knockout round).
 * Shared by chat highlights and prediction group daily rounds.
 */

const HIGHLIGHT_LEAGUE_SCORE: Record<number, number> = {
  2: 100,
  3: 98,
  848: 97,
  39: 95,
  140: 94,
  135: 93,
  78: 92,
  61: 91,
  233: 88,
  307: 85,
  203: 84,
  4: 69,
};

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT']);

export function scoreFixtureImportance(fixture: any): number {
  const leagueId = fixture?.league?.id ?? 0;
  let score = HIGHLIGHT_LEAGUE_SCORE[leagueId] ?? 8;
  const leagueName = String(fixture?.league?.name ?? '').toLowerCase();

  if (/world\s*cup|كأس\s*العالم/i.test(leagueName)) score += 98;
  else if (/champions\s*league|دوري\s*الأبطال|ابطال\s*اوروبا/i.test(leagueName)) score += 95;
  else if (/europa\s*league|الدوري\s*الأوروبي/i.test(leagueName)) score += 82;
  else if (/premier\s*league|بريمير/i.test(leagueName)) score += 90;
  else if (/la\s*liga|الدوري\s*الإسباني|الاسباني/i.test(leagueName)) score += 88;
  else if (/serie\s*a|الدوري\s*الإيطالي/i.test(leagueName)) score += 87;
  else if (/bundesliga|الدوري\s*الألماني/i.test(leagueName)) score += 86;
  else if (/ligue\s*1|الدوري\s*الفرنسي/i.test(leagueName)) score += 85;
  else if (/egypt|مصر/i.test(leagueName)) score += 83;
  else if (/saudi|سعود/i.test(leagueName)) score += 78;

  const status = fixture?.fixture?.status?.short ?? '';
  if (LIVE_STATUSES.has(status)) score += 65;
  if (status === 'FT' || status === 'AET' || status === 'PEN') score += 18;

  const round = String(fixture?.league?.round ?? '');
  if (/final|نهائي/i.test(round)) score += 40;
  if (/semi|نصف/i.test(round)) score += 28;

  return score;
}

export function pickTopFixtures(fixtures: any[], limit = 10): any[] {
  const upcoming = fixtures.filter((f) => {
    const status = f?.fixture?.status?.short ?? '';
    return status === 'NS' || status === 'TBD' || status === '';
  });

  return [...upcoming]
    .map((f) => ({ f, score: scoreFixtureImportance(f) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => r.f);
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
