/**
 * Metrics Middleware
 * 
 * Tracks request/response metrics for performance monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { metricsCollector } from '../utils/metrics';

/**
 * Middleware to track request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  let cacheHit = false;

  // Track cache hits from response headers
  const originalJson = res.json.bind(res);
  res.json = function (body: any) {
    const cacheHeader = res.getHeader('X-Cache');
    if (cacheHeader === 'HIT') {
      cacheHit = true;
    }
    return originalJson(body);
  };

  // Track when response finishes
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    metricsCollector.recordRequest({
      endpoint: req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      cacheHit,
      timestamp: Date.now(),
    });
  });

  next();
}

/**
 * Get metrics endpoint handler
 */
export function getMetricsHandler(req: Request, res: Response): void {
  const { endpoint, method } = req.query;

  if (endpoint && method) {
    const metrics = metricsCollector.getEndpointMetrics(
      endpoint as string,
      method as string
    );
    
    if (metrics) {
      res.json({ status: 'SUCCESS', data: metrics });
    } else {
      res.status(404).json({ status: 'ERROR', message: 'Metrics not found' });
    }
  } else {
    const allMetrics = metricsCollector.getAllMetrics();
    const summary = metricsCollector.getSummary();
    
    res.json({
      status: 'SUCCESS',
      data: {
        summary,
        endpoints: allMetrics,
      },
    });
  }
}

