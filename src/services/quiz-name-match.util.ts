/** Shared name normalization and fuzzy matching for quiz validation and image lookup. */

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/;
const LATIN_LETTER_RE = /[a-zA-Z]/;

/** Arabic → Latin phonetic map for cross-script football name matching. */
const ARABIC_TO_LATIN: Record<string, string> = {
  ا: 'a', أ: 'a', إ: 'e', آ: 'a',
  ب: 'b', ت: 't', ث: 'th',
  ج: 'j', ح: 'h', خ: 'kh',
  د: 'd', ذ: 'th', ر: 'r', ز: 'z',
  س: 's', ش: 'sh', ص: 's', ض: 'd',
  ط: 't', ظ: 'z', ع: 'a', غ: 'gh',
  ف: 'f', ق: 'q', ك: 'k', ل: 'l',
  م: 'm', ن: 'n', ه: 'h', و: 'w',
  ي: 'y', ى: 'a', ة: 'h', ء: 'a',
  ئ: 'y', ؤ: 'w', لا: 'la',
};

export function containsArabicScript(text: string): boolean {
  return ARABIC_SCRIPT_RE.test(text);
}

export function containsLatinLetters(text: string): boolean {
  return LATIN_LETTER_RE.test(text);
}

/** True when one side is Arabic script and the other is Latin (typical ar quiz). */
export function isCrossScriptNamePair(a: string, b: string): boolean {
  const aAr = containsArabicScript(a);
  const bAr = containsArabicScript(b);
  const aLat = containsLatinLetters(a);
  const bLat = containsLatinLetters(b);
  return (aAr && bLat && !aLat) || (bAr && aLat && !bAr);
}

/** Rough Arabic → Latin transliteration for fuzzy cross-script name matching. */
export function transliterateArabicToLatin(text: string): string {
  let out = '';
  for (let i = 0; i < text.length; i += 1) {
    const pair = text.slice(i, i + 2);
    if (pair === 'لا') {
      out += 'la';
      i += 1;
      continue;
    }
    out += ARABIC_TO_LATIN[text[i]!] ?? text[i]!;
  }
  return out
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

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

function scoreSameScriptMatch(entityName: string, candidateText: string): number {
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

function scoreCrossScriptMatch(entityName: string, candidateText: string): number {
  const latinEntity = normalizeName(
    containsArabicScript(entityName)
      ? transliterateArabicToLatin(entityName)
      : entityName,
  );
  const latinCandidate = normalizeName(
    containsArabicScript(candidateText)
      ? transliterateArabicToLatin(candidateText)
      : candidateText,
  );
  if (!latinEntity || !latinCandidate) return 0;
  if (latinEntity === latinCandidate) return 1;

  let maxScore = getSimilarity(latinEntity, latinCandidate);

  const entityTokens = latinEntity.match(/[a-z]{3,}/g) ?? [];
  const candidateTokens = latinCandidate.match(/[a-z]{3,}/g) ?? [];
  for (const et of entityTokens) {
    for (const ct of candidateTokens) {
      if (et === ct) maxScore = Math.max(maxScore, 0.88);
      else maxScore = Math.max(maxScore, getSimilarity(et, ct) * 0.95);
    }
  }

  const entityLast = entityTokens[entityTokens.length - 1] ?? '';
  if (entityLast.length >= 4) {
    if (latinCandidate.endsWith(entityLast) || latinCandidate.includes(entityLast)) {
      maxScore = Math.max(maxScore, 0.85);
    }
  }

  return maxScore;
}

export function scoreEntityNameMatch(entityName: string, candidateText: string): number {
  if (!entityName?.trim() || !candidateText?.trim()) return 0;
  if (isCrossScriptNamePair(entityName, candidateText)) {
    return scoreCrossScriptMatch(entityName, candidateText);
  }
  return scoreSameScriptMatch(entityName, candidateText);
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
