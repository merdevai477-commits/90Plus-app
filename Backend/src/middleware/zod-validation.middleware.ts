/**
 * 🛡️ ZOD INPUT VALIDATION MIDDLEWARE
 * Type-safe input validation using Zod schemas
 * Provides better type inference and error messages than class-validator
 */

import { Request, Response, NextFunction } from 'express';
import { z, ZodError, ZodSchema } from 'zod';
import { logger } from '../utils/logger';

/**
 * Validation location type
 */
export type ValidationLocation = 'body' | 'query' | 'params';

/**
 * Validation schema configuration
 */
export interface ZodValidationSchema {
  body?: ZodSchema;
  query?: ZodSchema;
  params?: ZodSchema;
}

/**
 * Validate request using Zod schemas
 */
export function validateZod(schema: ZodValidationSchema) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      // Validate body
      if (schema.body) {
        req.body = await schema.body.parseAsync(req.body);
      }

      // Validate query
      if (schema.query) {
        req.query = await schema.query.parseAsync(req.query);
      }

      // Validate params
      if (schema.params) {
        req.params = await schema.params.parseAsync(req.params);
      }

      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const errors = error.errors.map(err => ({
          field: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        logger.warn('Zod validation failed', {
          path: req.path,
          method: req.method,
          errors,
        });

        res.status(400).json({
          error: 'E001',
          message: 'Validation failed',
          details: errors,
          timestamp: new Date().toISOString(),
          path: req.path,
        });
        return;
      }

      logger.error('Validation middleware error', error);
      res.status(500).json({
        error: 'E010',
        message: 'Internal server error',
        timestamp: new Date().toISOString(),
        path: req.path,
      });
    }
  };
}

/**
 * Common Zod schemas for reuse
 */
export const CommonSchemas = {
  // UUID validation
  uuid: z.string().uuid({ message: 'Invalid UUID format' }),

  // Email validation
  email: z.string().email({ message: 'Invalid email format' }).max(255),

  // Username validation (3-20 chars, alphanumeric + underscore)
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(20, 'Username must be at most 20 characters')
    .regex(/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'),

  // Bio validation
  bio: z.string().max(500, 'Bio must be at most 500 characters').optional(),

  // Pagination
  pagination: z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(100).default(20),
  }),

  // Sort order
  sortOrder: z.enum(['asc', 'desc']).default('desc'),

  // Date range
  dateRange: z.object({
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
  }),

  // Search query
  searchQuery: z.string().min(1).max(100).trim(),

  // Caption/Content
  caption: z.string().max(2000, 'Caption must be at most 2000 characters').optional(),

  // Report reason
  reportReason: z.string().min(10, 'Reason must be at least 10 characters').max(500),

  // Report type
  reportType: z.enum(['SPAM', 'HARASSMENT', 'INAPPROPRIATE', 'FAKE_INFO', 'COPYRIGHT', 'OTHER']),

  // Match prediction
  predictionType: z.enum(['home', 'draw', 'away']),

  // Quiz difficulty
  quizDifficulty: z.enum(['EASY', 'MEDIUM', 'HARD']),

  // Language code
  languageCode: z.enum(['en', 'ar', 'es', 'fr', 'de', 'it', 'pt', 'tr']),

  // Positive integer
  positiveInt: z.coerce.number().int().positive(),

  // Non-negative integer
  nonNegativeInt: z.coerce.number().int().min(0),

  // Boolean
  boolean: z.coerce.boolean(),

  // Array of UUIDs
  uuidArray: z.array(z.string().uuid()),

  // Array of strings
  stringArray: z.array(z.string()),

  // Hashtags (max 10, 2-30 chars each)
  hashtags: z
    .array(
      z
        .string()
        .min(2, 'Hashtag must be at least 2 characters')
        .max(30, 'Hashtag must be at most 30 characters')
        .regex(/^[a-zA-Z0-9_]+$/, 'Hashtag can only contain letters, numbers, and underscores')
    )
    .max(10, 'Maximum 10 hashtags allowed'),

  // Mentions (array of usernames)
  mentions: z.array(
    z
      .string()
      .min(3)
      .max(20)
      .regex(/^[a-zA-Z0-9_]+$/)
  ),
};

/**
 * Example usage schemas
 */
export const ExampleSchemas = {
  // Create reel
  createReel: {
    body: z.object({
      caption: CommonSchemas.caption,
      hashtags: CommonSchemas.hashtags.optional(),
      mentions: CommonSchemas.mentions.optional(),
    }),
  },

  // Create comment
  createComment: {
    body: z.object({
      content: z.string().min(1).max(2000),
      parentId: CommonSchemas.uuid.optional(),
    }),
    params: z.object({
      reelId: CommonSchemas.uuid,
    }),
  },

  // Create report
  createReport: {
    body: z.object({
      type: CommonSchemas.reportType,
      reason: CommonSchemas.reportReason,
    }),
  },

  // Submit prediction
  submitPrediction: {
    body: z.object({
      apiMatchId: CommonSchemas.positiveInt,
      predictionType: CommonSchemas.predictionType,
    }),
  },

  // Get user profile
  getUserProfile: {
    params: z.object({
      username: CommonSchemas.username,
    }),
  },

  // Update profile
  updateProfile: {
    body: z.object({
      displayName: z.string().min(1).max(50).optional(),
      bio: CommonSchemas.bio,
      favoriteTeam: z.string().max(100).optional(),
      country: z.string().max(100).optional(),
      position: z.string().max(20).optional(),
      age: z.number().int().min(13).max(120).optional(),
      height: z.number().int().min(100).max(250).optional(),
      weight: z.number().int().min(30).max(200).optional(),
      preferredFoot: z.enum(['R', 'L', 'B']).optional(),
    }),
  },

  // Get reels feed
  getReelsFeed: {
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
      sortBy: z.enum(['recent', 'trending', 'views', 'shares']).default('recent'),
    }),
  },

  // Search
  search: {
    query: z.object({
      q: CommonSchemas.searchQuery,
      type: z.enum(['teams', 'players', 'leagues', 'users', 'all']).default('all'),
      page: z.coerce.number().int().min(1).default(1),
      limit: z.coerce.number().int().min(1).max(50).default(20),
    }),
  },
};

/**
 * Sanitize string to prevent XSS
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';

  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/&#/g, '') // Remove HTML entities
    .replace(/\\x/g, '') // Remove hex escapes
    .replace(/\\u/g, '') // Remove unicode escapes
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

/**
 * Custom Zod transformer for sanitizing strings
 */
export const sanitizedString = (schema: z.ZodString = z.string()) =>
  schema.transform(sanitizeString);

/**
 * Custom Zod transformer for sanitizing string arrays
 */
export const sanitizedStringArray = (schema: z.ZodArray<z.ZodString> = z.array(z.string())) =>
  schema.transform(arr => arr.map(sanitizeString));
