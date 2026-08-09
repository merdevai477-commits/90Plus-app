import { Request, Response } from 'express';
import { ErrorCode, sendError } from '../constants/errors';
import { knowledgeExportService } from '../services/knowledge-export.service';
import { isValidSeasonKey } from '../utils/knowledge-season-resolver.util';
import { logger } from '../utils/logger';

function parsePositiveInt(raw: unknown): number | null {
  if (raw == null || raw === '') return null;
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function paramString(raw: string | string[] | undefined): string {
  if (Array.isArray(raw)) return String(raw[0] ?? '');
  return String(raw ?? '');
}

function mapExportError(req: Request, res: Response, err: unknown): void {
  const msg = (err as Error)?.message;
  if (msg === 'INVALID_SEASON_KEY') {
    sendError(req, res, ErrorCode.VALIDATION, 'Invalid seasonKey');
    return;
  }
  if (msg === 'INVALID_COMPETITION_ID') {
    sendError(req, res, ErrorCode.VALIDATION, 'Invalid competitionId');
    return;
  }
  logger.error('[KnowledgeExport] handler error:', msg);
  sendError(req, res, ErrorCode.INTERNAL, 'Knowledge export failed');
}

export class KnowledgeExportController {
  /** GET /api/internal/football/knowledge/seasons */
  static async listSeasons(req: Request, res: Response): Promise<void> {
    try {
      const result = await knowledgeExportService.listSeasons();
      res.json(result);
    } catch (err) {
      mapExportError(req, res, err);
    }
  }

  /** GET /api/internal/football/knowledge/season/:seasonKey */
  static async getSeason(req: Request, res: Response): Promise<void> {
    try {
      const seasonKey = paramString(req.params.seasonKey);
      if (!isValidSeasonKey(seasonKey)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Invalid seasonKey');
        return;
      }
      const result = await knowledgeExportService.getSeasonSummary(seasonKey);
      res.json(result);
    } catch (err) {
      mapExportError(req, res, err);
    }
  }

  /** GET /api/internal/football/knowledge/season/:seasonKey/competitions */
  static async listCompetitions(req: Request, res: Response): Promise<void> {
    try {
      const seasonKey = paramString(req.params.seasonKey);
      if (!isValidSeasonKey(seasonKey)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Invalid seasonKey');
        return;
      }
      const result = await knowledgeExportService.getSeasonSummary(seasonKey);
      res.json({
        status: result.status,
        dataset: result.dataset,
        coverage: result.coverage,
        competitions: result.competitions,
        scannedAthletes: result.scannedAthletes,
      });
    } catch (err) {
      mapExportError(req, res, err);
    }
  }

  /**
   * GET /api/internal/football/knowledge/season/:seasonKey/competition/:competitionId
   * Query: cursor, pageSize, teamId
   */
  static async exportCompetition(req: Request, res: Response): Promise<void> {
    try {
      const seasonKey = paramString(req.params.seasonKey);
      const competitionId = parsePositiveInt(req.params.competitionId);
      if (!isValidSeasonKey(seasonKey)) {
        sendError(req, res, ErrorCode.VALIDATION, 'Invalid seasonKey');
        return;
      }
      if (competitionId == null) {
        sendError(req, res, ErrorCode.VALIDATION, 'Invalid competitionId');
        return;
      }

      const cursorRaw = req.query.cursor;
      let cursor: number | null = null;
      if (cursorRaw != null && cursorRaw !== '') {
        cursor = parsePositiveInt(cursorRaw);
        if (cursor == null) {
          sendError(req, res, ErrorCode.VALIDATION, 'Invalid cursor');
          return;
        }
      }

      const pageSize = parsePositiveInt(req.query.pageSize) ?? undefined;
      const teamId = parsePositiveInt(req.query.teamId);

      const result = await knowledgeExportService.exportCompetition({
        seasonKey,
        competitionId,
        cursor,
        pageSize,
        teamId,
      });

      res.json(result);
    } catch (err) {
      mapExportError(req, res, err);
    }
  }
}
