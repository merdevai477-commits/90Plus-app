/** Shared name normalization and fuzzy matching for quiz validation and image lookup. */

export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\u0600-\u06FF]/g, '');
}

function editDistance(s1: string, s2: string): number {
  const a = s1.toLowerCase();
  const b = s2.toLowerCase();
  const costs: number[] = [];

  for (let i = 0; i <= a.length; i += 1) {
    let lastValue = i;
    for (let j = 0; j <= b.length; j += 1) {
      if (i === 0) {
        costs[j] = j;
      } else if (j > 0) {
        let newValue = costs[j - 1];
        if (a.charAt(i - 1) !== b.charAt(j - 1)) {
          newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
        }
        costs[j - 1] = lastValue;
        lastValue = newValue;
      }
    }
    if (i > 0) costs[b.length] = lastValue;
  }

  return costs[b.length] ?? 0;
}

export function getSimilarity(s1: string, s2: string): number {
  let longer = s1;
  let shorter = s2;
  if (s1.length < s2.length) {
    longer = s2;
    shorter = s1;
  }
  if (longer.length === 0) return 1;
  return (longer.length - editDistance(longer, shorter)) / longer.length;
}

export function scoreEntityNameMatch(entityName: string, candidateText: string): number {
  const target = normalizeName(entityName);
  const candidate = normalizeName(candidateText);
  if (!target || !candidate) return 0;
  if (target === candidate) return 1;

  let maxScore = getSimilarity(target, candidate);

  const entityTokens = entityName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const entityLast = normalizeName(entityTokens[entityTokens.length - 1] ?? '');
  if (entityLast.length >= 4) {
    if (candidate.endsWith(entityLast) || candidate.includes(entityLast)) {
      maxScore = Math.max(maxScore, 0.92);
    }
  }

  return maxScore;
}

export function scorePlayerMatch(
  entityName: string,
  targetNames: string[],
  player: { name?: string; firstname?: string; lastname?: string },
): number {
  const candidates = new Set<string>();
  if (player.name) candidates.add(player.name);
  if (player.firstname && player.lastname) {
    candidates.add(`${player.firstname} ${player.lastname}`);
    candidates.add(player.lastname);
  }

  let maxScore = 0;
  for (const candidate of candidates) {
    const normalizedCandidate = normalizeName(candidate);
    for (const tName of targetNames) {
      if (normalizedCandidate === tName) return 1;
      maxScore = Math.max(maxScore, getSimilarity(tName, normalizedCandidate));
    }
  }

  const entityTokens = entityName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .split(/\s+/)
    .filter(Boolean);
  const entityLast = normalizeName(entityTokens[entityTokens.length - 1] ?? '');
  if (entityLast.length >= 4) {
    if (player.lastname && normalizeName(player.lastname) === entityLast) {
      maxScore = Math.max(maxScore, 0.96);
    }
    for (const candidate of candidates) {
      const normalizedCandidate = normalizeName(candidate);
      if (normalizedCandidate.endsWith(entityLast) || normalizedCandidate.includes(entityLast)) {
        maxScore = Math.max(maxScore, 0.92);
      }
    }
  }

  return maxScore;
}
