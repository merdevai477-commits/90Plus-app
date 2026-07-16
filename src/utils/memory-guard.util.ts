import { logger } from './logger';

/**
 * Skip/defer heavy background work when RSS is already near the container ceiling.
 * Set MEMORY_LIMIT_MB to match Railway Replica Memory (e.g. 6144 for 6GB).
 * Does not change the Railway limit itself — code-only safety brake.
 */
export function shouldSkipHeavyJob(jobName: string): boolean {
  const limitMb = Math.max(
    512,
    parseInt(process.env.MEMORY_LIMIT_MB || process.env.RAILWAY_MEMORY_LIMIT_MB || '6144', 10) || 6144,
  );
  const ratio = Math.min(
    0.95,
    Math.max(0.5, parseFloat(process.env.MEMORY_GUARD_RSS_RATIO || '0.7') || 0.7),
  );
  const rssMb = process.memoryUsage().rss / (1024 * 1024);
  const thresholdMb = limitMb * ratio;
  if (rssMb >= thresholdMb) {
    logger.warn(
      `[MemoryGuard] defer/skip "${jobName}" — rss=${Math.round(rssMb)}MB >= ${Math.round(ratio * 100)}% of limit ${limitMb}MB`,
    );
    return true;
  }
  return false;
}
