import { inspectAudio } from '../audio-duration.util';

function wav(seconds: number, opts: { sampleRate?: number; declaredSize?: number; format?: number } = {}) {
  const sampleRate = opts.sampleRate ?? 16000;
  const dataBytes = Math.round(seconds * sampleRate * 2);
  const buf = Buffer.alloc(44 + dataBytes);
  buf.write('RIFF', 0, 'ascii');
  buf.writeUInt32LE(36 + dataBytes, 4);
  buf.write('WAVE', 8, 'ascii');
  buf.write('fmt ', 12, 'ascii');
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(opts.format ?? 1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sampleRate, 24);
  buf.writeUInt32LE(sampleRate * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36, 'ascii');
  buf.writeUInt32LE(opts.declaredSize ?? dataBytes, 40);
  return buf;
}

/** One ADTS frame per 1024 samples at 16 kHz (sampling index 8). */
function adts(seconds: number, frameLength = 64) {
  const frames = Math.round((seconds * 16000) / 1024);
  const frame = Buffer.alloc(frameLength);
  frame[0] = 0xff;
  frame[1] = 0xf1;
  frame[2] = (1 << 6) | (8 << 2);
  frame[3] = (frameLength >> 11) & 0x03;
  frame[4] = (frameLength >> 3) & 0xff;
  frame[5] = (frameLength & 0x07) << 5;
  frame[6] = 0;
  return Buffer.concat(Array.from({ length: frames }, () => frame));
}

describe('inspectAudio', () => {
  it('measures WAV duration from the payload', () => {
    const res = inspectAudio(wav(12));
    expect(res).toMatchObject({ ok: true, format: 'wav', mimeType: 'audio/wav' });
    expect(res.ok && res.durationSec).toBeCloseTo(12, 2);
  });

  it('ignores a WAV header that under-reports the data size', () => {
    const res = inspectAudio(wav(40, { declaredSize: 0 }));
    expect(res.ok && res.durationSec).toBeCloseTo(40, 1);
  });

  it('rejects compressed WAV payloads it cannot measure', () => {
    expect(inspectAudio(wav(2, { format: 0x55 }))).toEqual({ ok: false, reason: 'unsupported' });
  });

  it('measures ADTS AAC duration by counting frames', () => {
    const res = inspectAudio(adts(20));
    expect(res).toMatchObject({ ok: true, format: 'aac', mimeType: 'audio/aac' });
    expect(res.ok && res.durationSec).toBeCloseTo(20, 0);
  });

  it('measures long ADTS clips so the route can refuse them', () => {
    const res = inspectAudio(adts(50));
    expect(res.ok && res.durationSec).toBeGreaterThan(35);
  });

  it('rejects ADTS with a large non-audio tail', () => {
    const res = inspectAudio(Buffer.concat([adts(2), Buffer.alloc(10_000, 7)]));
    expect(res).toEqual({ ok: false, reason: 'malformed' });
  });

  it('rejects MP4, random bytes and empty uploads', () => {
    const mp4 = Buffer.concat([Buffer.from([0, 0, 0, 0x18]), Buffer.from('ftypM4A '), Buffer.alloc(64)]);
    expect(inspectAudio(mp4)).toEqual({ ok: false, reason: 'unsupported' });
    expect(inspectAudio(Buffer.from('not audio at all'))).toEqual({ ok: false, reason: 'unsupported' });
    expect(inspectAudio(Buffer.alloc(0))).toEqual({ ok: false, reason: 'empty' });
  });

  it('rejects a truncated WAV header', () => {
    expect(inspectAudio(wav(1).subarray(0, 30))).toEqual({ ok: false, reason: 'malformed' });
  });
});
