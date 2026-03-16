/**
 * Enhanced Network Service
 * حل شامل وقوي لمشاكل الشبكة والاتصال
 * 
 * الميزات:
 * 1. إعادة المحاولة التلقائية مع Exponential Backoff
 * 2. فحص حالة الاتصال بالإنترنت
 * 3. إدارة التوكن والمصادقة
 * 4. Cache ذكي للطلبات
 * 5. معالجة أخطاء الشبكة بشكل متقدم
 * 6. دعم WebSocket مع إعادة الاتصال التلقائي
 */

import NetInfo from '@react-native-community/netinfo';
import { logger } from '../services/logger';
import { getApiUrl } from '../config/api.config';

const API_URL = getApiUrl();

// Network configuration
const NETWORK_CONFIG = {
    maxRetries: 5,
    baseDelay: 1000, // 1 second
    maxDelay: 30000, // 30 seconds
    timeout: 30000, // 30 seconds
    healthCheckInterval: 60000, // 1 minute
    cacheTimeout: 300000, // 5 minutes
};

// Network state
interface NetworkState {
    isConnected: boolean;
    isInternetReachable: boolean;
    connectionType: string;
    isServerReachable: boolean;
    lastHealthCheck: number;
}

let networkState: NetworkState = {
    isConnected: false,
    isInternetReachable: false,
    connectionType: 'unknown',
    isServerReachable: false,
    lastHealthCheck: 0,
};

// Request cache
const requestCache = new Map<string, { data: any; timestamp: number; etag?: string }>();

// Pending requests to prevent duplicates
const pendingRequests = new Map<string, Promise<any>>();

/**
 * Enhanced Network Service Class
 */
export class EnhancedNetworkService {
    private static initialized = false;
    private static healthCheckTimer: NodeJS.Timeout | null = null;

    /**
     * Initialize the network service
     */
    static async initialize(): Promise<void> {
        if (this.initialized) return;

        try {
            // Listen to network state changes
            NetInfo.addEventListener(state => {
                const wasConnected = networkState.isConnected;
                
                networkState.isConnected = state.isConnected ?? false;
                networkState.isInternetReachable = state.isInternetReachable ?? false;
                networkState.connectionType = state.type || 'unknown';

                logger.info('[EnhancedNetwork] Network state changed:', {
                    isConnected: networkState.isConnected,
                    isInternetReachable: networkState.isInternetReachable,
                    type: networkState.connectionType,
                });

                // If we just got connected, check server health
                if (!wasConnected && networkState.isConnected) {
                    this.checkServerHealth();
                }
            });

            // Get initial network state
            const initialState = await NetInfo.fetch();
            networkState.isConnected = initialState.isConnected ?? false;
            networkState.isInternetReachable = initialState.isInternetReachable ?? false;
            networkState.connectionType = initialState.type || 'unknown';

            // Start periodic health checks
            this.startHealthChecks();

            // Initial server health check
            await this.checkServerHealth();

            this.initialized = true;
            logger.info('[EnhancedNetwork] Service initialized successfully');
        } catch (error) {
            logger.error('[EnhancedNetwork] Failed to initialize:', error);
        }
    }

    /**
     * Start periodic health checks
     */
    private static startHealthChecks(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
        }

