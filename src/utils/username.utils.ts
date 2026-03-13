/**
 * Username Generator Utility
 * 
 * Generates unique usernames for users based on their registration method:
 * - Manual Registration: First letters of name + random digits
 * - OAuth Registration: Email prefix or fallback to random
 */

import prisma from '../lib/prisma';

/**
 * Generate a random number with specified digits
 */
function generateRandomDigits(length: number = 4): string {
    const min = Math.pow(10, length - 1);
    const max = Math.pow(10, length) - 1;
    return Math.floor(min + Math.random() * (max - min + 1)).toString();
}

/**
 * Extract first letters from a name (supports Arabic and English)
 */
function extractFirstLetters(firstName?: string, lastName?: string): string {
    let letters = '';

    if (firstName && firstName.length > 0) {
        // Get first character (works for Arabic too)
        letters += firstName.charAt(0).toLowerCase();
    }

    if (lastName && lastName.length > 0) {
        letters += lastName.charAt(0).toLowerCase();
    }

    // If no letters extracted, use 'user'
    if (letters.length === 0) {
        letters = 'user';
    }

    // Transliterate Arabic to English for username
    letters = transliterateArabic(letters);

    return letters;
}

/**
 * Simple Arabic to English transliteration
 */
function transliterateArabic(text: string): string {
    const arabicToEnglish: { [key: string]: string } = {
        'ا': 'a', 'أ': 'a', 'إ': 'e', 'آ': 'a',
        'ب': 'b', 'ت': 't', 'ث': 'th',
        'ج': 'j', 'ح': 'h', 'خ': 'kh',
        'د': 'd', 'ذ': 'th', 'ر': 'r', 'ز': 'z',
        'س': 's', 'ش': 'sh', 'ص': 's', 'ض': 'd',
        'ط': 't', 'ظ': 'z', 'ع': 'a', 'غ': 'gh',
        'ف': 'f', 'ق': 'q', 'ك': 'k', 'ل': 'l',
        'م': 'm', 'ن': 'n', 'ه': 'h', 'و': 'w',
        'ي': 'y', 'ى': 'a', 'ة': 'h', 'ء': 'a',
    };

    let result = '';
    for (const char of text) {
        result += arabicToEnglish[char] || char;
    }

    // Remove any non-alphanumeric characters
    return result.replace(/[^a-z0-9]/gi, '').toLowerCase();
}

/**
 * Extract username from email prefix
 */
function extractEmailPrefix(email: string): string {
    const prefix = email.split('@')[0];
    // Clean the prefix - only allow lowercase letters, numbers, underscore
    return prefix.toLowerCase().replace(/[^a-z0-9_]/g, '');
}

/**
 * Check if username exists in database
 */
async function isUsernameTaken(username: string): Promise<boolean> {
    const existing = await prisma.user.findUnique({
        where: { username },
        select: { id: true },
    });
    return !!existing;
}

/**
 * Generate username for manual registration (email/password)
 */
export async function generateUsernameForManual(
    firstName?: string,
    lastName?: string
): Promise<string> {
    const letters = extractFirstLetters(firstName, lastName);

    let attempts = 0;
    const maxAttempts = 100;

    while (attempts < maxAttempts) {
        const digits = generateRandomDigits(4 + Math.floor(attempts / 20)); // Increase digits after many attempts
        const username = `${letters}${digits}`;

        if (!(await isUsernameTaken(username))) {
            return username;
        }

        attempts++;
    }

    // Fallback: Use timestamp
    const timestamp = Date.now().toString(36);
    return `${letters}${timestamp}`;
}

/**
 * Generate username for OAuth registration (Google, Apple)
 */
export async function generateUsernameForOAuth(
    email: string,
    firstName?: string,
    lastName?: string
): Promise<string> {
    // Try email prefix first
    const emailPrefix = extractEmailPrefix(email);

    if (emailPrefix.length >= 3 && !(await isUsernameTaken(emailPrefix))) {
        return emailPrefix;
    }

    // Try email prefix with digits
    let attempts = 0;
    while (attempts < 10) {
        const digits = generateRandomDigits(4);
        const username = `${emailPrefix}${digits}`;

        if (!(await isUsernameTaken(username))) {
            return username;
        }

        attempts++;
    }

    // Fallback to name-based generation
    return generateUsernameForManual(firstName, lastName);
}

/**
 * Main username generator function
 */
export async function generateUsername(options: {
    email: string;
    firstName?: string;
    lastName?: string;
    isOAuth?: boolean;
}): Promise<string> {
    const { email, firstName, lastName, isOAuth } = options;

    if (isOAuth) {
        return generateUsernameForOAuth(email, firstName, lastName);
    }

    return generateUsernameForManual(firstName, lastName);
}

export default {
    generateUsername,
    generateUsernameForManual,
    generateUsernameForOAuth,
};
