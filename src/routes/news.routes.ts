import { Router } from 'express';
import { NewsController } from '../controllers/news.controller';

const router = Router();

/**
 * GET /api/news/world-cup
 * Query: lang=ar|en|all (default all), page, pageSize
 */
router.get('/world-cup', NewsController.getWorldCupNews);

export default router;
