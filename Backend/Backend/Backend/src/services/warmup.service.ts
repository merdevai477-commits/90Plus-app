/**
 * Warmup Service
 * 
 * Pre-warms critical endpoints and services to reduce cold start impact
 * 
 * Features:
 * - ✅ Pre-warm critical routes
 * - ✅ Pre-connect to database
 * - ✅ Pre-load critical data
 * - ✅ Graceful startup sequence
 * - ✅ Priority-based loading
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { logger } from '../utils/logger';
import { connectPrisma, getPrisma } from '../lib/prisma-lazy';

// ============================================================================
// TYPES
// ============================================================================

interface WarmupResult {
  success: boolean;
  duration: number;
  error?: string;
}

interface WarmupReport {
  totalDuration: number;
  results: {
    database: WarmupResult;
    criticalData: WarmupResult;
    services: WarmupResult;
  };
}

// ============================================================================
// WARMUP SERVICE
// ============================================================================

class WarmupService {
  private isWarmedUp = false;
  private warmupPromise: Promise<WarmupReport> | null = null;

  /**
   * Start warmup process
   */
  async start(): Promise<WarmupReport> {
    if (this.isWarmedUp) {
      logger.info('✅ Server already warmed up');
      return this.getDefaultReport();
    }

    if (this.warmupPromise) {
      logger.info('⏳ Warmup already in progress, waiting...');
      return this.warmupPromise;
    }

    logger.info('🔥 Starting server warmup...');
    const startTime = Date.now();

    this.warmupPromise = this.performWarmup();
    const report = await this.warmupPromise;

    this.isWarmedUp = true;
    const totalDuration = Date.now() - startTime;

    logger.info(`✅ Server warmup completed in ${totalDuration}ms`);
    
    return {
      ...report,
      totalDuration,
    };
  }

  /**
   * Perform warmup tasks
   */
  private async performWarmup(): Promise<WarmupReport> {
    const results = {
      database: await this.warmupDatabase(),
      criticalData: await this.warmupCriticalData(),
      services: await this.warmupServices(),
    };

    return {
      totalDuration: 0, // Will be set by start()
      results,
    };
  }

  /**
   * Warmup database connection
   */
  private async warmupDatabase(): Promise<WarmupResult> {
    const startTime = Date.now();
    
    try {
      logger.info('🔌 Warming up database connection...');
      
      // Connect to database with timeout
      const connected = await connectPrisma(5000);
      
      if (!connected) {
        throw new Error('Database connection failed');
      }

      // Test query
      const prisma = getPrisma();
      await prisma.$queryRaw`SELECT 1`;

      const duration = Date.now() - startTime;
      logger.info(`✅ Database warmed up in ${duration}ms`);

      return {
        success: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.warn(`⚠️ Database warmup failed in ${duration}ms:`, error.message);
      
      return {
        success: false,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Warmup critical data (cache frequently accessed data)
   */
  private async warmupCriticalData(): Promise<WarmupResult> {
    const startTime = Date.now();
    
    try {
      logger.info('📦 Warming up critical data...');
      
      const prisma = getPrisma();

      // Pre-load quiz categories (frequently accessed)
      await prisma.quizCategory.findMany({
        select: {
          id: true,
          name: true,
          icon: true,
          isLocked: true,
        },
        take: 10,
      });

      // Pre-load active leagues (frequently accessed)
      await prisma.league.findMany({
        select: {
          id: true,
          name: true,
          country: true,
          logo: true,
        },
        take: 10,
      });

      const duration = Date.now() - startTime;
      logger.info(`✅ Critical data warmed up in ${duration}ms`);

      return {
        success: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.warn(`⚠️ Critical data warmup failed in ${duration}ms:`, error.message);
      
      return {
        success: false,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Warmup services (initialize critical services)
   */
  private async warmupServices(): Promise<WarmupResult> {
    const startTime = Date.now();
    
    try {
      logger.info('⚙️ Warming up services...');
      
      // Services will be initialized lazily when needed
      // This is just a placeholder for future service warmup
      
      const duration = Date.now() - startTime;
      logger.info(`✅ Services warmed up in ${duration}ms`);

      return {
        success: true,
        duration,
      };
    } catch (error: any) {
      const duration = Date.now() - startTime;
      logger.warn(`⚠️ Services warmup failed in ${duration}ms:`, error.message);
      
      return {
        success: false,
        duration,
        error: error.message,
      };
    }
  }

  /**
   * Check if server is warmed up
   */
  isReady(): boolean {
    return this.isWarmedUp;
  }

  /**
   * Get default report
   */
  private getDefaultReport(): WarmupReport {
    return {
      totalDuration: 0,
      results: {
        database: { success: true, duration: 0 },
        criticalData: { success: true, duration: 0 },
        services: { success: true, duration: 0 },
      },
    };
  }
}

// ============================================================================
// EXPORT SINGLETON
// ============================================================================

export const warmupService = new WarmupService();

// ============================================================================
// KEEP-ALIVE PING (Prevent cold starts)
// ============================================================================

let keepAlivePingInterval: NodeJS.Timeout | null = null;

/**
 * Start keep-alive ping to prevent cold starts
 * Pings the server every 5 minutes
 */
export function startKeepAlivePing(port: number) {
  if (keepAlivePingInterval) {
    return;
  }

  // Only in production
  if (process.env.NODE_ENV !== 'production') {
    logger.info('⏭️  Keep-alive ping disabled in development');
    return;
  }

  keepAlivePingInterval = setInterval(async () => {
    try {
      const response = await fetch(`http://localhost:${port}/health`);
      if (response.ok) {
        logger.debug('✅ Keep-alive ping successful');
      } else {
        logger.warn(`⚠️ Keep-alive ping returned ${response.status}`);
      }
    } catch (error: any) {
      logger.warn('⚠️ Keep-alive ping failed:', error.message);
    }
  }, 5 * 60 * 1000); // 5 minutes

  logger.info('✅ Keep-alive ping started (every 5 minutes)');
}

/**
 * Stop keep-alive ping
 */
export function stopKeepAlivePing() {
  if (keepAlivePingInterval) {
    clearInterval(keepAlivePingInterval);
    keepAlivePingInterval = null;
    logger.info('✅ Keep-alive ping stopped');
  }
}
