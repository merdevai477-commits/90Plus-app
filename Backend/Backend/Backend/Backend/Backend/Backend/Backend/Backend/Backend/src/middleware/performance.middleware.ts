/**
 * Performance Monitoring Middleware
 * 
 * Logs slow requests and response times for monitoring and optimization.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

const SLOW_REQUEST_THRESHOLD = 1000; // 1 second

interface PerformanceMetrics {
    method: string;
    path: string;
    duration: number;
    statusCode: number;
    timestamp: number;
}

/**
 * Performance monitoring middleware
 */
export function performanceMiddleware() {
    return (req: Request, res: Response, next: NextFunction) => {
        const startTime = Date.now();
        const startMemory = process.memoryUsage().heapUsed;

        // Store original end method
        const originalEnd = res.end.bind(res);

        // Override end to measure performance
        res.end = function (chunk?: any, encoding?: any) {
            const duration = Date.now() - startTime;
            const endMemory = process.memoryUsage().heapUsed;
            const memoryDelta = (endMemory - startMemory) / 1024 / 1024; // MB

            // Log slow requests
            if (duration > SLOW_REQUEST_THRESHOLD) {
                const metrics: PerformanceMetrics = {
                    method: req.method,
                    path: req.path,
                    duration,
                    statusCode: res.statusCode,
                    timestamp: Date.now(),
                };

                logger.warn('[Performance] Slow request detected:', {
                    ...metrics,
                    memoryDelta: `${memoryDelta.toFixed(2)} MB`,
                    query: req.query,
                });
            }

            // Log in production for monitoring (optional)
            if (process.env.NODE_ENV === 'production' && duration > 500) {
                logger.info('[Performance] Request completed:', {
                    method: req.method,
                    path: req.path,
                    duration: `${duration}ms`,
                    statusCode: res.statusCode,
                });
            }

            // Call original end method
            return originalEnd(chunk, encoding);
        };

        next();
    };
}

/**
 * Request timing middleware (simpler version)
 */
export function requestTiming() {
    return (req: Request, res: Response, next: NextFunction) => {
        const start = Date.now();

        res.on('finish', () => {
            const duration = Date.now() - start;
            if (duration > SLOW_REQUEST_THRESHOLD) {
                logger.warn(`[Timing] ${req.method} ${req.path} took ${duration}ms`);
            }
        });

        next();
    };
}

export default performanceMiddleware;

