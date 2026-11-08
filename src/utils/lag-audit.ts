/**
 * TEMPORARY live-minute pipeline audit. Remove after LAG-AUDIT investigation.
 * Enable with LAG_AUDIT=1. JSON lines prefixed [LAG-AUDIT] for Railway grep.
 */
import { logger } from './logger';

export function isLagAuditEnabled(): boolean {
  const raw = process.env.LAG_AUDIT?.trim().toLowerCase();
  return raw === '1' || raw === 'true';
}

type BackendTraceModule = typeof import('../services/diagnostics/diagnostics-backend-trace.service');

let backendTrace: BackendTraceModule | null | undefined;

function backendTraceModule(): BackendTraceModule | null {
  if (backendTrace !== undefined) return backendTrace;
  try {
    backendTrace = require('../services/diagnostics/diagnostics-backend-trace.service') as BackendTraceModule;
  } catch {
    backendTrace = null;
  }
  return backendTrace;
}

export function lagAudit(event: string, fields: Record<string, unknown> = {}): void {
  const trace = backendTraceModule();
  if (trace?.isBackendTraceActive()) trace.noteLagAudit(event, fields);
  if (!isLagAuditEnabled()) return;
  logger.info(
    `[LAG-AUDIT] ${JSON.stringify({ t: new Date().toISOString(), event, ...fields })}`,
  );
}
