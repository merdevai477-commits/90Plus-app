/**
 * Centralized API Configuration
 *
 * Provides environment-specific API URLs and settings.
 * Supports development, staging, and production environments.
 *
 * Requirements: 5.1, 5.2, 5.4
 */

import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Environment types
 */
export type Environment = 'development' | 'staging' | 'production';

/**
 * API Configuration interface
 */
export interface APIConfig {
  baseUrl: string;
  wsUrl: string;
  timeout: number;
  uploadTimeout: number; // Separate timeout for uploads
  retryAttempts: number;
}

/**
 * Environment-specific configuration
 * ✅ OPTIMIZED: Reduced timeout for faster failure detection
 */
const CONFIG: Record<Environment, APIConfig> = {
  development: {
    baseUrl: 'http://localhost:3000/api',
    wsUrl: 'ws://localhost:3000',
    timeout: 30000, // ✅ CRITICAL: Increased to 30s for slow connections
    uploadTimeout: 15 * 60 * 1000, // 15 minutes for uploads
    retryAttempts: 3, // ✅ Increased back to 3 for better reliability
  },
  staging: {
    baseUrl: 'https://staging-api.90plus.app/api',
    wsUrl: 'wss://staging-api.90plus.app',
    timeout: 30000, // ✅ CRITICAL: Increased to 30s
    uploadTimeout: 55 * 1000, // Railway-like gateway limits (keep under 60s)
    retryAttempts: 3,
  },
  production: {
    baseUrl: 'https://90plus-app-production-1808.up.railway.app/api',
    wsUrl: 'wss://90plus-app-production-1808.up.railway.app',
    timeout: 30000, // ✅ CRITICAL: Increased to 30s
    uploadTimeout: 55 * 1000, // Railway gateway limits (keep under 60s)
    retryAttempts: 3,
  },
};

/**
 * Check if URL is a production domain
 */
function isProductionDomain(url: string): boolean {
  return url.includes('railway.app') || 
         url.includes('90plus.app') || 
         url.includes('.up.railway.app') ||
         url.includes('railway.railway.app') ||
         url.includes('fly.dev');
}

/**
 * Validate and fix WebSocket URL
 * Ensures production domains always use wss:// (secure) and no port
 */
function validateWsUrl(url: string): string {
  // If it's a production domain, ensure it uses wss:// and no port
  if (isProductionDomain(url)) {
    // Remove any port
    let cleanUrl = url.replace(/:\d+/, '');
    
    // Ensure wss:// protocol
    if (cleanUrl.startsWith('ws://')) {
      cleanUrl = cleanUrl.replace('ws://', 'wss://');
    } else if (!cleanUrl.startsWith('wss://')) {
      // If no protocol, assume it's a host and add wss://
      cleanUrl = `wss://${cleanUrl}`;
    }
    
    return cleanUrl;
  }
  
  return url;
}

/**
 * Detect current environment
 */
function detectEnvironment(): Environment {
  // Priority 1: Check EXPO_PUBLIC_API_URL for production domains
  // If production URL is detected, force production environment (ignore __DEV__ flag)
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl && isProductionDomain(envApiUrl)) {
    return 'production';
  }

  // Priority 2: Check app.json extra config for production domains
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraApiUrl && isProductionDomain(extraApiUrl)) {
    return 'production';
  }

  // Priority 3: Check for explicit environment variable
  const envVar = process.env.EXPO_PUBLIC_ENV || process.env.NODE_ENV;

  if (envVar === 'production' || !__DEV__) {
    return 'production';
  }

  if (envVar === 'staging') {
    return 'staging';
  }

  return 'development';
}

/**
 * Get the current environment
 */
export function getEnvironment(): Environment {
  return detectEnvironment();
}

/**
 * Get the API configuration for the current environment
 * Requirement 5.2: Return appropriate URL for environment
 */
