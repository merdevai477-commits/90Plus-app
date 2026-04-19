/**
 * 🐉 DRAGON MODE: Environment Variable Validator
 * Validates all required environment variables at app startup
 * Prevents runtime crashes from missing configuration
 */

import { logger } from '../services/logger';

interface EnvConfig {
  name: string;
  required: boolean;
  defaultValue?: string;
  validator?: (value: string) => boolean;
  errorMessage?: string;
}

const ENV_CONFIG: EnvConfig[] = [
  {
    name: 'EXPO_PUBLIC_API_URL',
    required: false, // Optional - has fallback logic
    validator: (val) => val.startsWith('http://') || val.startsWith('https://'),
    errorMessage: 'EXPO_PUBLIC_API_URL must start with http:// or https://',
  },
  {
    name: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY',
    required: true,
    validator: (val) => val.startsWith('pk_'),
    errorMessage: 'EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY must start with pk_',
  },
  {
    name: 'EXPO_PUBLIC_SPORTMONKS_TOKEN',
    required: false, // Optional
  },
];

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, string | undefined>;
}

/**
 * Validates all environment variables
 * Call this at app startup before rendering
 */
export function validateEnvironment(): ValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Record<string, string | undefined> = {};

  for (const envVar of ENV_CONFIG) {
    const value = process.env[envVar.name];

    // Check if required variable is missing
    if (envVar.required && !value) {
      errors.push(`Missing required environment variable: ${envVar.name}`);
      continue;
    }

    // Store value (even if undefined)
    config[envVar.name] = value;

    // Skip validation if value is undefined and not required
    if (!value) {
      if (!envVar.required) {
        warnings.push(`Optional environment variable not set: ${envVar.name}`);
      }
      continue;
    }

    // Run custom validator if provided
    if (envVar.validator && !envVar.validator(value)) {
      errors.push(
        envVar.errorMessage || `Invalid value for ${envVar.name}: ${value}`
      );
    }
  }

  const valid = errors.length === 0;

  // Log results
  if (!valid) {
    logger.error('❌ Environment validation failed:', errors);
  } else if (warnings.length > 0) {
    logger.warn('⚠️ Environment validation warnings:', warnings);
  } else {
    logger.info('✅ Environment validation passed');
  }

  return { valid, errors, warnings, config };
}

/**
 * Throws error if environment is invalid
 * Use this in app entry point
 */
export function requireValidEnvironment(): void {
  const result = validateEnvironment();
  
  if (!result.valid) {
    const errorMessage = `Environment validation failed:\n${result.errors.join('\n')}`;
    logger.error(errorMessage);
    throw new Error(errorMessage);
  }
}

/**
 * Gets environment variable with fallback
 * Safer than direct process.env access
 */
export function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    logger.warn(`Environment variable ${key} is undefined, returning empty string`);
    return '';
  }
  
  return value;
}

/**
 * Gets required environment variable or throws
 */
export function getRequiredEnv(key: string): string {
  const value = process.env[key];
  
  if (value === undefined || value === '') {
    throw new Error(`Required environment variable ${key} is not set`);
  }
  
  return value;
}
