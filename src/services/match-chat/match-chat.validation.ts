import { z } from 'zod';
import { MATCH_CHAT_CONFIG } from '../../config/match-chat.config';
import { MATCH_CHAT_REJECT_CODES, type MatchChatReportReason } from './match-chat.types';

export const matchChatJoinSchema = z.object({
  matchId: z.number().int().positive().max(2_147_483_647),
  lastMessageId: z.string().uuid().optional(),
});

export const matchChatSendSchema = z.object({
  matchId: z.number().int().positive().max(2_147_483_647),
  clientMessageId: z.string().uuid(),
  text: z
    .string()
    .transform((s) => s.replace(/\u0000/g, '').trim())
    .pipe(z.string().min(1).max(MATCH_CHAT_CONFIG.maxLength)),
});

export const matchChatLeaveSchema = z.object({
  matchId: z.number().int().positive().max(2_147_483_647),
});

const REPORT_REASONS = [
  'PROFANITY',
  'ABUSE',
  'HARASSMENT',
  'SPAM',
  'ADVERTISEMENT',
  'SUSPICIOUS_LINK',
  'OTHER',
] as const satisfies readonly MatchChatReportReason[];

export const matchChatReportSchema = z.object({
  reason: z.enum(REPORT_REASONS),
  details: z.string().trim().max(500).optional(),
});

export const matchChatHistoryQuerySchema = z.object({
  before: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MATCH_CHAT_CONFIG.historySize).optional(),
});

export const matchChatAdminFreezeSchema = z.object({
  userId: z.string().uuid(),
  durationMs: z.number().int().min(1_000).max(24 * 3600 * 1000).optional(),
  reason: z.string().trim().max(300).optional(),
});

export function isRejectCode(value: string): value is (typeof MATCH_CHAT_REJECT_CODES)[number] {
  return (MATCH_CHAT_REJECT_CODES as readonly string[]).includes(value);
}
