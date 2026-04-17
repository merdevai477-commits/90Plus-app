import prisma from '../lib/prisma'; // ✅ Use centralized singleton

/**
 * Generate a unique username from display name
 * If display name is not provided or skip is true, generates random username
 */
export async function generateUniqueUsername(
    displayName?: string | null,
    skip: boolean = false
): Promise<string> {
    let base: string;

    if (skip || !displayName) {
        base = 'user';
    } else {
        // Clean display name, keep only alphanumeric
        base = displayName
            .toLowerCase()
            .trim()
            .replace(/[^a-z0-9]/g, '');

        if (base.length < 3) base = 'user';
    }

    // Try to find a unique username with "Insta-style" (name_123 or name.123)
    let counter = 0;
    const maxAttempts = 50;

    while (counter < maxAttempts) {
        // Generate random 3-4 digit number
        const randomNum = Math.floor(Math.random() * 9000) + 1000; // 1000-9999
        // 50% chance of using '_' or '.'
        const separator = Math.random() > 0.5 ? '_' : '.';

        const candidate = `${base}${separator}${randomNum}`;

        const exists = await prisma.user.findUnique({
            where: { username: candidate },
            select: { id: true },
        });

        if (!exists) {
            return candidate;
        }
        counter++;
    }

    // Fallback if super unlucky
    return `${base}_${Date.now()}`;
}

/**
 * Validate username format
 */
export function validateUsername(username: string): { valid: boolean; error?: string } {
    if (!username || username.length < 3) {
        return { valid: false, error: 'Username must be at least 3 characters' };
    }

    if (username.length > 30) {
        return { valid: false, error: 'Username must be less than 30 characters' };
    }

    const usernameRegex = /^[a-z0-9_]+$/;
    if (!usernameRegex.test(username)) {
        return { valid: false, error: 'Username must contain only lowercase letters, numbers, and underscore' };
    }

    // Check for temporary username pattern (should not be allowed)
    if (username.match(/_\d{13}_/)) {
        return { valid: false, error: 'Invalid username format' };
    }

    return { valid: true };
}