        this.healthCheckTimer = setInterval(() => {
            if (networkState.isConnected) {
                this.checkServerHealth();
            }
        }, NETWORK_CONFIG.healthCheckInterval);
    }

    /**
     * Check server health
     */
    static async checkServerHealth(): Promise<boolean> {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

            const response = await fetch(`${API_URL}/health`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Cache-Control': 'no-cache',
                },
            });

            clearTimeout(timeoutId);

            const isHealthy = response.ok;
            networkState.isServerReachable = isHealthy;
            networkState.lastHealthCheck = Date.now();

            logger.debug('[EnhancedNetwork] Server health check:', {
                isHealthy,
                status: response.status,
                timestamp: new Date().toISOString(),
            });

            return isHealthy;
        } catch (error: any) {
            networkState.isServerReachable = false;
            networkState.lastHealthCheck = Date.now();
            
            logger.warn('[EnhancedNetwork] Server health check failed:', {
                error: error.message,
                timestamp: new Date().toISOString(),
            });
            
            return false;
        }
    }

    /**
     * Enhanced fetch with retry logic and caching
     */
    static async enhancedFetch(
        url: string,
        options: RequestInit = {},
        config: {
            useCache?: boolean;
            retries?: number;
            timeout?: number;
            priority?: 'low' | 'normal' | 'high';
        } = {}
    ): Promise<Response> {
        const {
            useCache = false,
            retries = NETWORK_CONFIG.maxRetries,
            timeout = NETWORK_CONFIG.timeout,
            priority = 'normal',
        } = config;

        // Check network connectivity first
        if (!networkState.isConnected) {
            throw new Error('No internet connection available');
        }

        // Generate cache key
        const cacheKey = `${options.method || 'GET'}_${url}_${JSON.stringify(options.body || {})}`;

        // Check cache if enabled
        if (useCache && options.method === 'GET') {
            const cached = this.getFromCache(cacheKey);
            if (cached) {
                logger.debug('[EnhancedNetwork] Returning cached response for:', url);
                return new Response(JSON.stringify(cached.data), {
                    status: 200,
                    headers: { 'Content-Type': 'application/json' },
                });
            }
        }

        // Check for pending request to prevent duplicates
        if (pendingRequests.has(cacheKey)) {
            logger.debug('[EnhancedNetwork] Waiting for pending request:', url);
            return await pendingRequests.get(cacheKey)!;
        }

        // Create the request promise
        const requestPromise = this.executeRequest(url, options, retries, timeout, priority);
        pendingRequests.set(cacheKey, requestPromise);

        try {
            const response = await requestPromise;

            // Cache successful GET requests
            if (useCache && options.method === 'GET' && response.ok) {
                const responseClone = response.clone();
                const data = await responseClone.json();
                this.setCache(cacheKey, data, response.headers.get('etag') || undefined);
            }

            return response;
        } finally {
            pendingRequests.delete(cacheKey);
        }
    }

    /**
     * Execute request with retry logic
     */
    private static async executeRequest(
        url: string,
        options: RequestInit,
        maxRetries: number,
        timeout: number,
        priority: string
    ): Promise<Response> {
        let lastError: Error | null = null;

        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                logger.debug(`[EnhancedNetwork] Request attempt ${attempt}/${maxRetries}:`, {
                    url,
                    method: options.method || 'GET',
                    priority,
                });

                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                const response = await fetch(url, {
                    ...options,
                    signal: controller.signal,
                    headers: {
                        ...options.headers,
                        'X-Request-Priority': priority,
                        'X-Retry-Attempt': attempt.toString(),
                    },
                });

                clearTimeout(timeoutId);

                // If successful or client error (4xx), don't retry
                if (response.ok || (response.status >= 400 && response.status < 500)) {
                    return response;
                }

                // Server error (5xx), retry
                throw new Error(`Server error: ${response.status} ${response.statusText}`);
            } catch (error: any) {
                lastError = error;

                // Don't retry on certain errors
                if (
                    error.name === 'AbortError' ||
                    error.message?.includes('401') ||
                    error.message?.includes('403') ||
                    error.message?.includes('404')
                ) {
                    throw error;
                }

                // If this is the last attempt, throw the error
                if (attempt === maxRetries) {
                    throw error;
                }

                // Calculate delay with exponential backoff
                const delay = Math.min(
                    NETWORK_CONFIG.baseDelay * Math.pow(2, attempt - 1),
                    NETWORK_CONFIG.maxDelay
                );

                logger.warn(`[EnhancedNetwork] Request failed, retrying in ${delay}ms:`, {
                    url,
                    attempt,
                    error: error.message,
                });

                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }

        throw lastError || new Error('All retry attempts failed');
    }

    /**
     * Get from cache
     */
    private static getFromCache(key: string): any | null {
        const cached = requestCache.get(key);
        if (cached && Date.now() - cached.timestamp < NETWORK_CONFIG.cacheTimeout) {
            return cached;
        }
        requestCache.delete(key);
        return null;
    }

    /**
     * Set cache
     */
    private static setCache(key: string, data: any, etag?: string): void {
        requestCache.set(key, {
            data,
            timestamp: Date.now(),
            etag,
        });

        // Limit cache size
        if (requestCache.size > 100) {
            const firstKey = requestCache.keys().next().value;
            if (firstKey) requestCache.delete(firstKey);
        }
    }

    /**
     * Clear cache
     */
    static clearCache(): void {
        requestCache.clear();
        logger.debug('[EnhancedNetwork] Cache cleared');
    }

    /**
     * Get network state
     */
    static getNetworkState(): NetworkState {
        return { ...networkState };
    }

    /**
     * Wait for network connection
     */
    static async waitForConnection(timeout = 30000): Promise<boolean> {
        if (networkState.isConnected && networkState.isInternetReachable) {
            return true;
        }

        return new Promise((resolve) => {
            const startTime = Date.now();
            
            const checkConnection = () => {
                if (networkState.isConnected && networkState.isInternetReachable) {
                    resolve(true);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    resolve(false);
                    return;
                }

                setTimeout(checkConnection, 1000);
            };

            checkConnection();
        });
    }

    /**
     * Cleanup
     */
    static cleanup(): void {
        if (this.healthCheckTimer) {
            clearInterval(this.healthCheckTimer);
            this.healthCheckTimer = null;
        }
        this.clearCache();
        pendingRequests.clear();
        this.initialized = false;
    }
}

