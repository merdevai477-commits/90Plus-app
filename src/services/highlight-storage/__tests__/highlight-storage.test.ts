import { mkdtempSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { assertIngestionTransition, classifySourceUrl, isPrivateAddress } from '../eligibility';
import { resolveHighlightPlayback, storageKeyForAsset } from '../playback';
import { downloadAuthorizedVideo } from '../download';
import { processHighlightIngestion, storageBudgetAllows } from '../ingest';

jest.mock('../../../lib/prisma', () => ({
  __esModule: true,
  default: {
    highlightIngestion: {
      findUnique: jest.fn(),
      updateMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
    highlightStoredAsset: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      aggregate: jest.fn(),
    },
  },
}));

const prisma = jest.requireMock('../../../lib/prisma').default;

describe('highlight storage eligibility', () => {
  const env = {
    VIDEO_STORAGE_ENABLED: 'true',
    VIDEO_STORAGE_ALLOWED_HOSTS: 'c-cdn.streamin.top',
  } as NodeJS.ProcessEnv;

  it('keeps YouTube external only', () => {
    expect(classifySourceUrl('https://www.youtube.com/watch?v=abcdefghijk', env)).toEqual({
      ok: false,
      status: 'EXTERNAL_ONLY',
      code: 'YOUTUBE_EXCLUDED',
    });
  });

  it('rejects private and loopback targets', () => {
    expect(isPrivateAddress('127.0.0.1')).toBe(true);
    expect(isPrivateAddress('10.1.1.1')).toBe(true);
    expect(isPrivateAddress('192.168.1.8')).toBe(true);
    expect(isPrivateAddress('8.8.8.8')).toBe(false);
  });

  it('allowlists only configured direct files', () => {
    expect(classifySourceUrl('https://streamin.link/v/abc123', env).ok).toBe(true);
    expect(classifySourceUrl('https://evil.example/a.mp4', env)).toMatchObject({ code: 'HOST_NOT_ALLOWLISTED' });
    expect(classifySourceUrl('https://c-cdn.streamin.top/uploads/a.mp4', { VIDEO_STORAGE_ENABLED: 'false' })).toMatchObject({
      code: 'STORAGE_DISABLED',
    });
  });

  it('rejects illegal status jumps', () => {
    expect(() => assertIngestionTransition('EXTERNAL_ONLY', 'VERIFIED')).toThrow(/INVALID_TRANSITION/);
    expect(() => assertIngestionTransition('UPLOADING', 'VERIFIED')).not.toThrow();
  });
});

describe('playback resolver', () => {
  it('puts a verified owned URL ahead of the external source', () => {
    expect(resolveHighlightPlayback({
      originalUrl: 'https://c-cdn.streamin.top/uploads/a.mp4',
      ownedUrl: 'https://media.90plus.app/football/2026/11/fixtures/1/assets/abc.mp4',
      verified: true,
    }).playbackUrls[0]).toContain('media.90plus.app');
  });

  it('does not expose an unverified upload', () => {
    const resolved = resolveHighlightPlayback({
      originalUrl: 'https://cdn.example/a.mp4',
      ownedUrl: 'https://media.90plus.app/secret.mp4',
      verified: false,
    });
    expect(resolved.url).toBe('https://cdn.example/a.mp4');
    expect(resolved.playbackUrls).toEqual(['https://cdn.example/a.mp4']);
  });

  it('builds a content-addressed key', () => {
    expect(storageKeyForAsset({
      fixtureId: 42,
      checksum: 'abc',
      contentType: 'video/mp4',
      now: new Date('2026-11-20T00:00:00.000Z'),
    })).toBe('football/2026/11/fixtures/42/assets/abc.mp4');
  });
});

describe('download guards', () => {
  it('stops when the streamed body exceeds the byte cap', async () => {
    const chunk = new Uint8Array(100);
    const fetchImpl = jest.fn(async () => ({
      status: 200,
      headers: { get: (name: string) => (name === 'content-type' ? 'video/mp4' : null) },
      body: {
        getReader: () => {
          let sent = false;
          return {
            read: async () => {
              if (sent) return { done: true, value: undefined };
              sent = true;
              return { done: false, value: chunk };
            },
          };
        },
      },
    })) as unknown as typeof fetch;

    await expect(downloadAuthorizedVideo({
      url: 'https://c-cdn.streamin.top/a.mp4',
      maxBytes: 10,
      fetchImpl,
      resolveHost: async () => [{ address: '1.1.1.1', family: 4 }] as never,
    })).rejects.toThrow('FILE_TOO_LARGE');
  });

  it('does not follow a redirect to a private address', async () => {
    const fetchImpl = jest.fn(async () => ({
      status: 302,
      headers: { get: (name: string) => (name === 'location' ? 'http://127.0.0.1/secret.mp4' : null) },
      body: null,
    })) as unknown as typeof fetch;

    await expect(downloadAuthorizedVideo({
      url: 'https://c-cdn.streamin.top/a.mp4',
      fetchImpl,
      resolveHost: async (host: string) => {
        if (host === '127.0.0.1') return [{ address: '127.0.0.1', family: 4 }] as never;
        return [{ address: '1.1.1.1', family: 4 }] as never;
      },
    })).rejects.toThrow('SSRF_BLOCKED');
  });
});

describe('processHighlightIngestion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.R2_ENDPOINT = 'https://example.r2.cloudflarestorage.com';
    process.env.R2_ACCESS_KEY_ID = 'test';
    process.env.R2_SECRET_ACCESS_KEY = 'test';
    process.env.R2_MEDIA_BUCKET_NAME = 'bucket';
    process.env.R2_MEDIA_PUBLIC_URL = 'https://media.example';
    process.env.VIDEO_STORAGE_MAX_MONTHLY_INGESTION_GB = '5';
    process.env.VIDEO_STORAGE_MAX_TOTAL_GB = '20';
  });

  it('reuses an existing checksum instead of uploading again', async () => {
    prisma.highlightIngestion.findUnique.mockResolvedValue({
      highlightlyId: 9,
      fixtureId: 42,
      originalUrl: 'https://c-cdn.streamin.top/uploads/a.mp4',
      status: 'PENDING_INGESTION',
    });
    prisma.highlightIngestion.updateMany.mockResolvedValue({ count: 1 });
    prisma.highlightStoredAsset.aggregate.mockResolvedValue({ _sum: { fileSize: 0 } });
    prisma.highlightStoredAsset.findUnique.mockResolvedValue({
      id: 'asset-1',
      storageStatus: 'VERIFIED',
      storageKey: 'football/x.mp4',
    });
    prisma.highlightIngestion.update.mockResolvedValue({});

    const dir = mkdtempSync(join(tmpdir(), 'hl-'));
    const filePath = join(dir, 'clip.mp4');
    writeFileSync(filePath, 'same');
    const store = { put: jest.fn(), head: jest.fn(), publicUrl: jest.fn() };
    await processHighlightIngestion(9, {
      store,
      download: async () => ({ filePath, bytes: 4, contentType: 'video/mp4' }),
    });

    expect(store.put).not.toHaveBeenCalled();
  });

  it('stops new ingestion when the storage budget is already spent', async () => {
    prisma.highlightStoredAsset.aggregate.mockResolvedValue({
      _sum: { fileSize: 21 * 1024 * 1024 * 1024 },
    });
    await expect(storageBudgetAllows(1024)).resolves.toBe(false);
  });
});