export function getAPIConfig(): APIConfig {
  const env = detectEnvironment();
  const config = { ...CONFIG[env] };

  // Override with ngrok URL if available (for mobile development)
  const ngrokUrl = getNgrokUrl();
  if (ngrokUrl && env === 'development') {
    config.baseUrl = `${ngrokUrl}/api`;
    config.wsUrl = ngrokUrl.replace('https://', 'wss://').replace('http://', 'ws://');
  }

  // Override with environment variables if set
  // Priority: EXPO_PUBLIC_API_URL always takes precedence (regardless of environment)
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    config.baseUrl = envApiUrl;
    // Always update wsUrl if it's a production URL (convert https:// to wss://)
    // This ensures WebSocket uses production URL even if environment detection fails
    if (envApiUrl.startsWith('https://')) {
      const wsHost = envApiUrl.replace('https://', '').replace('/api', '').split('/')[0];
      config.wsUrl = `wss://${wsHost}`;
    } else if (envApiUrl.startsWith('http://')) {
      // For local development HTTP URLs, convert to ws://
      const wsHost = envApiUrl.replace('http://', '').replace('/api', '').split('/')[0];
      // Extract port if present, otherwise use default 3000
      const portMatch = wsHost.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '3000';
      const hostWithoutPort = wsHost.split(':')[0];
      config.wsUrl = `ws://${hostWithoutPort}:${port}`;
    }
  }

  // Override with app.json extra config
  const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
  if (extraApiUrl && !ngrokUrl) {
    // Check if it's a production URL
    if (isProductionDomain(extraApiUrl)) {
      // Production URL: use it and update wsUrl to wss://
      config.baseUrl = extraApiUrl;
      if (extraApiUrl.startsWith('https://')) {
        const wsHost = extraApiUrl.replace('https://', '').replace('/api', '').split('/')[0];
        config.wsUrl = `wss://${wsHost}`;
      }
    } else if (extraApiUrl.includes('192.168.') || extraApiUrl.includes('localhost') || extraApiUrl.includes('127.0.0.1')) {
      // Local IP: only use in development, and only if EXPO_PUBLIC_API_URL is not set
      if (!envApiUrl && env === 'development') {
        config.baseUrl = extraApiUrl;
      }
    }
  }

  return config;
}

/**
 * Get ngrok URL if available (for mobile development)
 */
function getNgrokUrl(): string | null {
  // Check environment variable first
  const envNgrok = process.env.EXPO_PUBLIC_NGROK_URL;
  if (envNgrok) {
    return envNgrok;
  }

  // Check app.json extra config
  const extraNgrok = Constants.expoConfig?.extra?.ngrokUrl;
  if (extraNgrok) {
    return extraNgrok;
  }

  return null;
}

/**
 * Get the base API URL
 * Requirement 5.1: Retrieve URL from central configuration
 */
export function getApiUrl(): string {
  const config = getAPIConfig();

  // For mobile in development without ngrok, use local IP
  if (
    __DEV__ &&
    Platform.OS !== 'web' &&
    !getNgrokUrl() &&
    config.baseUrl.includes('localhost')
  ) {
    // Use apiUrl from app.json if available, otherwise fallback
    const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
    if (extraApiUrl) {
      return extraApiUrl;
    }
    const LOCAL_IP = Constants.expoConfig?.extra?.localIp || '192.168.1.6';
    return `http://${LOCAL_IP}:3000/api`;
  }

  return config.baseUrl;
}

/**
 * Full URL for a path under the API base (getApiUrl() already ends with /api).
 * Use this instead of `${EXPO_PUBLIC_API_URL}/api/...` to avoid /api/api/ duplicates.
 */
export function getApiEndpoint(suffix: string): string {
  const base = getApiUrl().replace(/\/$/, '');
  const s = suffix.startsWith('/') ? suffix.slice(1) : suffix;
  return `${base}/${s}`;
}

/**
 * Get the WebSocket URL
 * Priority order:
 * 1. EXPO_PUBLIC_API_URL (if set, always use it - highest priority)
 * 2. Production URL from config or app.json (if detected)
 * 3. ngrok URL (for development)
 * 4. Local IP (only if explicitly local and no production URL detected)
 */
