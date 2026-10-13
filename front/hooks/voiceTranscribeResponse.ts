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
  | 'voiceQuotaShort'
  | 'messageQuota';

/** Server-reported voice-time allowance (whole seconds; `resetAt` is an ISO timestamp or null). */
export type VoiceQuotaUpdate = {
  remainingSeconds: number;
  limitSeconds: number;
  resetAt: string | null;
};

export type TranscribeResult =
  | { kind: 'text'; text: string; quota: VoiceQuotaUpdate | null }
  | { kind: 'error'; error: VoiceInputError; quota: VoiceQuotaUpdate | null };

type QuotaFields = {
  voiceRemainingSeconds?: unknown;
  voiceLimitSeconds?: unknown;
  voiceResetAt?: unknown;
};

type TranscribeBody = QuotaFields & {
  text?: unknown;
  code?: unknown;
};

/** Reads the voice allowance from a `/chat/transcribe` or `/chat/limit` body; null when absent. */
export function readVoiceQuota(body: QuotaFields | null | undefined): VoiceQuotaUpdate | null {
  if (!body) return null;
  const { voiceRemainingSeconds, voiceLimitSeconds, voiceResetAt } = body;
  if (typeof voiceRemainingSeconds !== 'number' || typeof voiceLimitSeconds !== 'number') return null;
  return {
    remainingSeconds: Math.max(0, Math.floor(voiceRemainingSeconds)),
    limitSeconds: voiceLimitSeconds,
    resetAt: typeof voiceResetAt === 'string' ? voiceResetAt : null,
  };
}

export function mapTranscribeResponse(status: number, body: unknown): TranscribeResult {
  const data = (body && typeof body === 'object' ? body : {}) as TranscribeBody;
  const quota = readVoiceQuota(data);
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
    case 422:
      return error(code === 'VOICE_AUDIO_TOO_SHORT' ? 'tooShort' : 'failed');
    case 429:
      if (code === 'MESSAGE_QUOTA_EXHAUSTED') return error('messageQuota');
      if (code === 'VOICE_QUOTA_EXHAUSTED') return error('voiceQuota');
      if (code === 'VOICE_QUOTA_INSUFFICIENT') return error('voiceQuotaShort');
      return error('rateLimited');
    case 501:
      return error('unavailable');
    case 504:
      return error('timeout');
    default:
      return error('failed');
  }
}
