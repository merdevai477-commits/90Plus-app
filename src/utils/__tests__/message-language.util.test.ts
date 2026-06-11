import {
  buildLanguageLockPrompt,
  detectMessageLanguage,
  resolveChatLanguage,
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

describe('resolveChatLanguage', () => {
  test('uses app language for short ambiguous text', () => {
    expect(resolveChatLanguage('Salah', 'ar')).toBe('ar');
    expect(resolveChatLanguage('hi', 'ar')).toBe('ar');
  });

  test('clear script overrides app preference', () => {
    expect(resolveChatLanguage('كم عمر صلاح؟', 'en')).toBe('ar');
    expect(resolveChatLanguage('How old is Salah?', 'ar')).toBe('en');
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
