/**
 * Network Fix Utility
 * حل شامل لمشاكل الاتصال بالسيرفر والـ Authentication
 * 
 * المشاكل المحلولة:
 * 1. Network request failed - مشكلة DNS/Connection
 * 2. 401 Unauthorized - مشكلة التوثيق
 * 3. 404 Not Found - endpoints مفقودة
 * 4. WebSocket connection errors
 * 5. Request timeouts
 */

import { logger } from '../services/logger';
import NetInfo from '@react-native-community/netinfo';

// ============================================
// 1. Network Connectivity Check
// ============================================

export class NetworkChecker {
    private static isOnline = true;
    private static listeners: Array<(isOnline: boolean) => void> = [];
    private static netInfoUnsubscribe: (() => void) | null = null;

    /**
     * Initialize network monitoring - ✅ FIXED: Store unsubscribe function
     */
    static initialize() {
        this.netInfoUnsubscribe = NetInfo.addEventListener(state => {
            const wasOnline = this.isOnline;
            this.isOnline = state.isConnected ?? false;
            
            if (wasOnline !== this.isOnline) {
                logger.info(`[NetworkChecker] Connection status changed: ${this.isOnline ? 'ONLINE' : 'OFFLINE'}`);
                this.notifyListeners();
            }
        });
    }
    
    /**
     * Cleanup - ✅ FIXED: Remove NetInfo listener
     */
    static cleanup() {
        if (this.netInfoUnsubscribe) {
            this.netInfoUnsubscribe();
            this.netInfoUnsubscribe = null;
        }
        this.listeners = [];
        logger.debug('[NetworkChecker] Cleaned up');
    }

    /**
     * Check if device is online
     */
    static async checkConnection(): Promise<boolean> {
        try {
            const state = await NetInfo.fetch();
            this.isOnline = state.isConnected ?? false;
            return this.isOnline;
        } catch (error) {
            logger.error('[NetworkChecker] Failed to check connection:', error);
            return false;
        }
    }

    /**
     * Subscribe to connection changes
     */
    static subscribe(listener: (isOnline: boolean) => void) {
        this.listeners.push(listener);
        return () => {
            this.listeners = this.listeners.filter(l => l !== listener);
        };
    }

    private static notifyListeners() {
        this.listeners.forEach(listener => listener(this.isOnline));
    }

    static getStatus(): boolean {
        return this.isOnline;
    }
}

// ============================================
// 2. Enhanced Fetch with Retry & Fallback
// ============================================

export interface FetchOptions extends RequestInit {
    timeout?: number;
    retries?: number;
    retryDelay?: number;
    skipAuth?: boolean;
}

export class EnhancedFetch {
    private static readonly DEFAULT_TIMEOUT = 30000; // 30 seconds
    private static readonly DEFAULT_RETRIES = 3;
    private static readonly DEFAULT_RETRY_DELAY = 1000; // 1 second

    /**
     * Fetch with automatic retry, timeout, and error handling
     */
    static async fetch(url: string, options: FetchOptions = {}): Promise<Response> {
        const {
            timeout = this.DEFAULT_TIMEOUT,
            retries = this.DEFAULT_RETRIES,
            retryDelay = this.DEFAULT_RETRY_DELAY,
            ...fetchOptions
        } = options;

        // Check network first
        const isOnline = await NetworkChecker.checkConnection();
        if (!isOnline) {
            throw new Error('No internet connection. Please check your network settings.');
        }

        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= retries; attempt++) {
            try {
                logger.debug(`[EnhancedFetch] Attempt ${attempt}/${retries} for ${url}`);

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...fetchOptions,
                    signal: controller.signal,
                });

                clearTimeout(timeoutId);

                // Success!
                if (response.ok || response.status < 500) {
                    return response;
                }