export function getWsUrl(): string {
  const config = getAPIConfig();
  const env = getEnvironment();

  // Priority 1: EXPO_PUBLIC_API_URL always takes precedence
  // This ensures production URL is used even if environment detection fails
  const envApiUrl = process.env.EXPO_PUBLIC_API_URL;
  if (envApiUrl) {
    if (envApiUrl.startsWith('https://')) {
      const wsHost = envApiUrl.replace('https://', '').replace('/api', '').split('/')[0];
      const wsUrl = `wss://${wsHost}`;
      return validateWsUrl(wsUrl); // Validate and ensure correct format
    } else if (envApiUrl.startsWith('http://')) {
      // Check if it's production domain (should never happen, but safety check)
      if (isProductionDomain(envApiUrl)) {
        // Production domain with http:// - convert to wss://
        const wsHost = envApiUrl.replace('http://', '').replace('/api', '').split('/')[0];
        return validateWsUrl(`wss://${wsHost}`);
      }
      // Local development HTTP URL
      const wsHost = envApiUrl.replace('http://', '').replace('/api', '').split('/')[0];
      const portMatch = wsHost.match(/:(\d+)/);
      const port = portMatch ? portMatch[1] : '3000';
      const hostWithoutPort = wsHost.split(':')[0];
      return `ws://${hostWithoutPort}:${port}`;
    }
  }

  // Priority 2: Check if config.wsUrl is already set correctly (from getAPIConfig)
  // Validate it to ensure production domains use wss://
  if (config.wsUrl) {
    return validateWsUrl(config.wsUrl);
  }

  // Priority 3: Check if baseUrl is production and generate wsUrl from it
  if (config.baseUrl.startsWith('https://') && isProductionDomain(config.baseUrl)) {
    const wsHost = config.baseUrl.replace('https://', '').replace('/api', '').split('/')[0];
    return validateWsUrl(`wss://${wsHost}`);
  }

  // Priority 4: In production environment, ensure wss://
  if (env === 'production') {
    if (config.baseUrl.startsWith('https://')) {
      const wsHost = config.baseUrl.replace('https://', '').replace('/api', '').split('/')[0];
      return validateWsUrl(`wss://${wsHost}`);
    }
    return validateWsUrl(config.wsUrl);
  }

  // Priority 5: For staging, use configured staging URL
  if (env === 'staging') {
    return config.wsUrl;
  }

  // Priority 6: For development: handle local development scenarios
  if (__DEV__) {
    // Check if we have ngrok URL (takes priority over local IP)
    const ngrokUrl = getNgrokUrl();
    if (ngrokUrl) {
      return ngrokUrl.replace('https://', 'wss://').replace('http://', 'ws://');
    }

    // Only use local IP if:
    // 1. We're on mobile (not web)
    // 2. Config URL is localhost
    // 3. No production URL is detected anywhere
    if (Platform.OS !== 'web' && config.wsUrl.includes('localhost')) {
      const extraApiUrl = Constants.expoConfig?.extra?.apiUrl;
      // ONLY use extraApiUrl if it's explicitly local (not production)
      if (extraApiUrl && 
          (extraApiUrl.includes('192.168.') || 
           extraApiUrl.includes('localhost') || 
           extraApiUrl.includes('127.0.0.1')) &&
          !isProductionDomain(extraApiUrl)) {
        const match = extraApiUrl.match(/https?:\/\/([^:\/]+)/);
        if (match) {
          return `ws://${match[1]}:3000`;
        }
      }
      // Fallback to local IP from config
      const LOCAL_IP = Constants.expoConfig?.extra?.localIp || '192.168.1.6';
      return `ws://${LOCAL_IP}:3000`;
    }
  }

  // Default: return configured URL (with validation)
  return validateWsUrl(config.wsUrl);
}

/**
 * Get the request timeout
 */
export function getTimeout(): number {
  return getAPIConfig().timeout;
}

/**
 * Get the retry attempts count
 */
export function getRetryAttempts(): number {
  return getAPIConfig().retryAttempts;
}

/**
 * Get configuration for a specific environment (useful for testing)
 * Requirement 5.4: Support development, staging, production
 */
export function getConfigForEnvironment(env: Environment): APIConfig {
  return { ...CONFIG[env] };
}

/**
 * Check if running in development mode
 */
export function isDevelopment(): boolean {
  return detectEnvironment() === 'development';
}

/**
 * Check if running in production mode
 */
export function isProduction(): boolean {
  return detectEnvironment() === 'production';
}

// Export default config for convenience
export default {
  getApiUrl,
  getWsUrl,
  getTimeout,
  getRetryAttempts,
  getEnvironment,
  getAPIConfig,
  getConfigForEnvironment,
  isDevelopment,
  isProduction,
};
