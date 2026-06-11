import { Request, Response } from 'express';
import { ErrorCode, sendError } from '../constants/errors';
import { fetchProxiedNewsImage } from '../services/news-image-proxy.service';
import { WorldCupNewsService } from '../services/world-cup-news.service';
import { logger } from '../utils/logger';

function queryString(value: unknown): string | undefined {
  if (typeof value === 'string') return value;
  if (Array.isArray(value) && typeof value[0] === 'string') return value[0];
  return undefined;
}

export class NewsController {
  /**
   * GET /api/news/world-cup
   * Serves cached World Cup headlines — upstream News API is refreshed by cron only.
   */
  static async getWorldCupNews(req: Request, res: Response): Promise<void> {
    try {
      if (!WorldCupNewsService.isConfigured()) {
        sendError(req, res, ErrorCode.EXTERNAL_SERVICE, 'News service is not configured');
        return;
      }

      const language = WorldCupNewsService.resolveLanguage(queryString(req.query.lang));
      const page = WorldCupNewsService.resolvePage(queryString(req.query.page));
      const pageSize = WorldCupNewsService.resolvePageSize(queryString(req.query.pageSize));

      const result = await WorldCupNewsService.getWorldCupNews({
        language,
        page,
        pageSize,
      });

      const ttlMinutes = WorldCupNewsService.getCacheTtlMinutes();
      const browserMaxAge = Math.min(600, ttlMinutes * 60);
      res.setHeader('Cache-Control', `public, max-age=${browserMaxAge}, stale-while-revalidate=3600`);
      res.json({
        status: 'SUCCESS',
        language,
        page,
        pageSize,
        cached: result.cached,
        stale: result.stale,
        fetchedAt: result.fetchedAt,
        expiresAt: result.expiresAt,
        provider: result.provider,
        quota: result.quota,
        data: result.data,
      });
    } catch (error: any) {
      logger.error('World Cup news error:', error);
      sendError(
        req,
        res,
        ErrorCode.EXTERNAL_SERVICE,
        error?.message || 'Failed to fetch World Cup news',
      );
    }
  }

  /** GET /api/news/image/:id — cached proxy for external news thumbnails */
  static async getNewsImage(req: Request, res: Response): Promise<void> {
    try {
      const id = typeof req.params.id === 'string' ? req.params.id : req.params.id?.[0];
      if (!id) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'Image not found');
        return;
      }

      const image = await fetchProxiedNewsImage(id);
      if (!image) {
        sendError(req, res, ErrorCode.NOT_FOUND, 'Image not found');
        return;
      }

      res.setHeader('Content-Type', image.contentType);
      res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
      res.send(image.buffer);
    } catch (error: any) {
      logger.error('News image proxy error:', error);
      sendError(req, res, ErrorCode.EXTERNAL_SERVICE, 'Failed to load image');
    }
  }
}
