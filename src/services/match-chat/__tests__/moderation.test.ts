import { moderateMatchChatText } from '../match-chat.moderation';
import { normalizeChatText } from '../match-chat.normalizer';

describe('match-chat moderation layers 1-2', () => {
  it('blocks obfuscated Arabic insults', () => {
    const original = 'يـا غـبـي';
    const result = moderateMatchChatText(original, normalizeChatText(original));
    expect(result.action).toBe('block');
    expect(result.category).toBe('INSULT');
  });

  it('blocks advertisement / telegram links', () => {
    const original = 'ادخل الرابط t.me/spam';
    const result = moderateMatchChatText(original, normalizeChatText(original));
    expect(result.action).toBe('block');
    expect(['ADVERTISEMENT', 'SUSPICIOUS_LINK']).toContain(result.category);
  });

  it('allows clean football banter', () => {
    const original = 'هدف عالمي من الهلال';
    const result = moderateMatchChatText(original, normalizeChatText(original));
    expect(result.action).toBe('allow');
    expect(result.category).toBe('CLEAN');
  });

  it('freezes threats', () => {
    const original = 'هقتلك';
    const result = moderateMatchChatText(original, normalizeChatText(original));
    expect(result.action).toBe('freeze');
    expect(result.category).toBe('THREAT');
  });
});
