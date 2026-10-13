/** Maps a `/api/chat/transcribe` response onto what the composer shows. */

export type VoiceInputError =
  | 'permission'
  | 'permissionBlocked'
  | 'tooShort'
  | 'silent'
  | 'tooLong'
  | 'empty'
  | 'unavailable'
  | 'failed'
  | 'timeout'
  | 'network'
  | 'inProgress'
  | 'rateLimited'
  | 'voiceQuota'
  | 'messageQuota';

export type VoiceQuotaUpdate = { voiceRemaining: number; voiceLimit: number };

export type TranscribeResult =
  | { kind: 'text'; text: string; quota: VoiceQuotaUpdate | null }
  | { kind: 'error'; error: VoiceInputError; quota: VoiceQuotaUpdate | null };

type TranscribeBody = {
  text?: unknown;
  code?: unknown;
  voiceRemaining?: unknown;
  voiceLimit?: unknown;
};

function readQuota(body: TranscribeBody): VoiceQuotaUpdate | null {
  const { voiceRemaining, voiceLimit } = body;
  if (typeof voiceRemaining !== 'number' || typeof voiceLimit !== 'number') return null;
  return { voiceRemaining: Math.max(0, voiceRemaining), voiceLimit };
}

export function mapTranscribeResponse(status: number, body: unknown): TranscribeResult {
  const data = (body && typeof body === 'object' ? body : {}) as TranscribeBody;
  const quota = readQuota(data);
  const code = typeof data.code === 'string' ? data.code : '';
  const error = (e: VoiceInputError): TranscribeResult => ({ kind: 'error', error: e, quota });

  if (status >= 200 && status < 300) {
    const text = typeof data.text === 'string' ? data.text.trim() : '';
    return text ? { kind: 'text', text, quota } : error('empty');
  }
  switch (status) {
    case 409:
      return error('inProgress');
    case 413:
      return error('tooLong');
    case 429:
      if (code === 'MESSAGE_QUOTA_EXHAUSTED') return error('messageQuota');
      if (code === 'VOICE_QUOTA_EXHAUSTED') return error('voiceQuota');
      return error('rateLimited');
    case 501:
      return error('unavailable');
    case 504:
      return error('timeout');
    default:
      return error('failed');
  }
}
