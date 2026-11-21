/**
 * Broad football highlight coverage: include every finished men's senior match
 * we can usefully attach clips to. Only exclude women, youth, and non-football.
 */

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
const NON_FOOTBALL =
  /\bncaab\b|\bnba\b|\bnhl\b|\bnfl\b|\bmlb\b|basketball|cricket|tennis|handball|volleyball|hockey|baseball|rugby|american football/;

/**
 * Maximize clip intake: any football fixture that is not women/youth/non-football.
 * League id / Big 5 / tracked clubs are no longer required for coverage.
 */
export function isHighlightCoverageFixture(fixture: HighlightCoverageFixture): boolean {
  const league = foldText(fixture.leagueName);
  const home = foldText(fixture.homeTeamName);
  const away = foldText(fixture.awayTeamName);
  const teams = `${home} ${away}`;
  if (WOMEN.test(league) || WOMEN.test(teams)) return false;
  if (YOUTH.test(league) || YOUTH.test(teams)) return false;
  if (NON_FOOTBALL.test(league)) return false;
  return true;
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
