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

function isValidPreferredLanguage(value: unknown): value is MessageLanguage {
  return value === 'ar' || value === 'en';
}

/**
 * Pick reply language: clear script in the message wins; otherwise use the app UI language.
 */
export function resolveChatLanguage(
  message: string,
  preferred?: MessageLanguage | string | null,
): MessageLanguage {
  const pref = isValidPreferredLanguage(preferred) ? preferred : null;
  const trimmed = message?.trim() ?? '';
  if (!trimmed) return pref ?? 'en';

  const letters = countScriptLetters(trimmed);
  const total = letters.arabic + letters.latin;

  if (letters.arabic >= 3 && letters.arabic > letters.latin * 1.5) return 'ar';
  if (letters.latin >= 12 && letters.latin > letters.arabic * 1.5) return 'en';

  // Latin-only short queries (player names, "hi") → follow app UI language.
  if (letters.arabic === 0 && letters.latin > 0 && pref) return pref;

  if (total < 4 && pref) return pref;

  const detected = detectMessageLanguage(trimmed);
  if (letters.arabic === letters.latin && pref) return pref;

  return detected;
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
      'اجعل ردك العربي باللهجة المصرية العامية افتراضيًا، إلا إذا كتب المستخدم بلهجة عربية أخرى فطابق لهجته.',
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
