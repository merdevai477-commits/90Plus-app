/**
 * Ranks fixtures by perceived importance (league tier, live status, knockout round).
 * Shared by chat highlights and prediction group daily rounds.
 */

/** API-Football league ids treated as high-detail / warm priority. */
export const MAJOR_LEAGUE_IDS = new Set<number>([
  1, // World Cup
  2, // UCL
  3, // UEL
  4, // Euro
  5, // Nations League
  6, // AFCON
  9, // Copa America
  12, // CAF CL
  13, // CAF Confed
  15, // FIFA Club World Cup
  39, // Premier League
  40, // Championship
  45, // FA Cup
  61, // Ligue 1
  78, // Bundesliga
  88, // Eredivisie
  94, // Primeira Liga
  135, // Serie A
  140, // La Liga
  143, // Copa del Rey
  200, // Botola
  203, // Super Lig
  233, // Egyptian Premier
  253, // MLS
  307, // Saudi Pro League
  383, // Israel Premier
  848, // Conference League
]);

export function isMajorLeagueId(leagueId: number | null | undefined): boolean {
  return leagueId != null && MAJOR_LEAGUE_IDS.has(leagueId);
}

const HIGHLIGHT_LEAGUE_SCORE: Record<number, number> = {
  1: 110,
  2: 100,
  3: 98,
  4: 105,
  5: 90,
  9: 96,
  15: 99,
  848: 97,
  39: 95,
  140: 94,
  135: 93,
  78: 92,
  61: 91,
  233: 88,
  307: 85,
  203: 84,
  88: 80,
  94: 79,
  253: 78,
  40: 72,
  45: 86,
  143: 86,
};

const LIVE_STATUSES = new Set(['1H', '2H', 'HT', 'ET', 'P', 'LIVE', 'BT', 'INT', 'SUSP']);
const UPCOMING_STATUSES = new Set(['NS', 'TBD', '']);

export function scoreFixtureImportance(fixture: any): number {
  const leagueId = fixture?.league?.id ?? 0;
  let score = HIGHLIGHT_LEAGUE_SCORE[leagueId] ?? 8;
  const leagueName = String(fixture?.league?.name ?? '').toLowerCase();

  if (/world\s*cup|كأس\s*العالم/i.test(leagueName)) score += 98;
  else if (/champions\s*league|دوري\s*الأبطال|ابطال\s*اوروبا/i.test(leagueName)) score += 95;
  else if (/europa\s*league|الدوري\s*الأوروبي/i.test(leagueName)) score += 82;
  else if (/conference\s*league/i.test(leagueName)) score += 78;
  else if (/premier\s*league|بريمير/i.test(leagueName)) score += 90;
  else if (/la\s*liga|الدوري\s*الإسباني|الاسباني/i.test(leagueName)) score += 88;
  else if (/serie\s*a|الدوري\s*الإيطالي/i.test(leagueName)) score += 87;
  else if (/bundesliga|الدوري\s*الألماني/i.test(leagueName)) score += 86;
  else if (/ligue\s*1|الدوري\s*الفرنسي/i.test(leagueName)) score += 85;
  else if (/egypt|مصر/i.test(leagueName)) score += 83;
  else if (/saudi|سعود/i.test(leagueName)) score += 78;
  else if (/eredivisie|هولند/i.test(leagueName)) score += 70;
  else if (/mls|major\s*league\s*soccer/i.test(leagueName)) score += 68;

  if (isMajorLeagueId(leagueId)) score += 25;

  const status = fixture?.fixture?.status?.short ?? '';
  if (LIVE_STATUSES.has(status)) score += 65;
  if (status === 'FT' || status === 'AET' || status === 'PEN') score += 18;

  const round = String(fixture?.league?.round ?? '');
  if (/final|نهائي/i.test(round)) score += 40;
  if (/semi|نصف/i.test(round)) score += 28;
  if (/quarter|ربع/i.test(round)) score += 18;

  return score;
}

function kickoffMs(fixture: any): number {
  const raw = fixture?.fixture?.date ?? fixture?.fixture?.timestamp;
  if (typeof raw === 'number') return raw * (raw < 1e12 ? 1000 : 1);
  if (typeof raw === 'string') {
    const t = Date.parse(raw);
    return Number.isFinite(t) ? t : Number.MAX_SAFE_INTEGER;
  }
  return Number.MAX_SAFE_INTEGER;
}

/**
 * Top upcoming fixtures for prediction-group daily rounds.
 * Prefers major-league kickoffs; fills with next-best only if needed.
 */
export function pickTopFixtures(fixtures: any[], limit = 10): any[] {
  const upcoming = fixtures.filter((f) => {
    const status = f?.fixture?.status?.short ?? '';
    return UPCOMING_STATUSES.has(status);
  });

  const ranked = upcoming
    .map((f) => ({
      f,
      score: scoreFixtureImportance(f),
      major: isMajorLeagueId(f?.league?.id),
      kickoff: kickoffMs(f),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.kickoff - b.kickoff;
    });

  const majors = ranked.filter((r) => r.major || r.score >= 70);
  const pool = majors.length >= Math.min(3, limit) ? majors : ranked;

  return pool.slice(0, limit).map((r) => r.f);
}

export function localDateKey(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
