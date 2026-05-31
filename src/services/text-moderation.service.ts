/**
 * Text Moderation Service
 * Filters profanity, spam, and inappropriate content in Arabic and English
 */

import { logger } from '../utils/logger';

// Bad words lists (Arabic + English)
const ARABIC_BAD_WORDS = [
    'كلب', 'حمار', 'غبي', 'احمق', 'خنزير', 'قذر', 'وسخ', 'عاهر', 'شرموط',
    'كس', 'زب', 'عرص', 'متناك', 'ابن الكلب', 'ابن الشرموطة', 'يا كلب',
    'يا حمار', 'يا غبي', 'يا احمق', 'لعنة', 'تفو', 'قرف', 'حقير'
];

const ENGLISH_BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard',
    'dick', 'cock', 'pussy', 'cunt', 'whore', 'slut', 'fag', 'nigger',
    'retard', 'piss',
];

/** Escape regex special chars in a literal phrase */
function escapeRegex(s: string): string {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Match Arabic/English profanity as whole tokens/phrases (not substrings).
 * Arabic: split on whitespace/punctuation; multi-word phrases use boundary check.
 */
function containsArabicBadWord(text: string, word: string): boolean {
    const normalized = text.toLowerCase().trim();
    if (word.includes(' ')) {
        return normalized.includes(word);
    }
    const tokens = normalized.split(/[\s,.!?؛،]+/).filter(Boolean);
    return tokens.some((t) => t === word);
}

function containsEnglishBadWord(text: string, word: string): boolean {
    const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, 'gi');
    return regex.test(text);
}

// Common bypass tricks patterns
const BYPASS_PATTERNS = [
    /f+u+c+k+/gi,
    /s+h+i+t+/gi,
    /b+i+t+c+h+/gi,
    /a+s+s+h+o+l+e+/gi,
    /d+a+m+n+/gi,
    /f\*+ck/gi,
    /sh\*+t/gi,
    /b\*+tch/gi,
    /f\.u\.c\.k/gi,
    /s\.h\.i\.t/gi,
];

// Spam patterns
const SPAM_PATTERNS = [
    /(.)\1{10,}/g, // Repeated characters (10+ times)
    /(https?:\/\/[^\s]+){3,}/gi, // Multiple URLs
    /(\d{10,})/g, // Long numbers (phone numbers)
    /(buy now|click here|free money|earn \$|win prize)/gi,
    /(follow me|sub to|subscribe|check my)/gi,
];

// Offensive usernames patterns
const OFFENSIVE_USERNAME_PATTERNS = [
    /admin/gi,
    /moderator/gi,
    /official/gi,
    /support/gi,
    /90plus/gi,
    /staff/gi,
];

interface ModerationResult {
    isClean: boolean;
    reason?: string;
    detectedWords?: string[];
    severity: 'low' | 'medium' | 'high';
    /** Set when mild profanity was censored but content may proceed */
    censoredText?: string;
}

/**
 * Moderate text content (comments, captions, bio, etc.)
 */
