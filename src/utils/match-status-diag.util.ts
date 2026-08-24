/**
 * Temporary match-status pipeline diagnostics.
 * Enable with MATCH_STATUS_DIAG=true on Railway/local.
 * Remove after root-cause analysis is complete.
 */

import { logger } from './logger';

export function isMatchStatusDiagEnabled(): boolean {
  const raw = process.env.MATCH_STATUS_DIAG?.trim().toLowerCase();
  return raw === 'true' || raw === '1' || raw === 'yes';
}

export function diag365RawStatus(
  fixtureId: number,
  game: {
    id?: number;
    statusId?: number;
    statusGroup?: number;
    statusText?: string;
    shortStatusText?: string;
    gameTime?: number;
    gameTimeDisplay?: string;
  },
  source: string,
): void {
  if (!isMatchStatusDiagEnabled()) return;
  logger.info('[MatchStatusDiag][365-raw]', {
    fixtureId,
    gameId: game.id,
    source,
    statusId: game.statusId,
    statusGroup: game.statusGroup,
    statusText: game.statusText,
    shortStatusText: game.shortStatusText,
    gameTime: game.gameTime,
    gameTimeDisplay: game.gameTimeDisplay,
  });
}

export function diag365MappedStatus(
  fixtureId: number,
  mapped: { short: string; long: string; elapsed: number | null; extra?: number | null },
  source: string,
): void {
  if (!isMatchStatusDiagEnabled()) return;
  logger.info('[MatchStatusDiag][365-mapped]', {
    fixtureId,
    source,
    short: mapped.short,
    long: mapped.long,
    elapsed: mapped.elapsed,
    extra: mapped.extra ?? null,
  });
}

export function diagBeforeDbWrite(
  fixtureId: number,
  status: string,
  previousStatus: string | null | undefined,
  source: string,
): void {
  if (!isMatchStatusDiagEnabled()) return;
  logger.info('[MatchStatusDiag][db-write]', {
    fixtureId,
    source,
    status,
    previousStatus: previousStatus ?? null,
  });
}

export function diagBeforeCacheWrite(
  fixtureId: number,
  status: string,
  cacheKind: 'redis-live-list' | 'redis-live-fixture' | 'redis-terminal' | 'redis-365-merge',
  provider: 'api-football' | '365' | 'legacy',
): void {
  if (!isMatchStatusDiagEnabled()) return;
  logger.info('[MatchStatusDiag][cache-write]', {
    fixtureId,
    status,
    cacheKind,
    provider,
  });
}
