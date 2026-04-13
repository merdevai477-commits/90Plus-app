/**
 * Upload Analytics Service  (Fix 12)
 *
 * Tracks every upload attempt (start + end) in the UploadEvent table.
 * Provides admin stats endpoint data.
 */

import prisma from '../lib/prisma';
import { logger } from '../utils/logger';

export type UploadType = 'AVATAR' | 'COVER' | 'REEL';
export type UploadStatus = 'SUCCESS' | 'FAILED' | 'TIMEOUT';

export interface UploadEventRecord {
  userId: string;
  type: UploadType;
  status: UploadStatus;
  fileSizeMB: number;
  durationMs: number;
  errorCode?: string;
}

export class UploadAnalyticsService {
  static async record(event: UploadEventRecord): Promise<void> {
    try {
      await prisma.uploadEvent.create({
        data: {
          userId: event.userId,
          type: event.type as any,
          status: event.status as any,
          fileSizeMB: event.fileSizeMB,
          durationMs: event.durationMs,
          errorCode: event.errorCode ?? null,
        },
      });
    } catch (err) {
      logger.warn('[UploadAnalytics] Failed to record event (non-fatal):', err);
    }
  }

  /**
   * Admin stats for the last N days.
   */
  static async getStats(days = 7): Promise<{
    period: string;
    byType: {
      type: string;
      total: number;
      success: number;
      failed: number;
      timeout: number;
      successRate: string;
      avgDurationMs: number;
      avgFileSizeMB: number;
    }[];
    topErrors: { errorCode: string; count: number }[];
    totalStorageUsedGB: number;
  }> {
    const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const [events, topErrors, storageRow] = await Promise.all([
      prisma.uploadEvent.findMany({
        where: { createdAt: { gte: since } },
        select: { type: true, status: true, durationMs: true, fileSizeMB: true },
      }),
      prisma.uploadEvent.groupBy({
        by: ['errorCode'],
        where: { createdAt: { gte: since }, errorCode: { not: null } },
        _count: { id: true },
        orderBy: { _count: { id: 'desc' } },
        take: 10,
      }),
      prisma.user.aggregate({ _sum: { storageUsedBytes: true } }),
    ]);

    // Group by type
    const grouped: Record<string, typeof events> = {};
    for (const e of events) {
      if (!grouped[e.type]) grouped[e.type] = [];
      grouped[e.type].push(e);
    }

    const byType = Object.entries(grouped).map(([type, rows]) => {
      const success = rows.filter((r) => r.status === 'SUCCESS').length;
      const failed = rows.filter((r) => r.status === 'FAILED').length;
      const timeout = rows.filter((r) => r.status === 'TIMEOUT').length;
      const avgDurationMs =
        rows.reduce((s, r) => s + r.durationMs, 0) / (rows.length || 1);
      const avgFileSizeMB =
        rows.reduce((s, r) => s + r.fileSizeMB, 0) / (rows.length || 1);

      return {
        type,
        total: rows.length,
        success,
        failed,
        timeout,
        successRate: rows.length ? `${((success / rows.length) * 100).toFixed(1)}%` : '0%',
        avgDurationMs: Math.round(avgDurationMs),
        avgFileSizeMB: parseFloat(avgFileSizeMB.toFixed(2)),
      };
    });

    const totalBytes = Number(storageRow._sum.storageUsedBytes ?? 0);
    const totalStorageUsedGB = parseFloat((totalBytes / 1e9).toFixed(3));

    return {
      period: `${days} days`,
      byType,
      topErrors: topErrors.map((e: any) => ({
        errorCode: e.errorCode ?? 'unknown',
        count: e._count.id,
      })),
      totalStorageUsedGB,
    };
  }
}
