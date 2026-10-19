/**
 * Shared club-name comparison for 365 ↔ DB alignment.
 * Exact match after normalize, plus trailing SC/FC / المصري noise.
 * Never uses substring includes — that mixed Al Ahly with National Bank.
 */

export function normalizeTeamNameKey(value?: string | null): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]/gu, '');
}

export function teamNamesLooselyMatch(a?: string | null, b?: string | null): boolean {
  const na = normalizeTeamNameKey(a);
  const nb = normalizeTeamNameKey(b);
  if (!na || !nb) return false;
  if (na === nb) return true;

  const stripTrailingClubNoise = (value: string): string =>
    value
      .replace(/(المصري|السعودي|الاماراتي|الإماراتي)$/u, '')
      .replace(/(sc|fc|cf|ac|afc|cfc)$/i, '');

  const sa = stripTrailingClubNoise(na);
  const sb = stripTrailingClubNoise(nb);
  return sa.length >= 3 && sb.length >= 3 && sa === sb;
}
