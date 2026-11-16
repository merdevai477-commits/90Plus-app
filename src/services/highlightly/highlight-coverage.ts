import { normalizeTeamNameKey } from '../../utils/team-name-match.util';

export interface HighlightCoverageFixture {
  leagueName?: string | null;
  leagueCountry?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
}

const WOMEN =
  /women|woman|femenin|feminin|frauen|dames|ladies|\bnwsl\b|\bwsl\b|سيدات|نسائ|للسيدات/;
const YOUTH = /\bu-?\d{2}\b|\byouth\b|\bjunior|\breserves?\b|primavera|ناشئ|شباب|رديف/;
const FRIENDLY = /friendly|friendlies|ودي|وديات/;

/**
 * Men's competitions we follow in full.
 * Domestic cups and friendlies stay out unless a tracked club is playing.
 */
const FULL_COMPETITIONS: RegExp[] = [
  /uefa champions league|دوري ابطال اوروب/,
  /europa league|conference league|دوري المؤتمر|الدوري الاوروب/,
  /caf champions|african champions|دوري ابطال افريق/,
  /caf confederation|confederation cup|كونفدرال/,
  /libertadores|ليبرتادور/,
  /sudamericana|سودامريكان/,
  /concacaf champions/,
  /uefa euro|european championship|بطوله امم اوروب|كأس امم اوروب/,
  /nations league|دوري الامم الاوروب/,
  /africa cup of nations|african cup of nations|\bafcon\b|امم افريقيا/,
  /copa america|كوبا امريكا/,
  /club world cup|كأس العالم للانديه|كاس العالم للانديه/,
  /fifa world cup|كأس العالم|كاس العالم/,
  /uefa.*qualif|european qualif|تصفيات اوروب/,
];

/**
 * Clubs followed outside the big five. Domestic and cup matches count.
 * North Africa: Wydad and Espérance. Arab world: Al Hilal and Al Nassr.
 */
const TRACKED_CLUBS: string[][] = [
  ['alahly', 'الاهلي'],
  ['zamalek', 'الزمالك'],
  ['pyramids', 'بيراميدز'],
  ['wydad', 'الوداد'],
  ['esperance', 'الترجي'],
  ['alhilal', 'الهلال'],
  ['alnassr', 'النصر'],
  ['flamengo', 'cr flamengo'],
  ['palmeiras', 'se palmeiras'],
  ['river plate', 'ca river plate'],
  ['boca juniors', 'ca boca juniors'],
  ['club america', 'cf america'],
  ['chivas', 'cd guadalajara'],
  ['tigres', 'tigres uanl'],
  ['cf monterrey', 'club de monterrey'],
  ['inter miami'],
];

export function isHighlightCoverageFixture(fixture: HighlightCoverageFixture): boolean {
  const league = foldText(fixture.leagueName);
  const country = foldText(fixture.leagueCountry);
  const home = fixture.homeTeamName ?? '';
  const away = fixture.awayTeamName ?? '';
  if (isExcludedMatch(league, home, away)) return false;
  if (isBig5League(league, country)) return true;
  if (isEuropeanClubChampions(league)) return true;
  if (FULL_COMPETITIONS.some((pattern) => pattern.test(league))) return true;
  if (!league || FRIENDLY.test(league)) return false;
  return isTrackedClub(home) || isTrackedClub(away);
}

function isExcludedMatch(league: string, home: string, away: string): boolean {
  const teams = `${foldText(home)} ${foldText(away)}`;
  return WOMEN.test(league) || WOMEN.test(teams) || YOUTH.test(league) || YOUTH.test(teams);
}

function isEuropeanClubChampions(league: string): boolean {
  if (!/champions league/.test(league)) return false;
  return !/caf|afc|concacaf|africa|افريق|اسيا|arab/.test(league);
}

function isBig5League(league: string, country: string): boolean {
  if (/egypt|مصر|ghana|scotland|russia|ukraine|israel/.test(league)) return false;
  if (/egypt|مصر/.test(country)) return false;
  if (/\b2\b|ligue 2|serie b|segunda|championship/.test(league)) return false;

  if (/^premier league$/.test(league)) return country === '' || /england|انجليز/.test(country);
  if (/^(la ?liga|laliga)$/.test(league)) return country === '' || /spain|اسبان/.test(country);
  if (/^serie a$/.test(league)) return /italy|ايطال/.test(country);
  if (/^bundesliga$/.test(league)) return country === '' || /germany|المان/.test(country);
  if (/^ligue 1$/.test(league)) return /france|فرنس/.test(country) || country === '';
  if (/الدوري الانجليزي|البريميرليج/.test(league) && !/مصر|egypt/.test(league)) return true;
  if (/الدوري الاسباني/.test(league)) return true;
  if (/الدوري الايطالي/.test(league)) return true;
  if (/الدوري الالماني/.test(league)) return true;
  if (/الدوري الفرنسي/.test(league)) return true;
  return false;
}

function isTrackedClub(name: string): boolean {
  const key = simplifyClub(name);
  if (!key || key.length < 4) return false;
  return TRACKED_CLUBS.some((aliases) => aliases.some((alias) => simplifyClub(alias) === key));
}

function simplifyClub(name: string): string {
  let value = foldText(name);
  const trailing =
    /(?:\s|-)(?:المصري|السعودي|sportive|sporting|casablanca|tunis|uanl|saf|sfc|sc|fc|cf|ac|de)$/;
  const leading = /^(?:cr|ca|cd|cf|fc|se|ec|club|de)(?:\s|-)/;
  for (let i = 0; i < 6; i += 1) {
    const next = value.replace(trailing, '').replace(leading, '').trim();
    if (next.length < 4 || next === value) break;
    value = next;
  }
  return normalizeTeamNameKey(value);
}

function foldText(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[أإآٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}
