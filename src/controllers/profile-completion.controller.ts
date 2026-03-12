/**
 * Profile Completion Controller
 * Handles profile completion status and tracking
 */

import { Request, Response } from 'express';
import { ProfileCompletionService } from '../services/profile-completion.service';
import { logger } from '../utils/logger';

export class ProfileCompletionController {
  /**
   * Get profile completion status
   * GET /api/profile/completion
   */
  static async getCompletionStatus(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'ERROR',
          code: 'E002',
          message: 'Unauthorized',
        });
      }

      const status = await ProfileCompletionService.getCompletionStatus(userId);

      return res.status(200).json({
        status: 'SUCCESS',
        data: status,
      });
    } catch (error: any) {
      logger.error('Error getting profile completion status:', error);
      return res.status(500).json({
        status: 'ERROR',
        code: 'E010',
        message: error.message || 'Failed to get profile completion status',
      });
    }
  }

  /**
   * Mark a step as completed
   * POST /api/profile/completion/step
   */
  static async markStepCompleted(req: Request, res: Response) {
    try {
      const userId = req.userId;
      if (!userId) {
        return res.status(401).json({
          status: 'ERROR',
          code: 'E002',
          message: 'Unauthorized',
        });
      }

      const { stepId } = req.body;
      if (!stepId) {
        return res.status(400).json({
          status: 'ERROR',
          code: 'E001',
          message: 'Step ID is required',
        });
      }

      await ProfileCompletionService.markStepCompleted(userId, stepId);

      // Get updated status
      const status = await ProfileCompletionService.getCompletionStatus(userId);

      return res.status(200).json({
        status: 'SUCCESS',
        data: status,
        message: 'Step marked as completed',
      });
    } catch (error: any) {
      logger.error('Error marking step completed:', error);
      return res.status(500).json({
        status: 'ERROR',
        code: 'E010',
        message: error.message || 'Failed to mark step as completed',
      });
    }
  }
}
