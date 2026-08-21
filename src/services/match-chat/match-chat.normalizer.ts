/**
 * Unicode + Arabic obfuscation normalizer.
 * Original message text is always stored separately — this is for moderation only.
 */

const ARABIC_DIACRITICS = /[\u064B-\u065F\u0670\u06D6-\u06ED]/g;
const TATWEEL = /\u0640/g;
const ZERO_WIDTH = /[\u200B-\u200F\u202A-\u202E\u2060-\u2064\uFEFF]/g;
const ALEF_VARIANTS = /[أإآٱ]/g;
const YEH_VARIANTS = /[ىئ]/g;
const TEH_MARBUTA = /ة/g;
const LETTER_EMOJI_LETTER = /(\p{L})\p{Extended_Pictographic}+(\p{L})/gu;

const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};

export function normalizeChatText(input: string): string {
  if (!input) return '';

  let s = input.normalize('NFKC');
  s = s.replace(ZERO_WIDTH, '');
  s = s.replace(TATWEEL, '');
  s = s.replace(ARABIC_DIACRITICS, '');
  s = s.replace(ALEF_VARIANTS, 'ا');
  s = s.replace(YEH_VARIANTS, 'ي');
  s = s.replace(TEH_MARBUTA, 'ه');
  s = s.replace(LETTER_EMOJI_LETTER, '$1$2');
  s = s
    .split('')
    .map((ch) => LEET[ch.toLowerCase()] ?? ch)
    .join('');
  s = s.toLowerCase();
  s = s.replace(/[._]{2,}/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  s = s.replace(/(.)\1{2,}/g, '$1$1');
  return s;
}

/** Compact form used to catch spaced-out Arabic insults (يا غ ب ي → ياغبي). */
export function compactNormalizedText(normalized: string): string {
  return normalized.replace(/[\s.\-_]+/g, '');
}
