/**
 * Authoritative season resolution for the Knowledge Export API.
 *
 * 365Scores career `seasonKey` is NOT the same as API-Football `season` (start year).
 * Production Cached365PlayerCareer proves European campaigns commonly use:
 *   seasonKey "2026" → label "2025/2026"
 *
 * Prefer the provider label from career rows when it is a campaign range.
 * Canonical end-year fallback lives HERE ONLY — do not duplicate elsewhere.
 */

export type SeasonResolveSource =
  | 'provider_career_label'
  | 'canonical_365_end_year'
  | 'unresolved';

export type SeasonConfidence = 'HIGH' | 'MEDIUM' | 'LOW';

export interface KnowledgeSeason {
  seasonKey: string;
  seasonLabel: string;
  source: SeasonResolveSource;
  confidence: SeasonConfidence;
}

/**
 * Canonical labels for 365 end-year seasonKeys (European club campaigns).
 * Proven against production Cached365PlayerCareer for key "2026".
 */
const CANONICAL_365_END_YEAR_LABELS: Readonly<Record<string, string>> = {
  '2022': '2021/2022',
  '2023': '2022/2023',
  '2024': '2023/2024',
  '2025': '2024/2025',
  '2026': '2025/2026',
  '2027': '2026/2027',
};

const CAMPAIGN_LABEL_RE = /(\d{4})\s*[\/\-]\s*(\d{2,4})/;

export function normalizeSeasonKey(raw: string | number | null | undefined): string | null {
  if (raw == null) return null;
  const s = String(raw).trim();
  if (!s || s === '-1') return null;
  const digits = s.replace(/[^0-9]/g, '');
  if (!digits) return null;
  // Prefer a 4-digit year when present (e.g. "2026", "2025-2026" → "20252026" would be wrong)
  const yearMatch = s.match(/(19|20)\d{2}/);
  if (yearMatch) return yearMatch[0];
  const n = parseInt(digits, 10);
  if (!Number.isFinite(n) || n < 1900 || n > 2100) return null;
  return String(n);
}

export function isValidSeasonKey(raw: string | number | null | undefined): boolean {
  return normalizeSeasonKey(raw) != null;
}

/** Normalize "2025/26", "2025-2026", "2025 / 2026" → "2025/2026" when possible. */
export function normalizeCampaignLabel(label: string): string {
  const trimmed = label.trim().replace(/\s/g, '');
  const m = trimmed.match(CAMPAIGN_LABEL_RE);
  if (!m) return trimmed;
  const start = m[1];
  let end = m[2];
  if (end.length === 2) {
    const century = start.slice(0, 2);
    end = `${century}${end}`;
  }
  return `${start}/${end}`;
}

export function looksLikeCampaignLabel(label: string | null | undefined): boolean {
  if (!label) return false;
  return CAMPAIGN_LABEL_RE.test(label.trim());
}

/**
 * Resolve seasonKey + seasonLabel for Knowledge Export.
 * @param providerLabel Optional label from a 365 career season row (preferred when campaign-shaped).
 */
export function resolveKnowledgeSeason(
  seasonKey: string | number,
  providerLabel?: string | null,
): KnowledgeSeason {
  const key = normalizeSeasonKey(seasonKey);
  if (!key) {
    return {
      seasonKey: String(seasonKey ?? ''),
      seasonLabel: String(providerLabel ?? seasonKey ?? ''),
      source: 'unresolved',
      confidence: 'LOW',
    };
  }

  if (looksLikeCampaignLabel(providerLabel)) {
    return {
      seasonKey: key,
      seasonLabel: normalizeCampaignLabel(providerLabel!),
      source: 'provider_career_label',
      confidence: 'HIGH',
    };
  }

  const canonical = CANONICAL_365_END_YEAR_LABELS[key];
  if (canonical) {
    return {
      seasonKey: key,
      seasonLabel: canonical,
      source: 'canonical_365_end_year',
      confidence: 'HIGH',
    };
  }

  return {
    seasonKey: key,
    seasonLabel: (providerLabel && String(providerLabel).trim()) || key,
    source: 'unresolved',
    confidence: 'LOW',
  };
}

/** Pick the best campaign-shaped label from observed provider labels for a key. */
export function pickMajorityCampaignLabel(labels: string[]): string | null {
  const counts = new Map<string, number>();
  for (const raw of labels) {
    if (!looksLikeCampaignLabel(raw)) continue;
    const norm = normalizeCampaignLabel(raw);
    counts.set(norm, (counts.get(norm) ?? 0) + 1);
  }
  let best: string | null = null;
  let bestCount = 0;
  for (const [label, count] of counts) {
    if (count > bestCount) {
      best = label;
      bestCount = count;
    }
  }
  return best;
}

export function resolveKnowledgeSeasonFromObservations(
  seasonKey: string | number,
  observedLabels: string[],
): KnowledgeSeason {
  const majority = pickMajorityCampaignLabel(observedLabels);
  if (majority) {
    const key = normalizeSeasonKey(seasonKey) ?? String(seasonKey);
    return {
      seasonKey: key,
      seasonLabel: majority,
      source: 'provider_career_label',
      confidence: 'HIGH',
    };
  }
  return resolveKnowledgeSeason(seasonKey, observedLabels[0] ?? null);
}
