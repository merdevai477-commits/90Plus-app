/**
 * Internal Knowledge Export — auth for Football Knowledge Factory ingestion.
 * Fail-closed when KNOWLEDGE_EXPORT_API_KEY is unset.
 */

import { Request, Response, NextFunction } from 'express';
import { ErrorCode, sendError } from '../constants/errors';
import { logger } from '../utils/logger';

export function requireKnowledgeExportAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const expected = process.env.KNOWLEDGE_EXPORT_API_KEY?.trim();
  if (!expected) {
    logger.error('[KnowledgeExport] KNOWLEDGE_EXPORT_API_KEY is not configured');
    sendError(req, res, ErrorCode.INTERNAL, 'Knowledge export API is not configured');
    return;
  }

  const provided =
    (req.headers['x-api-key'] as string | undefined)?.trim() ||
    (req.headers['x-knowledge-export-key'] as string | undefined)?.trim() ||
    '';

  if (!provided || provided !== expected) {
    logger.warn('[KnowledgeExport] auth failure', {
      path: req.path,
      ip: req.ip,
    });
    sendError(req, res, ErrorCode.AUTHENTICATION, 'Unauthorized');
    return;
  }

  next();
}
