/**
 * 🐉 DRAGON MODE: Input Validation Middleware
 * Validates and sanitizes all API inputs to prevent injection attacks
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

/**
 * Validation schema type
 */
export interface ValidationSchema {
  body?: Record<string, ValidationRule>;
  query?: Record<string, ValidationRule>;
  params?: Record<string, ValidationRule>;
}

export interface ValidationRule {
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required?: boolean;
  min?: number;
  max?: number;
  pattern?: RegExp;
  enum?: any[];
  custom?: (value: any) => boolean | string;
}

/**
 * Validate request against schema
 */
export function validate(schema: ValidationSchema) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const errors: string[] = [];

    // Validate body
    if (schema.body) {
      const bodyErrors = validateObject(req.body || {}, schema.body, 'body');
      errors.push(...bodyErrors);
    }

    // Validate query
    if (schema.query) {
      const queryErrors = validateObject(req.query || {}, schema.query, 'query');
      errors.push(...queryErrors);
    }

    // Validate params
    if (schema.params) {
      const paramsErrors = validateObject(req.params || {}, schema.params, 'params');
      errors.push(...paramsErrors);
    }

    if (errors.length > 0) {
      logger.warn('Validation failed:', { errors, path: req.path });
      res.status(400).json({
        status: 'ERROR',
        message: 'Validation failed',
        errors,
      });
      return;
    }

    next();
  };
}

/**
 * Validate object against rules
 */
function validateObject(
  obj: Record<string, any>,
  rules: Record<string, ValidationRule>,
  location: string
): string[] {
  const errors: string[] = [];

  for (const [key, rule] of Object.entries(rules)) {
    const value = obj[key];

    // Check required
    if (rule.required && (value === undefined || value === null || value === '')) {
      errors.push(`${location}.${key} is required`);
      continue;
    }

    // Skip validation if not required and not provided
    if (!rule.required && (value === undefined || value === null)) {
      continue;
    }

    // Type validation
    const typeError = validateType(value, rule.type, `${location}.${key}`);
    if (typeError) {
      errors.push(typeError);
      continue;
    }

    // String validations and sanitization
    if (rule.type === 'string' && typeof value === 'string') {
      // ✅ ZERO TRUST: Sanitize string before validation
      const sanitized = sanitizeString(value);
      obj[key] = sanitized; // Replace with sanitized version
      
      if (rule.min !== undefined && sanitized.length < rule.min) {
        errors.push(`${location}.${key} must be at least ${rule.min} characters`);
      }
      if (rule.max !== undefined && sanitized.length > rule.max) {
        errors.push(`${location}.${key} must be at most ${rule.max} characters`);
      }
      if (rule.pattern && !rule.pattern.test(sanitized)) {
        errors.push(`${location}.${key} has invalid format`);
      }
    }

    // Number validations
    if (rule.type === 'number' && typeof value === 'number') {
      if (rule.min !== undefined && value < rule.min) {
        errors.push(`${location}.${key} must be at least ${rule.min}`);
      }
      if (rule.max !== undefined && value > rule.max) {
        errors.push(`${location}.${key} must be at most ${rule.max}`);
      }
    }

    // Array validations
    if (rule.type === 'array' && Array.isArray(value)) {
      if (rule.min !== undefined && value.length < rule.min) {
        errors.push(`${location}.${key} must have at least ${rule.min} items`);
      }
      if (rule.max !== undefined && value.length > rule.max) {
        errors.push(`${location}.${key} must have at most ${rule.max} items`);
      }
    }

    // Enum validation
    if (rule.enum && !rule.enum.includes(value)) {
      errors.push(`${location}.${key} must be one of: ${rule.enum.join(', ')}`);
    }

    // Custom validation
    if (rule.custom) {
      const customResult = rule.custom(value);
      if (customResult !== true) {
        errors.push(typeof customResult === 'string' ? customResult : `${location}.${key} is invalid`);
      }
    }
  }

  return errors;
}

/**
 * Validate value type
 */
function validateType(value: any, type: string, path: string): string | null {
  switch (type) {
    case 'string':
      if (typeof value !== 'string') {
        return `${path} must be a string`;
      }
      break;
    case 'number':
      if (typeof value !== 'number' || isNaN(value)) {
        return `${path} must be a number`;
      }
      break;
    case 'boolean':
      if (typeof value !== 'boolean') {
        return `${path} must be a boolean`;
      }
      break;
    case 'array':
      if (!Array.isArray(value)) {
        return `${path} must be an array`;
      }
      break;
    case 'object':
      if (typeof value !== 'object' || value === null || Array.isArray(value)) {
        return `${path} must be an object`;
      }
      break;
  }
  return null;
}

/**
 * Sanitize string to prevent XSS and injection attacks
 * ✅ ZERO TRUST: Deep sanitization
 */
export function sanitizeString(str: string): string {
  if (typeof str !== 'string') return '';
  
  return str
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/data:/gi, '') // Remove data: protocol
    .replace(/vbscript:/gi, '') // Remove vbscript: protocol
    .replace(/on\w+\s*=/gi, '') // Remove event handlers (onclick=, onerror=, etc)
    .replace(/&#/g, '') // Remove HTML entities
    .replace(/\\x/g, '') // Remove hex escapes
    .replace(/\\u/g, '') // Remove unicode escapes
    .replace(/\0/g, '') // Remove null bytes
    .trim();
}

/**
 * Sanitize object recursively
 */
export function sanitizeObject(obj: any): any {
  if (typeof obj === 'string') {
    return sanitizeString(obj);
  }
  if (Array.isArray(obj)) {
    return obj.map(sanitizeObject);
  }
  if (typeof obj === 'object' && obj !== null) {
    const sanitized: any = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value);
    }
    return sanitized;
  }
  return obj;
}
