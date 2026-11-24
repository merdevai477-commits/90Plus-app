import { createHash } from 'crypto';
import { createReadStream } from 'fs';
import { unlink } from 'fs/promises';
import prisma from '../../lib/prisma';
import { logger } from '../../utils/logger';
import { downloadAuthorizedVideo } from './download';
import {
  assertIngestionTransition,
  authorizedDirectPlaybackCandidates,
  classifySourceUrl,
  type IngestionStatus,
  videoStorageEnabled,
} from './eligibility';
import { createR2ObjectStore, r2Configured, type ObjectStore } from './object-store';
import { storageKeyForAsset } from './playback';

const CLAIMABLE = ['PENDING_INGESTION', 'FAILED'];

export async function storageBudgetAllows(nextBytes: number, env: NodeJS.ProcessEnv = process.env): Promise<boolean> {
  const monthGb = Number(env.VIDEO_STORAGE_MAX_MONTHLY_INGESTION_GB || '5');
  const totalGb = Number(env.VIDEO_STORAGE_MAX_TOTAL_GB || '20');
  const monthStart = new Date();
  monthStart.setUTCDate(1);
  monthStart.setUTCHours(0, 0, 0, 0);
  const [month, total] = await Promise.all([
    prisma.highlightStoredAsset.aggregate({
      where: { storageStatus: 'VERIFIED', createdAt: { gte: monthStart } },
      _sum: { fileSize: true },
    }),
    prisma.highlightStoredAsset.aggregate({
      where: { storageStatus: 'VERIFIED' },
      _sum: { fileSize: true },
    }),
  ]);
  const monthBytes = month._sum.fileSize || 0;
  const totalBytes = total._sum.fileSize || 0;
  return monthBytes + nextBytes <= monthGb * 1024 * 1024 * 1024
    && totalBytes + nextBytes <= totalGb * 1024 * 1024 * 1024;
}

export async function noteClipForStorage(input: {
  highlightlyId: number;
  fixtureId: number | null;
  url: string;
}): Promise<void> {
  const existing = await prisma.highlightIngestion.findUnique({
    where: { highlightlyId: input.highlightlyId },
    select: { status: true },
  });
  if (existing && (existing.status === 'VERIFIED' || existing.status === 'QUARANTINED' || existing.status === 'DOWNLOADING' || existing.status === 'UPLOADING')) {
    return;
  }
  const decision = classifySourceUrl(input.url);
  const status: IngestionStatus = decision.ok ? 'PENDING_INGESTION' : 'EXTERNAL_ONLY';
  const originalUrl = decision.ok ? decision.url : input.url;
  await prisma.highlightIngestion.upsert({
    where: { highlightlyId: input.highlightlyId },
    create: {
      highlightlyId: input.highlightlyId,
      fixtureId: input.fixtureId,
      originalUrl,
      status,
      lastErrorCode: decision.ok ? null : decision.code,
    },
    update: {
      fixtureId: input.fixtureId,
      originalUrl,
      status,
      lastErrorCode: decision.ok ? null : decision.code,
    },
  });
  if (!decision.ok || !videoStorageEnabled()) return;
  const { enqueueHighlightIngest } = await import('../../queues/highlight-video-ingest.queue');
  await enqueueHighlightIngest(input.highlightlyId);
}

async function sha256File(filePath: string): Promise<string> {
  const hash = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('error', reject);
    stream.on('end', () => resolve());
  });
  return hash.digest('hex');
}

async function setStatus(
  highlightlyId: number,
  from: IngestionStatus,
  to: IngestionStatus,
  data: { assetId?: string | null; lastErrorCode?: string | null; attempts?: number } = {},
): Promise<void> {
  assertIngestionTransition(from, to);
  await prisma.highlightIngestion.update({
    where: { highlightlyId },
    data: { status: to, ...data },
  });
}

