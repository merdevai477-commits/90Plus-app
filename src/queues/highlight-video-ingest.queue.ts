import Bull, { Queue } from 'bull';
import { bullCreateClient } from '../lib/bull-redis';
import { logger } from '../utils/logger';
import { processHighlightIngestion } from '../services/highlight-storage/ingest';

type JobData = { highlightlyId: number };

let queue: Queue<JobData> | null = null;

export function getHighlightIngestQueue(): Queue<JobData> | null {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('[HighlightStorage] REDIS_URL unset — ingest queue disabled');
    return null;
  }
  queue = new Bull<JobData>('highlight-video-ingest', {
    createClient: bullCreateClient(redisUrl),
    defaultJobOptions: {
      attempts: Math.max(1, Number(process.env.VIDEO_STORAGE_MAX_RETRIES || '3')),
      backoff: {
        type: 'exponential',
        delay: Math.max(1000, Number(process.env.VIDEO_STORAGE_RETRY_DELAY || '5000')),
      },
      removeOnComplete: 100,
      removeOnFail: 100,
    },
  });
  const concurrency = Math.max(1, Math.min(4, Number(process.env.VIDEO_STORAGE_MAX_CONCURRENT_DOWNLOADS || '1')));
  queue.process(concurrency, async (job) => {
    await processHighlightIngestion(job.data.highlightlyId);
  });
  return queue;
}

export async function enqueueHighlightIngest(highlightlyId: number): Promise<void> {
  const q = getHighlightIngestQueue();
  if (!q) {
    await processHighlightIngestion(highlightlyId);
    return;
  }
  await q.add({ highlightlyId }, { jobId: `highlight-${highlightlyId}` });
}

export function startHighlightIngestWorker(): void {
  if (process.env.VIDEO_STORAGE_ENABLED !== 'true') {
    logger.info('[HighlightStorage] ingestion disabled');
    return;
  }
  getHighlightIngestQueue();
}
