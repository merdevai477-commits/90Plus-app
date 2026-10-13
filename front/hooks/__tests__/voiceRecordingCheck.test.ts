import {
  addMeterSample,
  emptyMeterStats,
  evaluateRecording,
  makeVoiceIdempotencyKey,
  type MeterStats,
} from '../voiceRecordingCheck';

function meter(dbs: (number | undefined)[]): MeterStats {
  return dbs.reduce<MeterStats>((s, db) => addMeterSample(s, db), emptyMeterStats());
}

describe('evaluateRecording', () => {
  it('rejects recordings shorter than one second', () => {
    expect(evaluateRecording(999, meter([-20, -10, -30]))).toBe('tooShort');
    expect(evaluateRecording(NaN, meter([-20, -10]))).toBe('tooShort');
  });

  it('accepts a normal spoken clip', () => {
    expect(evaluateRecording(4000, meter([-50, -22, -15, -30, -45]))).toBe('ok');
  });

  it('rejects a clip whose meter never left the noise floor', () => {
    expect(evaluateRecording(4000, meter([-60, -58, -57.5, -59, -61]))).toBe('silent');
  });

  it('keeps quiet speech (peaks around -38 dBFS)', () => {
    expect(evaluateRecording(4000, meter([-55, -48, -40, -38, -52]))).toBe('ok');
  });

  it('skips the silence check when the device reports no metering', () => {
    expect(evaluateRecording(4000, meter([undefined, undefined, undefined]))).toBe('ok');
  });

  it('skips the silence check when the meter is stuck on one value', () => {
    expect(evaluateRecording(4000, meter([-160, -160, -160, -160]))).toBe('ok');
  });
});

describe('makeVoiceIdempotencyKey', () => {
  it('is unique per recording and matches the server key format', () => {
    const keys = new Set(Array.from({ length: 200 }, makeVoiceIdempotencyKey));
    expect(keys.size).toBe(200);
    for (const key of keys) expect(key).toMatch(/^[A-Za-z0-9_-]{8,128}$/);
  });
});
