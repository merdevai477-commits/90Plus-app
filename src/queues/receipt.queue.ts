import Bull, { Queue } from 'bull';
import Redis from 'ioredis';
import { logger } from '../utils/logger';
import { checkPushReceipts } from '../services/push-notification.service';

interface ReceiptJob {
    receiptIds: string[];
}

function createBullRedis(redisUrl: string): Redis {
    return new Redis(redisUrl, {
        enableReadyCheck: false,
        maxRetriesPerRequest: null,
    });
}

let receiptQueue: Queue<ReceiptJob> | null = null;

export function getReceiptQueue(): Queue<ReceiptJob> | null {
    if (receiptQueue) return receiptQueue;

    const redisUrl = process.env.REDIS_URL;
    if (!redisUrl) {
        logger.warn('⚠️ REDIS_URL not set - receipt queue disabled');
        return null;
    }

    receiptQueue = new Bull<ReceiptJob>('expo-receipts', {
        createClient: (type) => createBullRedis(redisUrl),
    });

    receiptQueue.process(async (job) => {
        const { receiptIds } = job.data;
        logger.info(`🧾 Checking ${receiptIds.length} Expo push receipts...`);
        await checkPushReceipts(receiptIds);
    });

    receiptQueue.on('failed', (job, err) => {
        logger.error(`Receipt job ${job.id} failed:`, err.message);
    });

    receiptQueue.on('error', (err) => {
        logger.warn('Receipt queue error:', err);
    });

    return receiptQueue;
}
