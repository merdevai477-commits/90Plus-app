/**
 * Content Filter Middleware
 * Apple Compliance - Guideline 1.2
 * 
 * Automatically filters text content in requests
 * Rejects requests with profanity
 */

import { Request, Response, NextFunction } from 'express';
import { filterText, isProfane } from '../utils/contentFilter';
import { logger } from '../utils/logger';

export interface FilterContentOptions {
  fields: string[]; // Fields to filter (e.g., ['caption', 'content', 'bio'])
  strict?: boolean; // If true, reject requests with profanity; if false, clean and allow
  logViolations?: boolean; // Log profanity violations
}

/**
 * Middleware to filter content in request body
 * @param options - Configuration options
 */
export function filterContentMiddleware(options: FilterContentOptions) {
  const { fields, strict = true, logViolations = true } = options;

  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      let hasProfanity = false;
      const violations: string[] = [];

      // Check each specified field
      for (const field of fields) {
        const value = req.body[field];

        if (value && typeof value === 'string') {
          const result = filterText(value);

          if (result.flagged) {
            hasProfanity = true;
            violations.push(field);

            if (logViolations) {
              logger.warn('Content filter violation', {
                field,
                userId: (req as any).userId,
                originalLength: result.originalLength,
                path: req.path,
              });
            }

            if (strict) {
              // Strict mode: reject the request
              res.status(400).json({
                status: 'ERROR',
                error: 'E001',
                message: 'Your content violates our community guidelines',
                code: 'CONTENT_MODERATION_FAILED',
                details: {
                  field,
                  reason: 'Inappropriate language detected',
                },
              });
              return;
            } else {
              // Non-strict mode: clean the content and continue
              req.body[field] = result.clean;
            }
          }
        }
      }

      // If we got here in non-strict mode with violations, log it
      if (!strict && hasProfanity && logViolations) {
        logger.info('Content auto-cleaned', {
          fields: violations,
          userId: (req as any).userId,
          path: req.path,
        });
      }

      next();
    } catch (error: any) {
      logger.error('Content filter middleware error:', error);
      // On error, allow request to continue (fail open for availability)
      next();
    }
  };
}

/**
 * Quick middleware for single field filtering
 * @param fieldName - Name of the field to filter
 * @param strict - Whether to reject or clean
 */
export function filterField(fieldName: string, strict: boolean = true) {
  return filterContentMiddleware({
    fields: [fieldName],
    strict,
    logViolations: true,
  });
}

/**
 * Middleware for filtering multiple common UGC fields
 */
export const filterUGCContent = filterContentMiddleware({
  fields: ['caption', 'content', 'bio', 'message', 'description', 'text'],
  strict: true,
  logViolations: true,
});

export default filterContentMiddleware;
