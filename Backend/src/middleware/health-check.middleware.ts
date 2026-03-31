/**
 * Health Check Middleware
 * 
 * Provides comprehensive health and readiness checks for the backend
 * 
 * Endpoints:
 * - GET /health - Basic health check (always returns 200)
 * - GET /ready - Readiness probe (returns 503 if not ready)
 * - GET /api/health - Detailed health with metrics
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { Request, Response } from 'express';
import { checkDatabaseConnection, getConnectionPoolStatus } from '../lib/prisma-lazy';
import { logger } from '../utils/logger';

// ============================================================================
// TYPES
// ============================================================================

interface HealthCheck {
  status: 'OK' | 'PARTIAL' | 'ERROR';
  timestamp: string;
  uptime: number;
  environment: string;
  checks: {
    server: boolean;
    database: boolean;
    memory: boolean;
  };
  metrics?: {
    memory: {
      heapUsed: string;
      heapTotal: string;
      rss: string;
      external: string;
    };
    database?: {
      activeConnections: number;
      poolSize: number;
      isConnected: boolean;
    };
  };
}

interface ReadinessCheck {
  status: 'READY' | 'NOT_READY';
  timestamp: string;
  startupTime: number;
  checks: {
    server: boolean;
    database: boolean;
    routes: boolean;
    services: boolean;
  };
}

// ============================================================================
// STATE TRACKING
// ============================================================================

const startTime = Date.now();
let routesLoaded = false;
let servicesStarted = false;

export function markRoutesLoaded() {
  routesLoaded = true;
  logger.info('✅ Routes marked as loaded');
}

export function markServicesStarted() {
  servicesStarted = true;
  logger.info('✅ Services marked as started');
}

// ============================================================================
// BASIC HEALTH CHECK (Always returns 200)
// ============================================================================

export async function basicHealthCheck(req: Request, res: Response) {
  res.status(200).json({
    status: 'OK',
    timestamp: new Date().toISOString(),
    uptime: Math.floor(process.uptime()),
    message: '90Plus API is running',
  });
}

// ============================================================================
// READINESS PROBE (Returns 503 if not ready)
// ============================================================================

export async function readinessCheck(req: Request, res: Response) {
  const checks = {
    server: true,
    database: false,
    routes: routesLoaded,
    services: servicesStarted,
  };

  try {
    // Check database connection
    checks.database = await checkDatabaseConnection();

    const allReady = Object.values(checks).every(v => v);
    const startupTime = Date.now() - startTime;

    const response: ReadinessCheck = {
      status: allReady ? 'READY' : 'NOT_READY',
      timestamp: new Date().toISOString(),
      startupTime,
      checks,
    };

    res.status(allReady ? 200 : 503).json(response);
  } catch (error: any) {
    logger.error('❌ Readiness check failed:', error);
    
    res.status(503).json({
      status: 'NOT_READY',
      timestamp: new Date().toISOString(),
      startupTime: Date.now() - startTime,
      checks,
      error: error.message,
    });
  }
}

// ============================================================================
// DETAILED HEALTH CHECK (With metrics)
// ============================================================================

export async function detailedHealthCheck(req: Request, res: Response) {
  const timestamp = new Date().toISOString();
  const environment = process.env.NODE_ENV || 'development';
  const uptime = process.uptime();
  const memoryUsage = process.memoryUsage();

  const checks = {
    server: true,
    database: false,
    memory: true,
  };

  let poolStatus = null;

  try {
    // Check database connection with timeout
    checks.database = await Promise.race([
      checkDatabaseConnection(),
      new Promise<boolean>((_, reject) =>
        setTimeout(() => reject(new Error('Database check timeout')), 5000)
      )
    ]);

    // Get connection pool status
    if (checks.database) {
      poolStatus = await getConnectionPoolStatus();
    }

    // Check memory usage (warn if > 80% of heap)
    const heapUsedPercent = (memoryUsage.heapUsed / memoryUsage.heapTotal) * 100;
    checks.memory = heapUsedPercent < 80;

    const allHealthy = Object.values(checks).every(v => v);

    const response: HealthCheck = {
      status: allHealthy ? 'OK' : checks.database ? 'PARTIAL' : 'ERROR',
      timestamp,
      uptime: Math.floor(uptime),
      environment,
      checks,
      metrics: {
        memory: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        },
        ...(poolStatus && {
          database: poolStatus,
        }),
      },
    };

    res.status(allHealthy ? 200 : 200).json(response);
  } catch (error: any) {
    logger.error('❌ Health check failed:', error);
    
    res.status(200).json({
      status: 'PARTIAL',
      timestamp,
      uptime: Math.floor(uptime),
      environment,
      checks,
      message: '90Plus API is running, but some checks failed',
      error: error.message,
      metrics: {
        memory: {
          heapUsed: `${Math.round(memoryUsage.heapUsed / 1024 / 1024)}MB`,
          heapTotal: `${Math.round(memoryUsage.heapTotal / 1024 / 1024)}MB`,
          rss: `${Math.round(memoryUsage.rss / 1024 / 1024)}MB`,
          external: `${Math.round(memoryUsage.external / 1024 / 1024)}MB`,
        },
      },
    });
  }
}

// ============================================================================
// STARTUP TIME TRACKING
// ============================================================================

export function getStartupTime(): number {
  return Date.now() - startTime;
}

export function getStartTime(): number {
  return startTime;
}
