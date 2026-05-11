import crypto from 'crypto';

/**
 * Utility to hash strings using SHA-256 for exact match cache keys.
 *
 * @param text The string to hash
 * @returns The SHA-256 hash in hex format
 */
export function hashQuestion(text: string): string {
  // Normalize text before hashing: lowercase, remove extra spaces and common punctuation
  const normalized = text
    .toLowerCase()
    .trim()
    .replace(/[؟?!.,،؛;:]/g, ' ')
    .replace(/\s+/g, ' ');

  return crypto.createHash('sha256').update(normalized).digest('hex');
}
