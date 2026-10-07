/**
 * Metrics Middleware
 * 
 * Tracks request/response metrics for performance monitoring
 */

import { Request, Response, NextFunction } from 'express';
import { metricsCollector } from '../utils/metrics';
import { getFootballMetrics } from '../utils/football-metrics';

/**
 * Middleware to track request metrics
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();

  // Track when response finishes. Cache hits are sent as pre-serialized
  // strings (res.send), so read the header rather than wrapping res.json.
  res.on('finish', () => {
    const responseTime = Date.now() - startTime;
    
    metricsCollector.recordRequest({
      endpoint: req.path,
      method: req.method,
      responseTime,
      statusCode: res.statusCode,
      cacheHit: res.getHeader('X-Cache') === 'HIT',
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
        football: getFootballMetrics(),
      },
    });
  }
}

