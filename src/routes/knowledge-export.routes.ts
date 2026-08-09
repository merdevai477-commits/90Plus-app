import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { KnowledgeExportController } from '../controllers/knowledge-export.controller';
import { requireKnowledgeExportAuth } from '../middleware/knowledge-export-auth.middleware';
import { skipRateLimitForTrusted } from '../middleware/rateLimit.middleware';

/**
 * INTERNAL ONLY — Football Knowledge Factory ingestion.
 * Mounted at /api/internal/football/knowledge
 *
 * Auth: x-api-key / x-knowledge-export-key === KNOWLEDGE_EXPORT_API_KEY
 */

const knowledgeExportLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 60 : 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    status: 'ERROR',
    message: 'Too many knowledge export requests',
  },
  skip: skipRateLimitForTrusted,
  keyGenerator: (req) => {
    const key =
      (req.headers['x-api-key'] as string | undefined) ||
      (req.headers['x-knowledge-export-key'] as string | undefined) ||
      req.ip ||
      'unknown';
    return `knowledge-export:${key.slice(0, 32)}`;
  },
});

const router = Router();

router.use(knowledgeExportLimiter);

router.get('/seasons', requireKnowledgeExportAuth, KnowledgeExportController.listSeasons);
router.get('/season/:seasonKey', requireKnowledgeExportAuth, KnowledgeExportController.getSeason);
router.get('/season/:seasonKey/competitions', requireKnowledgeExportAuth, KnowledgeExportController.listCompetitions);
router.get('/season/:seasonKey/competition/:competitionId', requireKnowledgeExportAuth, KnowledgeExportController.exportCompetition);

export default router;
