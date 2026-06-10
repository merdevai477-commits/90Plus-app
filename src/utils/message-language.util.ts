export type MessageLanguage = 'ar' | 'en';

const ARABIC_SCRIPT_RE = /[\u0600-\u06FF]/g;
const LATIN_LETTER_RE = /[a-zA-Z]/g;

function countScriptLetters(message: string): { arabic: number; latin: number } {
  const arabic = (message.match(ARABIC_SCRIPT_RE) ?? []).length;
  const latin = (message.match(LATIN_LETTER_RE) ?? []).length;
  return { arabic, latin };
}

function countScriptWords(message: string): { arabic: number; latin: number } {
  let arabic = 0;
  let latin = 0;
  for (const token of message.split(/\s+/).filter(Boolean)) {
    const hasArabic = ARABIC_SCRIPT_RE.test(token);
    const hasLatin = LATIN_LETTER_RE.test(token);
    if (hasArabic && !hasLatin) arabic += 1;
    else if (hasLatin && !hasArabic) latin += 1;
    else if (hasArabic && hasLatin) {
      const counts = countScriptLetters(token);
      if (counts.arabic >= counts.latin) arabic += 1;
      else latin += 1;
    }
  }
  return { arabic, latin };
}

/**
 * Detect the dominant language of a user message by script ratio.
 * Tie-breaker: word-token script count, then default to English.
 */
export function detectMessageLanguage(message: string): MessageLanguage {
  const trimmed = message?.trim() ?? '';
  if (!trimmed) return 'en';

  const letters = countScriptLetters(trimmed);
  if (letters.arabic > letters.latin) return 'ar';
  if (letters.latin > letters.arabic) return 'en';

  const words = countScriptWords(trimmed);
  if (words.arabic > words.latin) return 'ar';
  if (words.latin > words.arabic) return 'en';

  return 'en';
}

/** Strict language rule injected at the top of the Captain AI system prompt. */
export function buildLanguageLockPrompt(language: MessageLanguage): string {
  if (language === 'ar') {
    return [
      'قاعدة اللغة (صارمة)',
      '',
      'أجب بنفس لغة المستخدم بالضبط.',
      'سؤال عربي → إجابة عربية فقط.',
      'سؤال إنجليزي → إجابة إنجليزية فقط.',
      'لا تبدّل اللغة.',
      'لا تخلط العربية والإنجليزية.',
      'لا تترجم إلا إذا طلب المستخدم ذلك صراحةً.',
    ].join('\n');
  }

  return [
    'LANGUAGE RULE (STRICT)',
    '',
    'Respond in the exact same language used by the user.',
    'Arabic question → Arabic answer only.',
    'English question → English answer only.',
    'Do not switch languages.',
    'Do not mix Arabic and English.',
    'Do not translate unless explicitly requested.',
  ].join('\n');
}