/**
 * Enhanced API Client with automatic retry and error handling
 */
export class EnhancedApiClient {
    private token: string | null = null;

    constructor(token?: string) {
        this.token = token || null;
    }

    /**
     * Set authentication token
     */
    setToken(token: string): void {
        this.token = token;
    }

    /**
     * Make authenticated request
     */
    async request<T = any>(
        endpoint: string,
        options: RequestInit = {},
        config: {
            useCache?: boolean;
            retries?: number;
            timeout?: number;
            priority?: 'low' | 'normal' | 'high';
        } = {}
    ): Promise<T> {
        if (!this.token) {
            throw new Error('No authentication token provided');
        }

        const url = `${API_URL}${endpoint}`;
        const requestOptions: RequestInit = {
            ...options,
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.token}`,
                ...options.headers,
            },
        };

        try {
            const response = await EnhancedNetworkService.enhancedFetch(url, requestOptions, config);

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            return data;
        } catch (error: any) {
            logger.error('[EnhancedApiClient] Request failed:', {
                endpoint,
                method: options.method || 'GET',
                error: error.message,
            });
            throw error;
        }
    }

    /**
     * GET request
     */
    async get<T = any>(endpoint: string, config?: any): Promise<T> {
        return this.request<T>(endpoint, { method: 'GET' }, { useCache: true, ...config });
    }

    /**
     * POST request
     */
    async post<T = any>(endpoint: string, data?: any, config?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'POST',
            body: data ? JSON.stringify(data) : undefined,
        }, config);
    }

    /**
     * PUT request
     */
    async put<T = any>(endpoint: string, data?: any, config?: any): Promise<T> {
        return this.request<T>(endpoint, {
            method: 'PUT',
            body: data ? JSON.stringify(data) : undefined,
        }, config);
    }

    /**
     * DELETE request
     */
    async delete<T = any>(endpoint: string, config?: any): Promise<T> {
        return this.request<T>(endpoint, { method: 'DELETE' }, config);
    }
}

// Initialize the service
EnhancedNetworkService.initialize().catch(error => {
    logger.error('[EnhancedNetwork] Failed to initialize service:', error);
});

export default EnhancedNetworkService;