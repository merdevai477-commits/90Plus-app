import Bull, { type Queue } from 'bull';
import { bullCreateClient } from '../../lib/bull-redis';
import { logger } from '../../utils/logger';
import { matchChatIncr } from './match-chat.metrics';
import { persistMatchChatMessage, type PersistMatchChatMessageInput } from './match-chat.repository';

let queue: Queue<PersistMatchChatMessageInput> | null = null;
let processorStarted = false;

export function getMatchChatPersistQueue(): Queue<PersistMatchChatMessageInput> | null {
  if (queue) return queue;
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    logger.warn('[match-chat] REDIS_URL missing — persist queue disabled (in-process fallback)');
    return null;
  }
  queue = new Bull<PersistMatchChatMessageInput>('match-chat-persist', {
    createClient: bullCreateClient(redisUrl),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 500 },
      removeOnComplete: 100,
      removeOnFail: 200,
    },
  });
  return queue;
}

async function persistJob(data: PersistMatchChatMessageInput): Promise<void> {
  try {
    await persistMatchChatMessage(data);
    matchChatIncr('persistOk');
  } catch (err: unknown) {
    const code = typeof err === 'object' && err && 'code' in err ? (err as { code?: string }).code : undefined;
    if (code === 'P2002') {
      matchChatIncr('persistOk');
      return;
    }
    matchChatIncr('persistFail');
    throw err;
  }
}

export function startMatchChatPersistWorker(): void {
  if (processorStarted) return;
  processorStarted = true;
  const q = getMatchChatPersistQueue();
  if (!q) return;
  q.process(8, async (job) => {
    await persistJob(job.data);
  });
  q.on('failed', (job, err) => {
    logger.warn('[match-chat] persist job failed', { id: job?.id, err: err?.message });
  });
}

export async function enqueueMatchChatPersist(data: PersistMatchChatMessageInput): Promise<void> {
  const q = getMatchChatPersistQueue();
  if (q) {
    await q.add(data, { jobId: `${data.userId}-${data.clientMessageId}` });
    return;
  }
  setImmediate(() => {
    void persistJob(data).catch((err) => {
      logger.warn('[match-chat] in-process persist failed', { err: (err as Error)?.message });
    });
  });
}
