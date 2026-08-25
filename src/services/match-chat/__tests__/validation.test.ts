import { MATCH_CHAT_CONFIG } from '../../../config/match-chat.config';
import { matchChatSendSchema } from '../match-chat.validation';

describe('match-chat validation', () => {
  it('rejects over-length messages', () => {
    const result = matchChatSendSchema.safeParse({
      matchId: 1,
      clientMessageId: '11111111-1111-4111-8111-111111111111',
      text: 'x'.repeat(MATCH_CHAT_CONFIG.maxLength + 1),
    });
    expect(result.success).toBe(false);
  });

  it('accepts a normal message', () => {
    const result = matchChatSendSchema.safeParse({
      matchId: 42,
      clientMessageId: '11111111-1111-4111-8111-111111111111',
      text: 'هدف',
    });
    expect(result.success).toBe(true);
  });

  it('rejects empty / whitespace-only text', () => {
    const result = matchChatSendSchema.safeParse({
      matchId: 1,
      clientMessageId: '11111111-1111-4111-8111-111111111111',
      text: '   ',
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid clientMessageId', () => {
    const result = matchChatSendSchema.safeParse({
      matchId: 1,
      clientMessageId: 'not-a-uuid',
      text: 'hi',
    });
    expect(result.success).toBe(false);
  });

  it('accepts optional replyToMessageId', () => {
    const result = matchChatSendSchema.safeParse({
      matchId: 42,
      clientMessageId: '11111111-1111-4111-8111-111111111111',
      replyToMessageId: '22222222-2222-4222-8222-222222222222',
      text: 'رد',
    });
    expect(result.success).toBe(true);
  });
});
