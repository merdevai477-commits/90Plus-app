import { mapTranscribeResponse, readVoiceQuota } from '../voiceTranscribeResponse';

const RESET = '2026-10-14T10:00:00.000Z';

describe('mapTranscribeResponse', () => {
  it('returns the trimmed transcript with the server voice time', () => {
    expect(
      mapTranscribeResponse(200, {
        text: ' مين جاب الجول ',
        voiceRemainingSeconds: 140,
        voiceLimitSeconds: 150,
        voiceResetAt: RESET,
      }),
    ).toEqual({
      kind: 'text',
      text: 'مين جاب الجول',
      quota: { remainingSeconds: 140, limitSeconds: 150, resetAt: RESET },
    });
  });

  it('treats an empty transcript as "empty", including a body without quota', () => {
    expect(
      mapTranscribeResponse(200, { text: '', code: 'VOICE_EMPTY', voiceRemainingSeconds: 150, voiceLimitSeconds: 150 }),
    ).toEqual({
      kind: 'error',
      error: 'empty',
      quota: { remainingSeconds: 150, limitSeconds: 150, resetAt: null },
    });
    expect(mapTranscribeResponse(200, { text: '' })).toEqual({ kind: 'error', error: 'empty', quota: null });
  });

  it('tells the quota rejections and the rate limit apart', () => {
    expect(
      mapTranscribeResponse(429, {
        code: 'VOICE_QUOTA_EXHAUSTED',
        voiceRemainingSeconds: 0,
        voiceLimitSeconds: 150,
        voiceResetAt: RESET,
      }),
    ).toEqual({
      kind: 'error',
      error: 'voiceQuota',
      quota: { remainingSeconds: 0, limitSeconds: 150, resetAt: RESET },
    });
    expect(mapTranscribeResponse(429, { code: 'VOICE_QUOTA_INSUFFICIENT', voiceRemainingSeconds: 10, voiceLimitSeconds: 150 }))
      .toMatchObject({ error: 'voiceQuotaShort', quota: { remainingSeconds: 10 } });
    expect(mapTranscribeResponse(429, { code: 'MESSAGE_QUOTA_EXHAUSTED' })).toMatchObject({ error: 'messageQuota' });
    expect(mapTranscribeResponse(429, { code: 'VOICE_RATE_LIMITED' })).toMatchObject({ error: 'rateLimited' });
  });

  it('a server-side "too short" is the same as the on-device one', () => {
    expect(mapTranscribeResponse(422, { code: 'VOICE_AUDIO_TOO_SHORT' })).toMatchObject({ error: 'tooShort' });
    expect(mapTranscribeResponse(422, { code: 'VOICE_AUDIO_INVALID' })).toMatchObject({ error: 'failed' });
  });

  it.each([
    [409, 'inProgress'],
    [413, 'tooLong'],
    [415, 'failed'],
    [501, 'unavailable'],
    [502, 'failed'],
    [503, 'failed'],
    [504, 'timeout'],
    [401, 'failed'],
  ])('maps HTTP %i to %s', (status, error) => {
    expect(mapTranscribeResponse(status, { code: 'X' })).toMatchObject({ kind: 'error', error });
  });

  it('survives a non-JSON body', () => {
    expect(mapTranscribeResponse(502, null)).toEqual({ kind: 'error', error: 'failed', quota: null });
  });
});

describe('readVoiceQuota', () => {
  it('ignores the retired count fields instead of reading them as seconds', () => {
    expect(readVoiceQuota({ voiceRemaining: 3, voiceLimit: 5 } as never)).toBeNull();
  });

  it('never reports negative or fractional seconds', () => {
    expect(readVoiceQuota({ voiceRemainingSeconds: -4, voiceLimitSeconds: 150 })).toMatchObject({ remainingSeconds: 0 });
    expect(readVoiceQuota({ voiceRemainingSeconds: 9.8, voiceLimitSeconds: 150 })).toMatchObject({ remainingSeconds: 9 });
  });
});
