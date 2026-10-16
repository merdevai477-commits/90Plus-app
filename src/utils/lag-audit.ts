/**
 * TEMPORARY live-minute pipeline audit. Remove after LAG-AUDIT investigation.
 * Enable with LAG_AUDIT=1. JSON lines prefixed [LAG-AUDIT] for Railway grep.
 */
import { logger } from './logger';

export function isLagAuditEnabled(): boolean {
  const raw = process.env.LAG_AUDIT?.trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

export function lagAudit(event: string, fields: Record<string, unknown> = {}): void {
  if (!isLagAuditEnabled()) return;
  logger.info(
    `[LAG-AUDIT] ${JSON.stringify({ t: new Date().toISOString(), event, ...fields })}`,
  );
}
