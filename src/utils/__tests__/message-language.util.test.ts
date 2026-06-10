import {
  buildLanguageLockPrompt,
  detectMessageLanguage,
} from '../message-language.util';

describe('detectMessageLanguage', () => {
  test('English question', () => {
    expect(detectMessageLanguage('How old is Lamine Yamal?')).toBe('en');
  });

  test('Arabic question', () => {
    expect(detectMessageLanguage('كم عمر لامين يامال؟')).toBe('ar');
  });

  test('mixed message uses dominant script', () => {
    expect(detectMessageLanguage('Salah كم هدف؟')).toBe('ar');
    expect(detectMessageLanguage('How many goals كم')).toBe('en');
  });

  test('empty defaults to English', () => {
    expect(detectMessageLanguage('')).toBe('en');
  });
});

describe('buildLanguageLockPrompt', () => {
  test('English block contains strict rule', () => {
    const prompt = buildLanguageLockPrompt('en');
    expect(prompt).toContain('LANGUAGE RULE (STRICT)');
    expect(prompt).toContain('Do not switch languages');
  });

  test('Arabic block contains strict rule', () => {
    const prompt = buildLanguageLockPrompt('ar');
    expect(prompt).toContain('قاعدة اللغة (صارمة)');
    expect(prompt).toContain('لا تبدّل اللغة');
  });
});