export async function processHighlightIngestion(
  highlightlyId: number,
  deps: { store?: ObjectStore; download?: typeof downloadAuthorizedVideo } = {},
): Promise<void> {
  const row = await prisma.highlightIngestion.findUnique({ where: { highlightlyId } });
  if (!row) return;
  if (row.status === 'VERIFIED' || row.status === 'EXTERNAL_ONLY' || row.status === 'QUARANTINED') return;

  const claimed = await prisma.highlightIngestion.updateMany({
    where: { highlightlyId, status: { in: CLAIMABLE } },
    data: { status: 'DOWNLOADING', attempts: { increment: 1 }, lastErrorCode: null },
  });
  if (claimed.count !== 1) return;

  const fromStatus: IngestionStatus = 'DOWNLOADING';
  let filePath = '';
  try {
    if (!r2Configured()) {
      await setStatus(highlightlyId, fromStatus, 'FAILED', { lastErrorCode: 'R2_UNCONFIGURED' });
      return;
    }
    const download = deps.download ?? downloadAuthorizedVideo;
    const candidates = authorizedDirectPlaybackCandidates(row.originalUrl);
    let downloaded: Awaited<ReturnType<typeof downloadAuthorizedVideo>> | null = null;
    let lastDownloadError: unknown = null;
    for (const candidate of candidates) {
      try {
        downloaded = await download({ url: candidate });
        break;
      } catch (error) {
        lastDownloadError = error;
      }
    }
    if (!downloaded) throw lastDownloadError instanceof Error ? lastDownloadError : new Error('DOWNLOAD_FAILED');
    const allowed = await storageBudgetAllows(downloaded.bytes);
    if (!allowed) {
      await setStatus(highlightlyId, fromStatus, 'FAILED', { lastErrorCode: 'BUDGET_EXCEEDED' });
      logger.warn('[HighlightStorage] budget exceeded', { highlightlyId });
      return;
    }
    filePath = downloaded.filePath;
    const checksum = await sha256File(filePath);
    const existing = await prisma.highlightStoredAsset.findUnique({ where: { checksum } });
    if (existing?.storageStatus === 'VERIFIED') {
      await setStatus(highlightlyId, 'DOWNLOADING', 'VERIFIED', { assetId: existing.id, lastErrorCode: null });
      logger.info('[HighlightStorage] VIDEO_CHECKSUM_MATCHED', { highlightlyId, fixtureId: row.fixtureId });
      return;
    }

    const key = existing?.storageKey || storageKeyForAsset({
      fixtureId: row.fixtureId,
      checksum,
      contentType: downloaded.contentType,
    });
    await setStatus(highlightlyId, 'DOWNLOADING', 'UPLOADING');
    const store = deps.store ?? createR2ObjectStore();
    if (!existing) {
      await store.put(key, filePath, downloaded.contentType);
    }
    const head = await store.head(key);
    if (!head || head.contentLength !== downloaded.bytes) {
      await setStatus(highlightlyId, 'UPLOADING', 'FAILED', { lastErrorCode: 'VERIFY_FAILED' });
      return;
    }
    const asset = existing ?? await prisma.highlightStoredAsset.create({
      data: {
        checksum,
        storageKey: key,
        storageStatus: 'STORED',
        contentType: downloaded.contentType,
        fileSize: downloaded.bytes,
      },
    }).catch(async (error: { code?: string }) => {
      if (error?.code === 'P2002') {
        const raced = await prisma.highlightStoredAsset.findUnique({ where: { checksum } });
        if (raced) return raced;
      }
      throw error;
    });
    await prisma.highlightStoredAsset.update({
      where: { id: asset.id },
      data: { storageStatus: 'VERIFIED', verifiedAt: new Date(), fileSize: downloaded.bytes },
    });
    await setStatus(highlightlyId, 'UPLOADING', 'VERIFIED', { assetId: asset.id, lastErrorCode: null });
    logger.info('[HighlightStorage] VIDEO_STORAGE_VERIFIED', {
      highlightlyId,
      fixtureId: row.fixtureId,
      bytes: downloaded.bytes,
    });
  } catch (error) {
    const code = error instanceof Error ? error.message.slice(0, 80) : 'DOWNLOAD_FAILED';
    const current = await prisma.highlightIngestion.findUnique({ where: { highlightlyId } });
    const from = (current?.status || 'DOWNLOADING') as IngestionStatus;
    if (from === 'DOWNLOADING' || from === 'UPLOADING' || from === 'FAILED') {
      const target: IngestionStatus = code === 'SOURCE_NOT_FOUND' || code === 'SOURCE_EXPIRED' ? 'UNAVAILABLE' : 'FAILED';
      if (from !== target) {
        await setStatus(highlightlyId, from === 'FAILED' ? 'FAILED' : from, target, { lastErrorCode: code }).catch(() => undefined);
      }
    }
    logger.warn('[HighlightStorage] VIDEO_DOWNLOAD_FAILED', { highlightlyId, code });
  } finally {
    if (filePath) await unlink(filePath).catch(() => undefined);
  }
}
