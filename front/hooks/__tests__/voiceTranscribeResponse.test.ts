import { mapTranscribeResponse } from '../voiceTranscribeResponse';

describe('mapTranscribeResponse', () => {
  it('returns the trimmed transcript with the server quota', () => {
    expect(mapTranscribeResponse(200, { text: ' مين جاب الجول ', voiceRemaining: 2, voiceLimit: 5 })).toEqual({
      kind: 'text',
      text: 'مين جاب الجول',
      quota: { voiceRemaining: 2, voiceLimit: 5 },
    });
  });

  it('treats an empty transcript as "empty", including the legacy shape without quota', () => {
    expect(mapTranscribeResponse(200, { text: '', code: 'VOICE_EMPTY', voiceRemaining: 3, voiceLimit: 5 })).toEqual({
      kind: 'error',
      error: 'empty',
      quota: { voiceRemaining: 3, voiceLimit: 5 },
    });
    expect(mapTranscribeResponse(200, { text: '' })).toEqual({ kind: 'error', error: 'empty', quota: null });
  });

  it('tells the two quota rejections and the rate limit apart', () => {
    expect(mapTranscribeResponse(429, { code: 'VOICE_QUOTA_EXHAUSTED', voiceRemaining: 0, voiceLimit: 5 })).toEqual({
      kind: 'error',
      error: 'voiceQuota',
      quota: { voiceRemaining: 0, voiceLimit: 5 },
    });
    expect(mapTranscribeResponse(429, { code: 'MESSAGE_QUOTA_EXHAUSTED' })).toMatchObject({ error: 'messageQuota' });
    expect(mapTranscribeResponse(429, { code: 'VOICE_RATE_LIMITED' })).toMatchObject({ error: 'rateLimited' });
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
