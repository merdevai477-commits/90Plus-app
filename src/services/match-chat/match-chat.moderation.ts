import { moderateText } from '../text-moderation.service';
import { compactNormalizedText } from './match-chat.normalizer';
import type { MatchChatModerationAction, MatchChatModerationCategory } from './match-chat.types';

export interface LayeredModerationResult {
  category: MatchChatModerationCategory;
  score: number;
  action: MatchChatModerationAction;
  reason?: string;
}

const ARABIC_INSULTS = [
  'غبي',
  'احمق',
  'كلب',
  'حمار',
  'حقير',
  'قذر',
  'وسخ',
  'عرص',
  'متناك',
  'شرموط',
  'عاهر',
  'خنزير',
];

const THREAT_PATTERNS = [
  /هقتلك/,
  /ساقتلك/,
  /سأقتلك/,
  /i\s*will\s*kill/,
  /kill\s*you/,
  /هذبحك/,
];

const HATE_PATTERNS = [
  /\bnazi\b/,
  /\bkike\b/,
  /يهود كلهم/,
];

const AD_PATTERNS = [
  /telegram\.me/i,
  /t\.me\//i,
  /whatsapp\.com/i,
  /wa\.me\//i,
  /instagram\.com\//i,
  /follow\s+me/i,
  /تابعني/,
  /ادخل الرابط/,
  /كود خصم/,
];

const URL_RE = /https?:\/\/[^\s]+/gi;
const EMOJI_RUN = /\p{Extended_Pictographic}{8,}/u;
const REPEAT_CHAR = /(.)\1{7,}/;
const MENTION_RE = /(?:^|\s)@[A-Za-z0-9_.]{2,}/g;

function scoreFor(category: MatchChatModerationCategory): number {
  switch (category) {
    case 'CLEAN':
      return 0;
    case 'SPAM':
      return 0.55;
    case 'ADVERTISEMENT':
      return 0.7;
    case 'SUSPICIOUS_LINK':
      return 0.75;
    case 'INSULT':
    case 'PROFANITY':
      return 0.8;
    case 'HARASSMENT':
    case 'SEXUAL':
      return 0.88;
    case 'HATE':
    case 'THREAT':
      return 0.97;
    default:
      return 0.5;
  }
}

function containsArabicInsult(compact: string): string | null {
  for (const word of ARABIC_INSULTS) {
    if (compact.includes(word)) return word;
  }
  return null;
}

/**
 * Layers 1–2 only: dictionary + obfuscation + spam signals. No LLM.
 */
export function moderateMatchChatText(original: string, normalized: string): LayeredModerationResult {
  const compact = compactNormalizedText(normalized);
  const urls = original.match(URL_RE) ?? [];
  const mentions = original.match(MENTION_RE) ?? [];

  if (THREAT_PATTERNS.some((p) => p.test(normalized) || p.test(original.toLowerCase()))) {
    return { category: 'THREAT', score: scoreFor('THREAT'), action: 'freeze', reason: 'threat' };
  }
  if (HATE_PATTERNS.some((p) => p.test(normalized))) {
    return { category: 'HATE', score: scoreFor('HATE'), action: 'freeze', reason: 'hate' };
  }

  if (urls.length >= 2) {
    return {
      category: 'SUSPICIOUS_LINK',
      score: scoreFor('SUSPICIOUS_LINK'),
      action: 'block',
      reason: 'multiple_urls',
    };
  }
  if (AD_PATTERNS.some((p) => p.test(original) || p.test(normalized))) {
    return {
      category: 'ADVERTISEMENT',
      score: scoreFor('ADVERTISEMENT'),
      action: 'block',
      reason: 'advertisement',
    };
  }
  if (urls.length === 1) {
    return {
      category: 'SUSPICIOUS_LINK',
      score: scoreFor('SUSPICIOUS_LINK'),
      action: 'block',
      reason: 'link',
    };
  }

  if (REPEAT_CHAR.test(original) || EMOJI_RUN.test(original) || mentions.length >= 5) {
    return { category: 'SPAM', score: scoreFor('SPAM'), action: 'block', reason: 'spam_signal' };
  }
  if (compact.length > 0 && compact.length <= 2 && /[^\p{L}\p{N}]/u.test(original) === false && original.length > 40) {
    return { category: 'SPAM', score: scoreFor('SPAM'), action: 'block', reason: 'low_signal' };
  }

  const insult = containsArabicInsult(compact);
  if (insult) {
    return { category: 'INSULT', score: scoreFor('INSULT'), action: 'block', reason: insult };
  }

  const dict = moderateText(normalized, 'comment');
  if (!dict.isClean) {
    const reason = dict.reason ?? 'dictionary';
    const category: MatchChatModerationCategory = /spam/i.test(reason) ? 'SPAM' : 'PROFANITY';
    return {
      category,
      score: scoreFor(category),
      action: 'block',
      reason,
    };
  }

  const originalDict = moderateText(original, 'comment');
  if (!originalDict.isClean && originalDict.severity !== 'low') {
    return {
      category: 'PROFANITY',
      score: scoreFor('PROFANITY'),
      action: 'block',
      reason: originalDict.reason ?? 'dictionary',
    };
  }

  return { category: 'CLEAN', score: 0, action: 'allow' };
}