export function moderateText(text: string, context: 'comment' | 'caption' | 'bio' | 'username' = 'comment'): ModerationResult {
    if (!text || text.trim().length === 0) {
        return { isClean: true, severity: 'low' };
    }

    const lowerText = text.toLowerCase();
    const detectedWords: string[] = [];

    // Check for bad words (Arabic) — token/phrase match to avoid false positives
    for (const word of ARABIC_BAD_WORDS) {
        if (containsArabicBadWord(lowerText, word)) {
            detectedWords.push(word);
        }
    }

    // Check for bad words (English) — word boundaries
    for (const word of ENGLISH_BAD_WORDS) {
        if (containsEnglishBadWord(lowerText, word)) {
            detectedWords.push(word);
        }
    }

    // Check for bypass patterns
    for (const pattern of BYPASS_PATTERNS) {
        if (pattern.test(text)) {
            detectedWords.push('bypass_pattern');
        }
    }

    // Check for spam patterns
    if (context !== 'username') {
        for (const pattern of SPAM_PATTERNS) {
            if (pattern.test(text)) {
                return {
                    isClean: false,
                    reason: 'Spam detected',
                    detectedWords: ['spam'],
                    severity: 'medium',
                };
            }
        }
    }

    // Check for offensive usernames
    if (context === 'username') {
        for (const pattern of OFFENSIVE_USERNAME_PATTERNS) {
            if (pattern.test(text)) {
                return {
                    isClean: false,
                    reason: 'Offensive or reserved username',
                    detectedWords: ['reserved_word'],
                    severity: 'high',
                };
            }
        }
    }

    // Return result
    if (detectedWords.length > 0) {
        const severity = detectedWords.length >= 3 ? 'high' : detectedWords.length >= 2 ? 'medium' : 'low';
        const censoredText = censorText(text);
        // Mild single-word hits: censor and allow (football banter shouldn't 400)
        if (severity === 'low') {
            return {
                isClean: true,
                censoredText,
                detectedWords,
                severity,
            };
        }
        return {
            isClean: false,
            reason: `Inappropriate language detected: ${detectedWords.length} word(s)`,
            detectedWords,
            severity,
            censoredText,
        };
    }

    return { isClean: true, severity: 'low' };
}

/**
 * Filter/censor bad words in text (replace with ***)
 */
export function censorText(text: string): string {
    let censored = text;

    // Censor Arabic bad words
    for (const word of ARABIC_BAD_WORDS) {
        const regex = new RegExp(word, 'gi');
        censored = censored.replace(regex, '*'.repeat(word.length));
    }

    // Censor English bad words
    for (const word of ENGLISH_BAD_WORDS) {
        const regex = new RegExp(`\\b${word}\\b`, 'gi');
        censored = censored.replace(regex, '*'.repeat(word.length));
    }

    // Censor bypass patterns
    for (const pattern of BYPASS_PATTERNS) {
        censored = censored.replace(pattern, '***');
    }

    return censored;
}

/**
 * Check if username is valid and not offensive
 */
export function validateUsername(username: string): ModerationResult {
    // Check length
    if (username.length < 3 || username.length > 20) {
        return {
            isClean: false,
            reason: 'Username must be between 3 and 20 characters',
            severity: 'low',
        };
    }

    // Check format (alphanumeric + underscore only)
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return {
            isClean: false,
            reason: 'Username can only contain letters, numbers, and underscores',
            severity: 'low',
        };
    }

    // Check for offensive content
    return moderateText(username, 'username');
}

/**
 * Detect spam behavior
 */
export function detectSpam(text: string, metadata?: {
    previousMessages?: string[];
    messageCount?: number;
    timeWindow?: number; // seconds
}): boolean {
    // Check spam patterns
    for (const pattern of SPAM_PATTERNS) {
        if (pattern.test(text)) {
            return true;
        }
    }

    // Check for repeated messages
    if (metadata?.previousMessages) {
        const similarCount = metadata.previousMessages.filter(msg => 
            msg.toLowerCase() === text.toLowerCase()
        ).length;
        
        if (similarCount >= 3) {
            return true;
        }
    }

    // Check for high message frequency
    if (metadata?.messageCount && metadata?.timeWindow) {
        const messagesPerMinute = (metadata.messageCount / metadata.timeWindow) * 60;
        if (messagesPerMinute > 10) { // More than 10 messages per minute
            return true;
        }
    }

    return false;
}

/**
 * Log moderation action
 */
export function logModerationAction(action: {
    userId: string;
    contentType: 'comment' | 'reel' | 'bio' | 'username';
    contentId?: string;
    action: 'blocked' | 'censored' | 'flagged';
    reason: string;
    detectedWords?: string[];
}) {
    logger.info('[TEXT_MODERATION]', {
        ...action,
        timestamp: new Date().toISOString(),
    });
}

export const TextModerationService = {
    moderateText,
    censorText,
    validateUsername,
    detectSpam,
    logModerationAction,
};
