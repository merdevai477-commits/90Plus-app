import { Queue, Worker, Job } from 'bullmq';
import { env } from '../config/env.js';
import { logger } from './logger.service.js';
import { CONSTANTS } from '../config/constants.js';

export interface AIChatJobData {
  userId: string;
  conversationId: string;
  question: string;
  history: any[];
  systemPrompt: string;
}

class QueueService {
  public aiQueue: Queue;
  private aiWorker: Worker | null = null;

  constructor() {
    // Create the Queue
    this.aiQueue = new Queue('AI_CHAT_QUEUE', {
      connection: {
        url: env.REDIS_URL,
      },
      defaultJobOptions: {
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs for debugging
      },
    });

    logger.info('✅ BullMQ AI_CHAT_QUEUE initialized');
  }

  /**
   * Initializes the worker that processes the queue.
   * This is separated from the constructor so it can be controlled (e.g., during testing).
   */
  startWorker(processor: (job: Job<AIChatJobData>) => Promise<any>) {
    this.aiWorker = new Worker('AI_CHAT_QUEUE', processor, {
      connection: {
        url: env.REDIS_URL,
      },
      concurrency: CONSTANTS.QUEUE.CONCURRENCY,
    });

    this.aiWorker.on('completed', (job) => {
      logger.debug(`✅ Job ${job.id} completed`);
    });

    this.aiWorker.on('failed', (job, err) => {
      logger.error(`❌ Job ${job?.id} failed with error: ${err.message}`);
    });

    logger.info(`✅ BullMQ Worker started with concurrency ${CONSTANTS.QUEUE.CONCURRENCY}`);
  }

  /**
   * Graceful shutdown of queues and workers
   */
  async close() {
    if (this.aiWorker) {
      await this.aiWorker.close();
    }
    await this.aiQueue.close();
    logger.info('🛑 BullMQ connections closed');
  }
}

export const queueService = new QueueService();
