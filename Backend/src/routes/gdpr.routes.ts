/**
 * GDPR Routes
 * 
 * Routes for GDPR compliance features
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { Router } from 'express';
import {
  requestDataExport,
  getExportStatus,
  requestAccountDeletion,
  cancelAccountDeletion,
  getDeletionStatus,
  updateConsent,
  getConsent,
} from '../controllers/gdpr.controller';
import { requireAuth } from '../middleware/clerk.middleware';
import rateLimit from 'express-rate-limit';

const router = Router();

// Rate limiters
const exportLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 3, // Max 3 export requests per day
  message: 'Too many export requests. Please try again tomorrow.',
});

const deletionLimiter = rateLimit({
  windowMs: 24 * 60 * 60 * 1000, // 24 hours
  max: 5, // Max 5 deletion requests per day
  message: 'Too many deletion requests. Please try again tomorrow.',
});

// All routes require authentication
router.use(requireAuth);

// ============================================================================
// Data Export Routes
// ============================================================================

// Request data export
router.post('/export-data', exportLimiter, requestDataExport);

// Get export status
router.get('/export-status/:requestId', getExportStatus);

// ============================================================================
// Account Deletion Routes
// ============================================================================

// Request account deletion
router.post('/delete-account', deletionLimiter, requestAccountDeletion);

// Cancel account deletion
router.post('/cancel-deletion', cancelAccountDeletion);

// Get deletion status
router.get('/deletion-status', getDeletionStatus);

// ============================================================================
// Consent Management Routes
// ============================================================================

// Update consent
router.post('/consent', updateConsent);

// Get consent
router.get('/consent', getConsent);

export default router;
