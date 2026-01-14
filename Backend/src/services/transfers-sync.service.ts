/**
 * Transfers Sync Service
 * Background job service to sync transfers data from API to database
 * 
 * Schedule:
 * 1. Weekly full sync: Every Sunday at 3 AM (checks for new transfers)
 * 2. Daily quick check: Every day at 6 AM (only recent transfers)
 * 
 * Smart sync: Only updates if new data is available
 */

import Queue from 'bull';
import { logger } from '../utils/logger';
import { footballDataCacheService } from './football-data-cache.service';
import { footballService } from './football.service';
import { isRedisConnected } from '../lib/redis';
import { prisma } from '../lib/prisma';

// Create transfers sync queue (only if Redis is available)
let transfersSyncQueue: Queue.Queue | null = null;
let queueInitialized = false;

// ✅ Initialize queue only when service starts (not at import time)
function initializeQueue(): void {
    if (queueInitialized || transfersSyncQueue) {
        return; // Already initialized
    }
    
    queueInitialized = true;
    
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

// ✅ Removed top-level execution - queue will be initialized in start() method

interface TransfersSyncJobData {
    type: 'weekly' | 'daily' | 'manual';
    force?: boolean;
}

interface SyncStats {
    lastSyncDate: Date | null;
    totalTransfersInDb: number;
    newTransfersFound: number;
    syncDuration: number;
}

class TransfersSyncService {
    private isRunning = false;
    private isSyncing = false;
    private weeklyInterval: NodeJS.Timeout | null = null;
    private dailyInterval: NodeJS.Timeout | null = null;
    private lastSyncStats: SyncStats | null = null;

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

        // ✅ Initialize queue on start (not at import time)
        initializeQueue();

        // Process queue jobs
        this.setupQueueProcessor();

        // Schedule weekly full sync (Sunday at 3 AM)
        this.scheduleWeeklySync();

        // Schedule daily quick check (every day at 6 AM)
        this.scheduleDailyCheck();

        // Run initial check (delayed by 1 minute to let server start)
        setTimeout(() => {
            this.runInitialCheck();
        }, 60 * 1000);
    }

    /**
     * Stop the transfers sync service
     */
    stop(): void {
        if (!this.isRunning) return;

        this.isRunning = false;

        if (this.weeklyInterval) {
            clearInterval(this.weeklyInterval);
            this.weeklyInterval = null;
        }

        if (this.dailyInterval) {
            clearInterval(this.dailyInterval);
            this.dailyInterval = null;
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
     * Get sync status
     */
    getStatus(): { isRunning: boolean; isSyncing: boolean; lastSync: SyncStats | null } {
        return {
            isRunning: this.isRunning,
            isSyncing: this.isSyncing,
            lastSync: this.lastSyncStats,
        };
    }

    /**
     * Manual sync trigger (for admin use)
     */
    async triggerManualSync(force = false): Promise<SyncStats> {
        logger.info(`[TransfersSync] 🔄 Manual sync triggered (force: ${force})`);
        return this.performFullSync(force);
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
                const { type, force } = job.data as TransfersSyncJobData;

                try {
                    logger.info(`[TransfersSync] Processing ${type} sync job...`);

                    if (type === 'weekly' || type === 'manual') {
                        await this.performFullSync(force || false);
                    } else if (type === 'daily') {
                        await this.performQuickCheck();
                    }

                    logger.info(`[TransfersSync] ✅ Completed ${type} sync`);
                    return { success: true, type, stats: this.lastSyncStats };
                } catch (error) {
                    logger.error(`[TransfersSync] ❌ Error processing ${type} sync:`, error);
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
     * Schedule weekly full sync (Sunday at 3 AM)
     */
    private scheduleWeeklySync(): void {
        const now = new Date();
        const nextSunday = new Date();
        
        // Find next Sunday
        const daysUntilSunday = (7 - now.getDay()) % 7 || 7;
        nextSunday.setDate(now.getDate() + daysUntilSunday);
        nextSunday.setHours(3, 0, 0, 0);
        
        // If it's already past 3 AM on Sunday, schedule for next week
        if (nextSunday <= now) {
            nextSunday.setDate(nextSunday.getDate() + 7);
        }

        const msUntilNextRun = nextSunday.getTime() - now.getTime();
        const hoursUntil = Math.round(msUntilNextRun / (1000 * 60 * 60));

        logger.info(`[TransfersSync] 📅 Weekly sync scheduled for ${nextSunday.toISOString()} (in ${hoursUntil} hours)`);

        setTimeout(() => {
            this.runWeeklySync();
            
            // Then run every week (7 days)
            this.weeklyInterval = setInterval(() => {
                this.runWeeklySync();
            }, 7 * 24 * 60 * 60 * 1000);
        }, msUntilNextRun);
    }

    /**
     * Schedule daily quick check (every day at 6 AM)
     */
    private scheduleDailyCheck(): void {
        const now = new Date();
        const nextRun = new Date();
        nextRun.setHours(6, 0, 0, 0);
        
        if (nextRun <= now) {
            nextRun.setDate(nextRun.getDate() + 1);
        }

        const msUntilNextRun = nextRun.getTime() - now.getTime();
        const hoursUntil = Math.round(msUntilNextRun / (1000 * 60 * 60));

        logger.info(`[TransfersSync] 📅 Daily check scheduled for ${nextRun.toISOString()} (in ${hoursUntil} hours)`);

        setTimeout(() => {
            this.runDailyCheck();
            
            // Then run daily
            this.dailyInterval = setInterval(() => {
                this.runDailyCheck();
            }, 24 * 60 * 60 * 1000);
        }, msUntilNextRun);
    }

    /**
     * Run initial check on startup
     */
    private async runInitialCheck(): Promise<void> {
        if (!this.isRunning) return;

        try {
            // Check if database has any transfers
            const count = await this.getTransfersCount();
            
            if (count === 0) {
                logger.info('[TransfersSync] 🆕 Database is empty, running initial full sync...');
                await this.performFullSync(true);
            } else {
                logger.info(`[TransfersSync] ✅ Database has ${count} transfers, skipping initial sync`);
                // Just do a quick check for new transfers
                await this.performQuickCheck();
            }
        } catch (error) {
            logger.error('[TransfersSync] Error in initial check:', error);
        }
    }

    /**
     * Run weekly full sync
     */
    private async runWeeklySync(): Promise<void> {
        if (!this.isRunning) return;

        logger.info('[TransfersSync] 🔄 Starting weekly full sync...');

        if (transfersSyncQueue) {
            try {
                await transfersSyncQueue.add('weekly-sync', {
                    type: 'weekly',
                    force: false,
                }, {
                    attempts: 3,
                    backoff: {
                        type: 'exponential',
                        delay: 60000, // 1 minute
                    },
                });
            } catch (queueError) {
                logger.warn('[TransfersSync] Queue error, syncing directly:', queueError);
                await this.performFullSync(false);
            }
        } else {
            await this.performFullSync(false);
        }
    }

    /**
     * Run daily quick check
     */
    private async runDailyCheck(): Promise<void> {
        if (!this.isRunning) return;

        logger.info('[TransfersSync] 🔍 Starting daily quick check...');

        if (transfersSyncQueue) {
            try {
                await transfersSyncQueue.add('daily-check', {
                    type: 'daily',
                }, {
                    attempts: 2,
                    backoff: {
                        type: 'exponential',
                        delay: 30000,
                    },
                });
            } catch (queueError) {
                logger.warn('[TransfersSync] Queue error, checking directly:', queueError);
                await this.performQuickCheck();
            }
        } else {
            await this.performQuickCheck();
        }
    }

    /**
     * Perform full sync - fetches all transfers and saves new ones
     */
    private async performFullSync(force: boolean): Promise<SyncStats> {
        if (this.isSyncing && !force) {
            logger.warn('[TransfersSync] Sync already in progress, skipping...');
            return this.lastSyncStats || {
                lastSyncDate: null,
                totalTransfersInDb: 0,
                newTransfersFound: 0,
                syncDuration: 0,
            };
        }

        this.isSyncing = true;
        const startTime = Date.now();
        let newTransfersFound = 0;

        try {
            // Check if API is configured
            if (!footballService.isConfigured()) {
                logger.warn('[TransfersSync] Football API not configured, skipping sync');
                return {
                    lastSyncDate: new Date(),
                    totalTransfersInDb: await this.getTransfersCount(),
                    newTransfersFound: 0,
                    syncDuration: Date.now() - startTime,
                };
            }

            // Get current count
            const beforeCount = await this.getTransfersCount();
            logger.info(`[TransfersSync] 📊 Current transfers in DB: ${beforeCount}`);

            // Fetch transfers from API
            logger.info('[TransfersSync] 📡 Fetching transfers from API...');
            const transfers = await footballService.getTransfers({});

            if (transfers && transfers.length > 0) {
                logger.info(`[TransfersSync] 📥 Received ${transfers.length} transfers from API`);
                
                // Save to database
                newTransfersFound = await footballDataCacheService.syncTransfersToDatabase(transfers);
                
                logger.info(`[TransfersSync] 💾 Saved ${newTransfersFound} new transfers to database`);
            } else {
                logger.info('[TransfersSync] ℹ️ No transfers received from API');
            }

            // Get final count
            const afterCount = await this.getTransfersCount();
            const duration = Date.now() - startTime;

            this.lastSyncStats = {
                lastSyncDate: new Date(),
                totalTransfersInDb: afterCount,
                newTransfersFound,
                syncDuration: duration,
            };

            logger.info(`[TransfersSync] ✅ Full sync completed in ${Math.round(duration / 1000)}s - Total: ${afterCount}, New: ${newTransfersFound}`);

            return this.lastSyncStats;
        } catch (error) {
            logger.error('[TransfersSync] ❌ Error in full sync:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Perform quick check - only checks for recent transfers
     */
    private async performQuickCheck(): Promise<SyncStats> {
        if (this.isSyncing) {
            logger.warn('[TransfersSync] Sync already in progress, skipping quick check...');
            return this.lastSyncStats || {
                lastSyncDate: null,
                totalTransfersInDb: 0,
                newTransfersFound: 0,
                syncDuration: 0,
            };
        }

        this.isSyncing = true;
        const startTime = Date.now();
        let newTransfersFound = 0;

        try {
            // Check if API is configured
            if (!footballService.isConfigured()) {
                logger.warn('[TransfersSync] Football API not configured, skipping check');
                return {
                    lastSyncDate: new Date(),
                    totalTransfersInDb: await this.getTransfersCount(),
                    newTransfersFound: 0,
                    syncDuration: Date.now() - startTime,
                };
            }

            // Get the most recent transfer date in our database
            const latestTransfer = await this.getLatestTransferDate();
            
            if (latestTransfer) {
                logger.info(`[TransfersSync] 📅 Latest transfer in DB: ${latestTransfer}`);
            }

            // Fetch recent transfers from API
            // Note: API-Football requires at least one parameter (team or player)
            // For quick check, we skip API call and rely on database sync from other sources
            logger.info('[TransfersSync] 📡 Quick check: Skipping API call (requires team/player parameter)');
            logger.info('[TransfersSync] ℹ️ New transfers will be synced via full sync or manual sync endpoints');
            
            // Return stats without API call
            const transfers: any[] = [];
                // Filter to only new transfers (if we have a latest date)
                let newTransfers = transfers;
                
                if (latestTransfer) {
                    newTransfers = transfers.filter((t: any) => {
                        const updateDate = t.update;
                        if (!updateDate) return true; // Include if no date
                        
                        // Parse the date (format: YYMMDD or YYYY-MM-DD)
                        let transferDate: Date;
                        if (updateDate.includes('-')) {
                            transferDate = new Date(updateDate);
                        } else {
                            // YYMMDD format
                            const year = parseInt(updateDate.substring(0, 2)) + 2000;
                            const month = parseInt(updateDate.substring(2, 4)) - 1;
                            const day = parseInt(updateDate.substring(4, 6));
                            transferDate = new Date(year, month, day);
                        }
                        
                        return transferDate >= latestTransfer;
                    });
                }

                if (newTransfers.length > 0) {
                    logger.info(`[TransfersSync] 📥 Found ${newTransfers.length} potentially new transfers`);
                    newTransfersFound = await footballDataCacheService.syncTransfersToDatabase(newTransfers);
                    logger.info(`[TransfersSync] 💾 Saved ${newTransfersFound} new transfers`);
                } else {
                    logger.info('[TransfersSync] ℹ️ No new transfers found');
                }
            }

            const afterCount = await this.getTransfersCount();
            const duration = Date.now() - startTime;

            this.lastSyncStats = {
                lastSyncDate: new Date(),
                totalTransfersInDb: afterCount,
                newTransfersFound,
                syncDuration: duration,
            };

            logger.info(`[TransfersSync] ✅ Quick check completed in ${Math.round(duration / 1000)}s - New: ${newTransfersFound}`);

            return this.lastSyncStats;
        } catch (error) {
            logger.error('[TransfersSync] ❌ Error in quick check:', error);
            throw error;
        } finally {
            this.isSyncing = false;
        }
    }

    /**
     * Get total transfers count in database
     */
    private async getTransfersCount(): Promise<number> {
        try {
            return await prisma.cachedTransfer.count();
        } catch (error: any) {
            if (error?.code === 'P2021') {
                // Table doesn't exist
                return 0;
            }
            throw error;
        }
    }

    /**
     * Get the latest transfer date in database
     */
    private async getLatestTransferDate(): Promise<Date | null> {
        try {
            const latest = await prisma.cachedTransfer.findFirst({
                orderBy: { updatedAt: 'desc' },
                select: { updatedAt: true },
            });
            return latest?.updatedAt || null;
        } catch (error: any) {
            if (error?.code === 'P2021') {
                return null;
            }
            throw error;
        }
    }
}

export const transfersSyncService = new TransfersSyncService();
