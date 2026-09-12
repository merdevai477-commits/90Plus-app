/**
 * Guard for the allscores → Redis 365 live REPLACE path.
 *
 * A healthy yday–tomorrow /allscores/ window usually returns hundreds of games.
 * Production incidents showed intermittent "successful" payloads with ~10 games and
 * 0 live rows that then REPLACE-wiped a known-good Redis live list (~50+).
 *
 * Policy:
 * - Non-empty live set → REPLACE
 * - Empty live + no previous → allow write/clear (nothing to preserve)
 * - Empty live + previous > 0 + thin catalogue → KEEP_PREVIOUS (degraded upstream)
 * - Empty live + previous > 0 + complete-enough catalogue → CLEAR (legitimate quiet period)
 */

export const MIN_ALLSCORES_CATALOGUE_FOR_EMPTY_LIVE_CLEAR = 100;

export type LiveSnapshotWriteAction = 'REPLACE' | 'KEEP_PREVIOUS' | 'CLEAR';

export type LiveSnapshotWriteReason =
  | 'VALID_UPSTREAM_SNAPSHOT'
  | 'EMPTY_NO_PREVIOUS'
  | 'EMPTY_UPSTREAM_RESPONSE'
  | 'LEGITIMATE_EMPTY_LIVE_SNAPSHOT';

export type LiveSnapshotWriteDecision = {
  action: LiveSnapshotWriteAction;
  reason: LiveSnapshotWriteReason;
};

export function decide365LiveSnapshotWrite(input: {
  incomingLiveCount: number;
  previousLiveCount: number;
  catalogueCount: number;
  minCatalogueForEmptyClear?: number;
}): LiveSnapshotWriteDecision {
  const incoming = Math.max(0, Math.floor(input.incomingLiveCount) || 0);
  const previous = Math.max(0, Math.floor(input.previousLiveCount) || 0);
  const catalogue = Math.max(0, Math.floor(input.catalogueCount) || 0);
  const minCatalogue =
    input.minCatalogueForEmptyClear ?? MIN_ALLSCORES_CATALOGUE_FOR_EMPTY_LIVE_CLEAR;

  if (incoming > 0) {
    return { action: 'REPLACE', reason: 'VALID_UPSTREAM_SNAPSHOT' };
  }

  if (previous <= 0) {
    return { action: 'CLEAR', reason: 'EMPTY_NO_PREVIOUS' };
  }

  if (catalogue < minCatalogue) {
    return { action: 'KEEP_PREVIOUS', reason: 'EMPTY_UPSTREAM_RESPONSE' };
  }

  return { action: 'CLEAR', reason: 'LEGITIMATE_EMPTY_LIVE_SNAPSHOT' };
}
