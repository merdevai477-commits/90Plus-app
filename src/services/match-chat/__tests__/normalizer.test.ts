import { compactNormalizedText, normalizeChatText } from '../match-chat.normalizer';

describe('match-chat normalizer', () => {
  it('unwraps spaced/tatweel Arabic insults (يـا غـبـي)', () => {
    const n = normalizeChatText('يـا غـبـي');
    expect(compactNormalizedText(n)).toContain('غبي');
  });

  it('strips zero-width characters', () => {
    const n = normalizeChatText('غ\u200bب\u200cي');
    expect(compactNormalizedText(n)).toBe('غبي');
  });

  it('maps leet speak', () => {
    const n = normalizeChatText('f0ol');
    expect(n).toContain('fool');
  });

  it('removes emoji between letters', () => {
    const n = normalizeChatText('g🤡b');
    expect(compactNormalizedText(n)).toBe('gb');
  });

  it('collapses repeated characters', () => {
    expect(normalizeChatText('goooaaal')).toBe('gooaal');
  });

  it('keeps original meaning for clean text', () => {
    expect(normalizeChatText('هدف عالمي')).toContain('هدف');
  });
});
