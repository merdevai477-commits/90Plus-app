/**
 * 🛡️ CSRF PROTECTION MIDDLEWARE
 * Protects against Cross-Site Request Forgery attacks
 * Uses Double Submit Cookie pattern for stateless CSRF protection
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { logger } from '../utils/logger';

/**
 * CSRF token configuration
 */
const CSRF_TOKEN_LENGTH = 32;
const CSRF_COOKIE_NAME = 'csrf-token';
const CSRF_HEADER_NAME = 'x-csrf-token';
const CSRF_COOKIE_MAX_AGE = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Generate a random CSRF token
 */
function generateCSRFToken(): string {
  return crypto.randomBytes(CSRF_TOKEN_LENGTH).toString('hex');
}

/**
 * Set CSRF token cookie
 */
export function setCSRFToken(req: Request, res: Response, next: NextFunction): void {
  // Check if token already exists in cookie
  let token = req.cookies?.[CSRF_COOKIE_NAME];

  // Generate new token if not exists
  if (!token) {
    token = generateCSRFToken();

    // Set cookie with secure options
    res.cookie(CSRF_COOKIE_NAME, token, {
      httpOnly: true, // Prevent JavaScript access
      secure: process.env.NODE_ENV === 'production', // HTTPS only in production
      sameSite: 'strict', // Prevent CSRF
      maxAge: CSRF_COOKIE_MAX_AGE,
    });

    logger.debug('CSRF token generated', {
      path: req.path,
      method: req.method,
    });
  }

  // Attach token to request for downstream use
  req.csrfToken = token;

  next();
}

/**
 * Verify CSRF token
 * Compares token from header with token from cookie
 */
export function verifyCSRFToken(req: Request, res: Response, next: NextFunction): void {
  // Skip CSRF check for safe methods (GET, HEAD, OPTIONS)
  if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    next();
    return;
  }

  // Get token from cookie
  const cookieToken = req.cookies?.[CSRF_COOKIE_NAME];

  // Get token from header
  const headerToken = req.headers[CSRF_HEADER_NAME] as string;

  // Check if both tokens exist
  if (!cookieToken || !headerToken) {
    logger.warn('CSRF token missing', {
      path: req.path,
      method: req.method,
      hasCookie: !!cookieToken,
      hasHeader: !!headerToken,
      ip: req.ip,
    });

    res.status(403).json({
      error: 'E003',
      message: 'CSRF token missing',
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  // Compare tokens using constant-time comparison to prevent timing attacks
  const isValid = crypto.timingSafeEqual(
    Buffer.from(cookieToken),
    Buffer.from(headerToken)
  );

  if (!isValid) {
    logger.warn('CSRF token mismatch', {
      path: req.path,
      method: req.method,
      ip: req.ip,
    });

    res.status(403).json({
      error: 'E003',
      message: 'Invalid CSRF token',
      timestamp: new Date().toISOString(),
      path: req.path,
    });
    return;
  }

  logger.debug('CSRF token verified', {
    path: req.path,
    method: req.method,
  });

  next();
}

/**
 * CSRF protection middleware (combines set and verify)
 * Use this for routes that need CSRF protection
 */
export function csrfProtection(req: Request, res: Response, next: NextFunction): void {
  // Set token first
  setCSRFToken(req, res, () => {
    // Then verify for unsafe methods
    verifyCSRFToken(req, res, next);
  });
}

/**
 * Get CSRF token endpoint
 * Frontend can call this to get a CSRF token
 */
export function getCSRFTokenHandler(req: Request, res: Response): void {
  const token = req.csrfToken || generateCSRFToken();

  // Set cookie
  res.cookie(CSRF_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: CSRF_COOKIE_MAX_AGE,
  });

  // Return token in response (for header usage)
  res.json({
    csrfToken: token,
  });
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      csrfToken?: string;
    }
  }
}
