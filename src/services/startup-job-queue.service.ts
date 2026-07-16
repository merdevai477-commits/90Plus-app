import { logger } from '../utils/logger';

type Job = { name: string; run: () => Promise<void> };

/**
 * Serial (max concurrency) queue for boot-time heavy syncs.
 * Prevents catalog+allscores+live+fixtures from overlapping in the same second.
 */
class StartupJobQueue {
  private readonly q: Job[] = [];
  private active = 0;
  private readonly maxConcurrent: number;

  constructor(maxConcurrent = 1) {
    this.maxConcurrent = Math.max(1, maxConcurrent);
  }

  enqueue(name: string, run: () => Promise<void>): void {
    this.q.push({ name, run });
    this.pump();
  }

  private pump(): void {
    while (this.active < this.maxConcurrent && this.q.length > 0) {
      const job = this.q.shift()!;
      this.active += 1;
      logger.info(`[StartupQueue] start "${job.name}" (active=${this.active}, waiting=${this.q.length})`);
      void job
        .run()
        .catch((err: unknown) => {
          logger.warn(`[StartupQueue] "${job.name}" failed:`, (err as Error)?.message ?? err);
        })
        .finally(() => {
          this.active -= 1;
          logger.info(`[StartupQueue] done "${job.name}" (active=${this.active}, waiting=${this.q.length})`);
          this.pump();
        });
    }
  }
}

/** Shared boot queue — max 1 heavy job unless STARTUP_QUEUE_CONCURRENCY is set. */
const concurrency = Math.max(
  1,
  Math.min(2, parseInt(process.env.STARTUP_QUEUE_CONCURRENCY || '1', 10) || 1),
);

export const startupJobQueue = new StartupJobQueue(concurrency);
