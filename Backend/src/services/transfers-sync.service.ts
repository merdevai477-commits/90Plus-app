/**
 * Transfers Sync Service
 * Background job service to sync transfers data from API to database
 * 
 * This service runs periodically to:
 * 1. Update recent transfers (last 30 days) every 6 hours
 * 2. Update older transfers (30+ days) daily
 */

import Queue from 'bull';
import { logger } from '../utils/logger';
import { footballDataCacheService } from './football-data-cache.service';
import { isRedisConnected } from '../lib/redis';

// Create transfers sync queue (only if Redis is available)
let transfersSyncQueue: Queue.Queue | null = null;

// Initialize queue only if Redis is available
function initializeQueue(): void {
    if (transfersSyncQueue) return; // Already initialized
    
    try {
        // Check if Redis is available
        if (!isRedisConnected()) {
            logger.info('[TransfersSync] Redis not available, will use interval-based sync only');
            return;
        }

        const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
        transfersSyncQueue = new Queue('transfers-sync', REDIS_URL);

            transfersSyncQueue.on('error', (error: Error) => {
                logger.error('[TransfersSync] Queue error:', error);
                // Disable queue on persistent errors
                if (error.message?.includes('max retries')) {
                    logger.warn('[TransfersSync] Disabling queue due to persistent errors, using interval-based sync');
                    transfersSyncQueue = null;
                }
            });

        logger.info('[TransfersSync] ✅ Queue initialized');
    } catch (error) {
        logger.warn('[TransfersSync] Failed to initialize Bull Queue, will use interval-based sync:', error);
        transfersSyncQueue = null;
    }
}

// Try to initialize queue (will retry if Redis becomes available later)
initializeQueue();

interface TransfersSyncJobData {
    type: 'recent' | 'old';
    dateRange?: { from: string; to: string };
}

class TransfersSyncService {
    private isRunning = false;
    private recentTransfersInterval: NodeJS.Timeout | null = null;
    private oldTransfersInterval: NodeJS.Timeout | null = null;

    /**
     * Start the transfers sync service
     */
    start(): void {
        if (this.isRunning) {
            logger.warn('[TransfersSync] Service already running');
            return;
        }

        this.isRunning = true;
        logger.info('[TransfersSync] ✅ Service started');

        // Process queue jobs
        this.setupQueueProcessor();

        // Schedule recent transfers sync (every 6 hours)
        this.scheduleRecentTransfersSync();

        // Schedule old transfers sync (daily at 2 AM)
        this.scheduleOldTransfersSync();

        // Run initial sync
        this.syncRecentTransfers();
    }

    /**
     * Stop the transfers sync service
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.recentTransfersInterval) {
            clearInterval(this.recentTransfersInterval);
            this.recentTransfersInterval = null;
        }

        if (this.oldTransfersInterval) {
            clearInterval(this.oldTransfersInterval);
            this.oldTransfersInterval = null;
        }

        // Close queue if available
        if (transfersSyncQueue) {
            transfersSyncQueue.close().catch((err: Error) => {
                logger.error('[TransfersSync] Error closing queue:', err);
            });
        }

        logger.info('[TransfersSync] ⏹️ Service stopped');
    }

    /**
     * Setup queue processor (only if queue is available)
     */
    private setupQueueProcessor(): void {
        if (!transfersSyncQueue) {
            logger.info('[TransfersSync] Queue not available, using interval-based sync only');
            return;
        }

        try {
            transfersSyncQueue.process(async (job: Queue.Job) => {
                const { type, dateRange } = job.data as TransfersSyncJobData;

                try {
                    logger.info(`[TransfersSync] Processing ${type} transfers sync job...`);

                    if (type === 'recent') {
                        await this.syncTransfersByDateRange(dateRange || this.getRecentDateRange());
                    } else if (type === 'old') {
                        await this.syncTransfersByDateRange(dateRange || this.getOldDateRange());
                    }

                    logger.info(`[TransfersSync] ✅ Completed ${type} transfers sync`);
                    return { success: true, type };
                } catch (error) {
                    logger.error(`[TransfersSync] ❌ Error processing ${type} transfers sync:`, error);
                    throw error;
                }
            });

            transfersSyncQueue.on('completed', (job: Queue.Job, result: any) => {
                logger.debug(`[TransfersSync] Job ${job.id} completed:`, result);
            });

            transfersSyncQueue.on('failed', (job: Queue.Job, err: Error) => {
                logger.error(`[TransfersSync] Job ${job.id} failed:`, err);
            });

            transfersSyncQueue.on('error', (error: Error) => {
                logger.error('[TransfersSync] Queue error:', error);
            });
        } catch (error) {
            logger.error('[TransfersSync] Error setting up queue processor:', error);
        }
    }

