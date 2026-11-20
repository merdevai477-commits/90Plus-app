import { createWriteStream } from 'fs';
import { unlink } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { assertPublicHttpUrl, maxFileBytes } from './eligibility';

export type DownloadResult = { filePath: string; bytes: number; contentType: string };

const ALLOWED_TYPES = ['video/mp4', 'application/mp4', 'video/quicktime', 'application/vnd.apple.mpegurl', 'application/x-mpegurl', 'application/octet-stream'];

export async function downloadAuthorizedVideo(input: {
  url: string;
  timeoutMs?: number;
  maxBytes?: number;
  fetchImpl?: typeof fetch;
  resolveHost?: Parameters<typeof assertPublicHttpUrl>[1];
}): Promise<DownloadResult> {
  const fetchImpl = input.fetchImpl ?? fetch;
  const maxBytes = input.maxBytes ?? maxFileBytes();
  const timeoutMs = input.timeoutMs ?? 20_000;
  let current = input.url;
  let response: Response | null = null;

  for (let hop = 0; hop < 4; hop += 1) {
    await assertPublicHttpUrl(current, input.resolveHost);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      response = await fetchImpl(current, {
        method: 'GET',
        redirect: 'manual',
        signal: controller.signal,
        headers: { Accept: 'video/mp4,application/vnd.apple.mpegurl,*/*' },
      });
    } finally {
      clearTimeout(timer);
    }
    const location = response.headers.get('location');
    if (response.status >= 300 && response.status < 400 && location) {
      current = new URL(location, current).toString();
      continue;
    }
    break;
  }

  if (!response) throw new Error('DOWNLOAD_FAILED');
  if (response.status === 404) throw new Error('SOURCE_NOT_FOUND');
  if (response.status === 410) throw new Error('SOURCE_EXPIRED');
  if (response.status !== 200 && response.status !== 206) throw new Error(`HTTP_${response.status}`);

  const contentType = (response.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const urlLooksMedia = /\.(mp4|m3u8)(?:$|\?)/i.test(current);
  if (contentType && !ALLOWED_TYPES.includes(contentType) && !(contentType === 'application/octet-stream' && urlLooksMedia)) {
    throw new Error('INVALID_CONTENT_TYPE');
  }
  if (!contentType && !urlLooksMedia) throw new Error('INVALID_CONTENT_TYPE');

  const filePath = join(tmpdir(), `highlight-${randomUUID()}.bin`);
  const body = response.body;
  if (!body) throw new Error('EMPTY_BODY');

  let bytes = 0;
  const stream = createWriteStream(filePath);
  try {
    const reader = body.getReader();
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > maxBytes) {
        throw new Error('FILE_TOO_LARGE');
      }
      if (!stream.write(Buffer.from(chunk.value))) {
        await new Promise<void>((resolve) => {
          stream.once('drain', () => resolve());
        });
      }
    }
    await new Promise<void>((resolve, reject) => {
      stream.end(() => resolve());
      stream.on('error', reject);
    });
  } catch (error) {
    stream.destroy();
    await unlink(filePath).catch(() => undefined);
    throw error;
  }

  return { filePath, bytes, contentType: contentType || 'video/mp4' };
}
