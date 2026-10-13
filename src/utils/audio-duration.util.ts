/**
 * Identify an uploaded voice clip from its bytes and measure its real
 * duration, without trusting the filename, MIME type or client metadata.
 *
 * Only the formats the app records are accepted:
 *   - WAV (PCM)  — iOS. Duration = actual payload bytes / (rate × channels × bytes per sample).
 *   - ADTS AAC   — Android. Duration = frames actually present × 1024 samples / rate.
 * Container formats whose duration lives only in a header field (MP4/M4A)
 * are rejected, since that field could under-report a long clip.
 */

export type AudioInspection =
  | { ok: true; format: 'wav' | 'aac'; mimeType: string; durationSec: number }
  | { ok: false; reason: 'unsupported' | 'malformed' | 'empty' };

const ADTS_SAMPLE_RATES = [
  96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350,
];
const SAMPLES_PER_AAC_BLOCK = 1024;
/** Junk tolerated after the last ADTS frame (a truncated final frame). */
const ADTS_MAX_TAIL_BYTES = 2048;

function isWav(buf: Buffer): boolean {
  return (
    buf.length >= 12 &&
    buf.toString('ascii', 0, 4) === 'RIFF' &&
    buf.toString('ascii', 8, 12) === 'WAVE'
  );
}

function inspectWav(buf: Buffer): AudioInspection {
  let offset = 12;
  let bytesPerSecond = 0;
  while (offset + 8 <= buf.length) {
    const id = buf.toString('ascii', offset, offset + 4);
    const size = buf.readUInt32LE(offset + 4);
    const body = offset + 8;

    if (id === 'fmt ') {
      if (body + 16 > buf.length) return { ok: false, reason: 'malformed' };
      const audioFormat = buf.readUInt16LE(body);
      const channels = buf.readUInt16LE(body + 2);
      const sampleRate = buf.readUInt32LE(body + 4);
      const bitsPerSample = buf.readUInt16LE(body + 14);
      // 1 = PCM, 3 = IEEE float, 0xFFFE = extensible (PCM payload in practice).
      if (![1, 3, 0xfffe].includes(audioFormat)) return { ok: false, reason: 'unsupported' };
      if (!channels || !sampleRate || !bitsPerSample) return { ok: false, reason: 'malformed' };
      bytesPerSecond = sampleRate * channels * (bitsPerSample / 8);
    } else if (id === 'data') {
      if (!bytesPerSecond) return { ok: false, reason: 'malformed' };
      // Recorders sometimes leave the size unset; the bytes actually sent are what counts.
      const available = buf.length - body;
      const dataBytes = size > 0 && size <= available ? size : available;
      if (dataBytes <= 0) return { ok: false, reason: 'empty' };
      return { ok: true, format: 'wav', mimeType: 'audio/wav', durationSec: dataBytes / bytesPerSecond };
    }

    offset = body + size + (size % 2);
  }
  return { ok: false, reason: 'malformed' };
}

function isAdtsHeader(buf: Buffer, i: number): boolean {
  return i + 7 <= buf.length && buf[i] === 0xff && (buf[i + 1] & 0xf6) === 0xf0;
}

function skipId3(buf: Buffer): number {
  if (buf.length < 10 || buf.toString('ascii', 0, 3) !== 'ID3') return 0;
  const size = ((buf[6] & 0x7f) << 21) | ((buf[7] & 0x7f) << 14) | ((buf[8] & 0x7f) << 7) | (buf[9] & 0x7f);
  return 10 + size;
}

function inspectAdts(buf: Buffer, start: number): AudioInspection {
  let offset = start;
  let samples = 0;
  let sampleRate = 0;

  while (isAdtsHeader(buf, offset)) {
    const rateIndex = (buf[offset + 2] >> 2) & 0x0f;
    const rate = ADTS_SAMPLE_RATES[rateIndex];
    if (!rate) return { ok: false, reason: 'malformed' };
    if (sampleRate && rate !== sampleRate) return { ok: false, reason: 'malformed' };
    sampleRate = rate;

    const frameLength =
      ((buf[offset + 3] & 0x03) << 11) | (buf[offset + 4] << 3) | ((buf[offset + 5] & 0xe0) >> 5);
    if (frameLength < 7) return { ok: false, reason: 'malformed' };
    if (offset + frameLength > buf.length) break;

    const blocks = (buf[offset + 6] & 0x03) + 1;
    samples += blocks * SAMPLES_PER_AAC_BLOCK;
    offset += frameLength;
  }

  if (!samples) return { ok: false, reason: 'malformed' };
  if (buf.length - offset > ADTS_MAX_TAIL_BYTES) return { ok: false, reason: 'malformed' };
  return { ok: true, format: 'aac', mimeType: 'audio/aac', durationSec: samples / sampleRate };
}

export function inspectAudio(buf: Buffer | undefined | null): AudioInspection {
  if (!buf || buf.length === 0) return { ok: false, reason: 'empty' };
  if (isWav(buf)) return inspectWav(buf);
  const adtsStart = skipId3(buf);
  if (isAdtsHeader(buf, adtsStart)) return inspectAdts(buf, adtsStart);
  return { ok: false, reason: 'unsupported' };
}
