/**
 * Known retired legends — poor API-Football player photo coverage.
 * Used for guess_player validation and image fallback decisions.
 */

function normalizeLegendKey(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Substrings / full names that indicate retired legends (image guess_player should avoid). */
const LEGEND_NAME_FRAGMENTS: readonly string[] = [
  'paolo maldini',
  'maldini',
  'zinedine zidane',
  'zidane',
  'ronaldo nazario',
  'ronaldinho',
  'diego maradona',
  'maradona',
  'pele',
  'johan cruyff',
  'cruyff',
  'franz beckenbauer',
  'david beckham',
  'beckham',
  'thierry henry',
  'andrea pirlo',
  'pirlo',
  'xavi',
  'iniesta',
  'buffon',
  'totti',
  'gerrard',
  'lampard',
  'kaka',
  'figo',
  'rivaldo',
  'cafu',
  'roberto carlos',
  'van basten',
  'gullit',
  'matthaus',
  'platini',
  'eusebio',
  'george best',
  'bobby charlton',
  'garrincha',
];

export function isRetiredLegendPlayerName(entityName: string): boolean {
  const key = normalizeLegendKey(entityName);
  if (!key) return false;
  return LEGEND_NAME_FRAGMENTS.some((fragment) => {
    if (key === fragment) return true;
    if (fragment.length >= 4 && key.includes(fragment)) return true;
    if (key.length >= 4 && fragment.includes(key)) return true;
    return false;
  });
}

export function isImageDependentQuestionText(question: string): boolean {
  return /who is this|what is this|identify this|name this|which player is shown|which team is shown|من هذا|من اللاعب|من في الصورة|تعرف هذا/i.test(
    question,
  );
}
