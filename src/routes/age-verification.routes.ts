// @ts-nocheck
/**
 * Age Verification Routes
 */

import { Router } from 'express';
import {
  verifyAge,
  requestParentalConsent,
  confirmParentalConsent,
  getAgeStatus,
  resendParentalConsent,
} from '../controllers/age-verification.controller';
import { clerkMiddleware } from '../middleware/clerk.middleware';

const router = Router();

// ============================================================================
// PUBLIC ROUTES (No auth required)
// ============================================================================

/**
 * GET /api/auth/confirm-parental-consent/:token
 * 
 * Confirm parental consent via email link
 * Public endpoint (accessed from parent's email)
 */
router.get('/confirm-parental-consent/:token', confirmParentalConsent);

// ============================================================================
// PROTECTED ROUTES (Auth required)
// ============================================================================

/**
 * POST /api/auth/verify-age
 * 
 * Verify user's age with date of birth
 * 
 * Body:
 * {
 *   "dateOfBirth": "2005-03-15"
 * }
 * 
 * Response:
 * {
 *   "status": "SUCCESS",
 *   "ageTier": "TEEN",
 *   "requiresParentalConsent": true
 * }
 */
router.post('/verify-age', clerkMiddleware, verifyAge);

/**
 * POST /api/auth/request-parental-consent
 * 
 * Request parental consent for TEEN users (13-17)
 * 
 * Body:
 * {
 *   "parentEmail": "parent@example.com"
 * }
 * 
 * Response:
 * {
 *   "status": "SUCCESS",
 *   "requestId": "uuid",
 *   "expiresAt": "2026-04-01T12:00:00Z"
 * }
 */
router.post('/request-parental-consent', clerkMiddleware, requestParentalConsent);

/**
 * POST /api/auth/resend-parental-consent
 * 
 * Resend parental consent email
 * 
 * Response:
 * {
 *   "status": "SUCCESS",
 *   "message": "Consent email resent successfully"
 * }
 */
router.post('/resend-parental-consent', clerkMiddleware, resendParentalConsent);

/**
 * GET /api/auth/age-status
 * 
 * Get user's age verification status and restrictions
 * 
 * Response:
 * {
 *   "status": "SUCCESS",
 *   "ageVerified": true,
 *   "ageTier": "TEEN",
 *   "parentalConsent": true,
 *   "restrictions": {
 *     "canChat": false,
 *     "canCreateReels": true,
 *     "canComment": true
 *   }
 * }
 */
router.get('/age-status', clerkMiddleware, getAgeStatus);

export default router;