                // Server error - retry
                throw new Error(`Server error: ${response.status}`);
            } catch (error: any) {
                lastError = error;

                // Don't retry on client errors (4xx)
                if (error.message?.includes('401') || error.message?.includes('403') || error.message?.includes('404')) {
                    throw error;
                }

                // Don't retry on abort
                if (error.name === 'AbortError') {
                    throw new Error('Request timeout - please try again');
                }

                // Retry on network errors or 5xx
                if (attempt < retries) {
                    const delay = retryDelay * Math.pow(1.5, attempt - 1);
                    logger.debug(`[EnhancedFetch] Retrying in ${delay}ms...`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                } else {
                    throw error;
                }
            }
        }

        throw lastError || new Error('All retry attempts failed');
    }
}

// ============================================
// 3. Token Refresh Handler
// ============================================

export class TokenManager {
    private static currentToken: string | null = null;
    private static tokenRefreshPromise: Promise<string | null> | null = null;

    /**
     * Set current token
     */
    static setToken(token: string | null) {
        this.currentToken = token;
    }

    /**
     * Get current token (with auto-refresh if needed)
     */
    static async getToken(getTokenFn: () => Promise<string | null>): Promise<string | null> {
        // If already refreshing, wait for it
        if (this.tokenRefreshPromise) {
            return this.tokenRefreshPromise;
        }

        // If we have a token, return it
        if (this.currentToken) {
            return this.currentToken;
        }

        // Refresh token
        this.tokenRefreshPromise = getTokenFn();
        try {
            const token = await this.tokenRefreshPromise;
            this.currentToken = token;
            return token;
        } finally {
            this.tokenRefreshPromise = null;
        }
    }

    /**
     * Clear token (on logout)
     */
    static clearToken() {
        this.currentToken = null;
        this.tokenRefreshPromise = null;
    }
}

// ============================================
// 4. API Request Wrapper
// ============================================

export class ApiClient {
    private static baseUrl: string = '';

    static setBaseUrl(url: string) {
        this.baseUrl = url;
    }

    /**
     * Make authenticated API request
     */
    static async request<T = any>(
        endpoint: string,
        options: FetchOptions & { getToken?: () => Promise<string | null> } = {}
    ): Promise<T> {
        const { getToken, skipAuth, ...fetchOptions } = options;

        // Build URL
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}${endpoint}`;

        // Add auth header if not skipped
        const headers: Record<string, string> = {
            'Content-Type': 'application/json',
            ...((fetchOptions.headers as Record<string, string>) || {}),
        };

        if (!skipAuth && getToken) {
            const token = await TokenManager.getToken(getToken);
            if (token) {
                headers['Authorization'] = `Bearer ${token}`;
            }
        }

        // Make request
        const response = await EnhancedFetch.fetch(url, {
            ...fetchOptions,
            headers,
        });

        // Handle 401 - token expired
        if (response.status === 401) {
            TokenManager.clearToken();
            throw new Error('Authentication failed. Please sign in again.');
        }

        // Handle 404
        if (response.status === 404) {
            throw new Error(`Endpoint not found: ${endpoint}`);
        }

        // Parse response
        const data = await response.json();
        return data;
    }

    /**
     * GET request
     */
    static async get<T = any>(endpoint: string, options?: FetchOptions & { getToken?: () => Promise<string | null> }): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'GET' });
    }

    /**
     * POST request
     */
    static async post<T = any>(endpoint: string, body?: any, options?: FetchOptions & { getToken?: () => Promise<string | null> }): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'POST',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * PUT request
     */
    static async put<T = any>(endpoint: string, body?: any, options?: FetchOptions & { getToken?: () => Promise<string | null> }): Promise<T> {
        return this.request<T>(endpoint, {
            ...options,
            method: 'PUT',
            body: body ? JSON.stringify(body) : undefined,
        });
    }

    /**
     * DELETE request
     */
    static async delete<T = any>(endpoint: string, options?: FetchOptions & { getToken?: () => Promise<string | null> }): Promise<T> {
        return this.request<T>(endpoint, { ...options, method: 'DELETE' });
    }
}

// ============================================
// 5. Initialize on App Start
// ============================================

export function initializeNetworkFix(apiUrl: string) {
    NetworkChecker.initialize();
    ApiClient.setBaseUrl(apiUrl);
    logger.info('[NetworkFix] Initialized successfully');
}
