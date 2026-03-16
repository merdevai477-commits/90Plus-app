/**
 * Input Validation Utilities
 * 
 * Provides validation and sanitization for user inputs
 */

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

/**
 * Validate username format
 * - 3-30 characters
 * - Only lowercase letters, numbers, and underscore
 * - Must start with a letter
 */
export function isValidUsername(username: string): boolean {
    const usernameRegex = /^[a-z][a-z0-9_]{2,29}$/;
    return usernameRegex.test(username);
}

/**
 * Sanitize string input
 * - Trim whitespace
 * - Remove control characters
 */
export function sanitizeString(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    // Remove control characters and trim
    return input
        .replace(/[\x00-\x1F\x7F]/g, '')
        .trim();
}

/**
 * Sanitize username
 * - Convert to lowercase
 * - Remove invalid characters
 */
export function sanitizeUsername(input: string): string {
    if (!input || typeof input !== 'string') {
        return '';
    }

    return input
        .toLowerCase()
        .replace(/[^a-z0-9_]/g, '')
        .substring(0, 30);
}

/**
 * Validate bio length
 */
export function isValidBio(bio: string): boolean {
    return bio.length <= 500;
}

/**
 * Validate display name
 */
export function isValidDisplayName(name: string): boolean {
    return name.length >= 1 && name.length <= 100;
}

/**
 * Validate and sanitize user profile update
 */
export function validateProfileUpdate(data: {
    username?: string;
    displayName?: string;
    bio?: string;
    favoriteTeam?: string;
}): { valid: boolean; errors: string[]; sanitized: typeof data } {
    const errors: string[] = [];
    const sanitized: typeof data = {};

    if (data.username !== undefined) {
        const sanitizedUsername = sanitizeUsername(data.username);
        if (!isValidUsername(sanitizedUsername)) {
            errors.push('Username must be 3-30 characters, lowercase letters, numbers, and underscore only');
        } else {
            sanitized.username = sanitizedUsername;
        }
    }

    if (data.displayName !== undefined) {
        const sanitizedName = sanitizeString(data.displayName);
        if (!isValidDisplayName(sanitizedName)) {
            errors.push('Display name must be 1-100 characters');
        } else {
            sanitized.displayName = sanitizedName;
        }
    }

    if (data.bio !== undefined) {
        const sanitizedBio = sanitizeString(data.bio);
        if (!isValidBio(sanitizedBio)) {
            errors.push('Bio must be 500 characters or less');
        } else {
            sanitized.bio = sanitizedBio;
        }
    }

    if (data.favoriteTeam !== undefined) {
        sanitized.favoriteTeam = sanitizeString(data.favoriteTeam).substring(0, 100);
    }

    return {
        valid: errors.length === 0,
        errors,
        sanitized,
    };
}

export default {
    isValidEmail,
    isValidUsername,
    sanitizeString,
    sanitizeUsername,
    isValidBio,
    isValidDisplayName,
    validateProfileUpdate,
};