    /**
     * Schedule recent transfers sync (every 6 hours)
     */
    private scheduleRecentTransfersSync(): void {
        // Run immediately, then every 6 hours
        this.recentTransfersInterval = setInterval(() => {
            this.syncRecentTransfers();
        }, 6 * 60 * 60 * 1000); // 6 hours
    }

    /**
     * Schedule old transfers sync (daily at 2 AM)
     */
    private scheduleOldTransfersSync(): void {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(2, 0, 0, 0);
        
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }

        const msUntilNextRun = nextRun.getTime() - now.getTime();

        setTimeout(() => {
            this.syncOldTransfers();
            
            // Then run daily
            this.oldTransfersInterval = setInterval(() => {
                this.syncOldTransfers();
            }, 24 * 60 * 60 * 1000); // 24 hours
        }, msUntilNextRun);
    }

    /**
     * Sync recent transfers (last 30 days)
     */
    private async syncRecentTransfers(): Promise<void> {
        if (!this.isRunning) return;

        try {
            const dateRange = this.getRecentDateRange();
            logger.info(`[TransfersSync] 🔄 Syncing recent transfers (${dateRange.from} to ${dateRange.to})...`);
            
            // If queue is available, use it; otherwise sync directly
            if (transfersSyncQueue) {
                try {
                    await transfersSyncQueue.add('recent-sync', {
                        type: 'recent',
                        dateRange,
                    }, {
                        attempts: 3,
                        backoff: {
                            type: 'exponential',
                            delay: 5000,
                        },
                    });
                } catch (queueError) {
                    logger.warn('[TransfersSync] Queue error, syncing directly:', queueError);
                    // Fallback to direct sync
                    await this.syncTransfersByDateRange(dateRange);
                }
            } else {
                // Direct sync without queue
                await this.syncTransfersByDateRange(dateRange);
            }
        } catch (error) {
            logger.error('[TransfersSync] Error syncing recent transfers:', error);
        }
    }

    /**
     * Sync old transfers (30+ days ago)
     */
    private async syncOldTransfers(): Promise<void> {
        if (!this.isRunning) return;

        try {
            const dateRange = this.getOldDateRange();
            logger.info(`[TransfersSync] 🔄 Syncing old transfers (${dateRange.from} to ${dateRange.to})...`);
            
            // If queue is available, use it; otherwise sync directly
            if (transfersSyncQueue) {
                try {
                    await transfersSyncQueue.add('old-sync', {
                        type: 'old',
                        dateRange,
                    }, {
                        attempts: 2,
                        backoff: {
                            type: 'exponential',
                            delay: 10000,
                        },
                    });
                } catch (queueError) {
                    logger.warn('[TransfersSync] Queue error, syncing directly:', queueError);
                    // Fallback to direct sync
                    await this.syncTransfersByDateRange(dateRange);
                }
            } else {
                // Direct sync without queue
                await this.syncTransfersByDateRange(dateRange);
            }
        } catch (error) {
            logger.error('[TransfersSync] Error syncing old transfers:', error);
        }
    }

    /**
     * Sync transfers by date range
     */
    private async syncTransfersByDateRange(dateRange: { from: string; to: string }): Promise<void> {
        try {
            // Use the existing getTransfersByLeagues which will cache in database
            await footballDataCacheService.getTransfersByLeagues(undefined, dateRange);
            logger.info(`[TransfersSync] ✅ Synced transfers for date range ${dateRange.from} to ${dateRange.to}`);
        } catch (error) {
            logger.error('[TransfersSync] Error syncing transfers:', error);
            throw error;
        }
    }

    /**
     * Get recent date range (last 30 days)
     */
    private getRecentDateRange(): { from: string; to: string } {
        const now = new Date();
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        return {
            from: thirtyDaysAgo.toISOString().split('T')[0],
            to: now.toISOString().split('T')[0],
        };
    }

    /**
     * Get old date range (30+ days ago, up to 1 year)
     */
    private getOldDateRange(): { from: string; to: string } {
        const now = new Date();
        const oneYearAgo = new Date(now);
        oneYearAgo.setFullYear(now.getFullYear() - 1);
        
        const thirtyDaysAgo = new Date(now);
        thirtyDaysAgo.setDate(now.getDate() - 30);

        return {
            from: oneYearAgo.toISOString().split('T')[0],
            to: thirtyDaysAgo.toISOString().split('T')[0],
        };
    }
}

export const transfersSyncService = new TransfersSyncService();

