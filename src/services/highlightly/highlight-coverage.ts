import { isBig5LeagueId } from '../../utils/fixture-importance';
import { normalizeTeamNameKey } from '../../utils/team-name-match.util';

export interface HighlightCoverageFixture {
  leagueId?: number | null;
  leagueName?: string | null;
  leagueCountry?: string | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
}

const WOMEN =
  /women|woman|femenin|feminin|frauen|dames|ladies|\bnwsl\b|\bwsl\b|سيدات|نسائ|للسيدات/;
const YOUTH =
  /\bu-?\d{2}\b|\byouth\b|\bjunior|\breserves?\b|primavera|ناشئ|شباب|رديف|تحت\s*\d{1,2}/;
const FRIENDLY = /friendly|friendlies|ودي|وديات/;
/** Second / third tiers that must never count as Big 5. */
const LOWER_DIVISION =
  /\b2\b|2\.|ligue 2|serie b|segunda|championship|درجة ثاني|درجه ثاني|الدرجة الثاني|الدرجه الثاني|درجة ثالث|درجه ثالث|الدرجة الثالث|الدرجه الثالث|relegation|promotion play/;

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
  if (isBig5LeagueId(fixture.leagueId)) {
    // Keep youth/women out even when the numeric id is Big 5 (playoffs edge cases).
    if (!LOWER_DIVISION.test(league)) return true;
  }
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

/** "Germany, Bundesliga" / "Spain, LaLiga" → core token after the comma. */
function leagueNameCore(league: string): string {
  const comma = league.indexOf(',');
  if (comma <= 0) return league;
  return league.slice(comma + 1).trim();
}

function isBig5League(league: string, country: string): boolean {
  if (/egypt|مصر|ghana|scotland|russia|ukraine|israel/.test(league)) return false;
  if (/egypt|مصر/.test(country)) return false;
  if (LOWER_DIVISION.test(league)) return false;

  const core = leagueNameCore(league);
  const names = core === league ? [league] : [league, core];

  for (const name of names) {
    if (/^premier league$/.test(name)) return country === '' || /england|انجليز/.test(country);
    if (/^(la ?liga|laliga)$/.test(name)) return country === '' || /spain|اسبان/.test(country);
    if (/^serie a$/.test(name)) return /italy|ايطال/.test(country);
    if (/^bundesliga$/.test(name)) return country === '' || /germany|المان/.test(country);
    if (/^ligue 1$/.test(name)) return /france|فرنس/.test(country) || country === '';
  }

  if (/الدوري الانجليزي|البريميرليج/.test(league) && !/مصر|egypt/.test(league)) return true;
  // Arabic Big 5: require the domestic label and reject lower divisions (handled above).
  if (/الدوري الاسباني/.test(league) && !LOWER_DIVISION.test(league)) return true;
  if (/الدوري الايطالي/.test(league) && !LOWER_DIVISION.test(league)) return true;
  if (/الدوري الالماني/.test(league) && !LOWER_DIVISION.test(league)) return true;
  if (/الدوري الفرنسي/.test(league) && !LOWER_DIVISION.test(league)) return true;
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
