/**
 * 🔒 CENTRALIZED API CLIENT
 * Axios-based HTTP client with:
 * - Automatic authentication
 * - Request/response interceptors
 * - Error handling
 * - Retry logic
 * - Timeout configuration
 * - Offline queue support
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosError, AxiosResponse } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { getApiUrl, getTimeout, getRetryAttempts } from '../config/api.config';
import { logger } from '../utils/logger';

/**
 * Request queue for offline support
 */
interface QueuedRequest {
  id: string;
  config: AxiosRequestConfig;
  timestamp: number;
  retries: number;
}

class APIClient {
  private client: AxiosInstance;
  private requestQueue: QueuedRequest[] = [];
  private isOnline: boolean = true;
  private isProcessingQueue: boolean = false;
  private maxQueueSize: number = 50;
  private maxRetries: number = 3;

  constructor() {
    // Create Axios instance
    this.client = axios.create({
      baseURL: getApiUrl(),
      timeout: getTimeout(),
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
    });

    // Setup interceptors
    this.setupRequestInterceptor();
    this.setupResponseInterceptor();

    // Setup network listener
    this.setupNetworkListener();

    // Load queued requests from storage
    this.loadQueueFromStorage();
  }

  /**
   * Setup request interceptor
   * Adds authentication token to all requests
   */
  private setupRequestInterceptor(): void {
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Get authentication token
          const token = await AsyncStorage.getItem('@session_token');

          if (token) {
            config.headers.Authorization = `Bearer ${token}`;
          }

          // Add request ID for tracking
          config.headers['X-Request-ID'] = this.generateRequestId();

          // Add timestamp
          config.headers['X-Request-Time'] = new Date().toISOString();

          logger.debug('API Request', {
            method: config.method?.toUpperCase(),
            url: config.url,
            hasAuth: !!token,
          });

          return config;
        } catch (error) {
          logger.error('Request interceptor error', error);
          return config;
        }
      },
      (error) => {
        logger.error('Request interceptor error', error);
        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup response interceptor
   * Handles errors, retries, and token refresh
   */
  private setupResponseInterceptor(): void {
    this.client.interceptors.response.use(
      (response: AxiosResponse) => {
        logger.debug('API Response', {
          status: response.status,
          url: response.config.url,
          duration: this.calculateDuration(response.config),
        });

        return response;
      },
      async (error: AxiosError) => {
        const originalRequest = error.config as AxiosRequestConfig & { _retry?: boolean };

        // Log error
        logger.error('API Error', {
          status: error.response?.status,
          url: originalRequest?.url,
          message: error.message,
          code: error.code,
        });

        // Handle 401 Unauthorized (token expired)
        if (error.response?.status === 401 && !originalRequest._retry) {
          originalRequest._retry = true;

          try {
            // Try to refresh token
            const refreshed = await this.refreshToken();

            if (refreshed) {
              // Retry original request with new token
              return this.client(originalRequest);
            }
          } catch (refreshError) {
            logger.error('Token refresh failed', refreshError);
            // Clear token and redirect to login
            await this.handleAuthFailure();
            return Promise.reject(error);
          }
        }

        // Handle network errors (offline)
        if (error.code === 'ECONNABORTED' || error.code === 'ERR_NETWORK' || !error.response) {
          // Queue request for retry when online
          if (originalRequest && this.shouldQueueRequest(originalRequest)) {
            await this.queueRequest(originalRequest);
            return Promise.reject({
              ...error,
              message: 'Request queued for retry when online',
              queued: true,
            });
          }
        }

        // Handle 429 Too Many Requests (rate limit)
        if (error.response?.status === 429) {
          const retryAfter = error.response.headers['retry-after'];
          const delay = retryAfter ? parseInt(retryAfter) * 1000 : 5000;

          logger.warn('Rate limited, retrying after delay', {
            url: originalRequest?.url,
            retryAfter: delay,
          });

          // Wait and retry
          await this.delay(delay);
          return this.client(originalRequest);
        }

        // Handle 5xx Server Errors (retry with exponential backoff)
        if (error.response?.status && error.response.status >= 500) {
          const retries = (originalRequest as any)._retries || 0;
          const maxRetries = getRetryAttempts();

          if (retries < maxRetries) {
            (originalRequest as any)._retries = retries + 1;
            const delay = Math.pow(2, retries) * 1000; // Exponential backoff

            logger.warn('Server error, retrying', {
              url: originalRequest?.url,
              attempt: retries + 1,
              maxRetries,
              delay,
            });

            await this.delay(delay);
            return this.client(originalRequest);
          }
        }

        return Promise.reject(error);
      }
    );
  }

  /**
   * Setup network listener
   * Monitors online/offline status
   */
  private setupNetworkListener(): void {
    NetInfo.addEventListener((state) => {
      const wasOffline = !this.isOnline;
      this.isOnline = state.isConnected ?? false;

      logger.info('Network status changed', {
        isOnline: this.isOnline,
        type: state.type,
      });

      // Process queue when coming back online
      if (wasOffline && this.isOnline) {
        this.processQueue();
      }
    });
  }

  /**
   * Queue request for offline retry
   */
  private async queueRequest(config: AxiosRequestConfig): Promise<void> {
    // Check queue size limit
    if (this.requestQueue.length >= this.maxQueueSize) {
      logger.warn('Request queue full, removing oldest request');
      this.requestQueue.shift();
    }

    const queuedRequest: QueuedRequest = {
      id: this.generateRequestId(),
      config,
      timestamp: Date.now(),
      retries: 0,
    };

    this.requestQueue.push(queuedRequest);

    // Save to storage
    await this.saveQueueToStorage();

    logger.info('Request queued', {
      id: queuedRequest.id,
      url: config.url,
      queueSize: this.requestQueue.length,
    });
  }

  /**
   * Process queued requests
   */
  private async processQueue(): Promise<void> {
    if (this.isProcessingQueue || this.requestQueue.length === 0) {
      return;
    }

    this.isProcessingQueue = true;

    logger.info('Processing request queue', {
      queueSize: this.requestQueue.length,
    });

    while (this.requestQueue.length > 0 && this.isOnline) {
      const queuedRequest = this.requestQueue[0];

      try {
        // Retry request
        await this.client(queuedRequest.config);

        // Remove from queue on success
        this.requestQueue.shift();

        logger.info('Queued request succeeded', {
          id: queuedRequest.id,
          url: queuedRequest.config.url,
        });
      } catch (error) {
        queuedRequest.retries++;

        if (queuedRequest.retries >= this.maxRetries) {
          // Remove from queue after max retries
          this.requestQueue.shift();

          logger.error('Queued request failed after max retries', {
            id: queuedRequest.id,
            url: queuedRequest.config.url,
            retries: queuedRequest.retries,
          });
        } else {
          logger.warn('Queued request failed, will retry', {
            id: queuedRequest.id,
            url: queuedRequest.config.url,
            retries: queuedRequest.retries,
          });

          // Move to end of queue
          this.requestQueue.push(this.requestQueue.shift()!);
        }

        // Wait before next retry
        await this.delay(1000);
      }
    }

    // Save updated queue
    await this.saveQueueToStorage();

    this.isProcessingQueue = false;
  }

  /**
   * Save queue to AsyncStorage
   */
  private async saveQueueToStorage(): Promise<void> {
    try {
      await AsyncStorage.setItem('@request_queue', JSON.stringify(this.requestQueue));
    } catch (error) {
      logger.error('Failed to save request queue', error);
    }
  }

  /**
   * Load queue from AsyncStorage
   */
  private async loadQueueFromStorage(): Promise<void> {
    try {
      const queueJson = await AsyncStorage.getItem('@request_queue');
      if (queueJson) {
        this.requestQueue = JSON.parse(queueJson);
        logger.info('Loaded request queue from storage', {
          queueSize: this.requestQueue.length,
        });

        // Process queue if online
        if (this.isOnline) {
          this.processQueue();
        }
      }
    } catch (error) {
      logger.error('Failed to load request queue', error);
    }
  }

  /**
   * Refresh authentication token
   */
  private async refreshToken(): Promise<boolean> {
    try {
      // TODO: Implement token refresh logic with your auth provider (Clerk)
      // For now, return false to trigger re-authentication
      return false;
    } catch (error) {
      logger.error('Token refresh error', error);
      return false;
    }
  }

  /**
   * Handle authentication failure
   */
  private async handleAuthFailure(): Promise<void> {
    try {
      // Clear stored token
      await AsyncStorage.removeItem('@session_token');

      // TODO: Navigate to login screen
      // You can emit an event or use a navigation service here

      logger.info('Authentication failed, cleared token');
    } catch (error) {
      logger.error('Failed to handle auth failure', error);
    }
  }

  /**
   * Check if request should be queued
   */
  private shouldQueueRequest(config: AxiosRequestConfig): boolean {
    // Only queue POST, PUT, PATCH, DELETE requests
    const method = config.method?.toUpperCase();
    return ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method || '');
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Calculate request duration
   */
  private calculateDuration(config: AxiosRequestConfig): string {
    const startTime = (config as any).startTime;
    if (startTime) {
      return `${Date.now() - startTime}ms`;
    }
    return 'unknown';
  }

  /**
   * Delay helper
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Public API methods
   */

  public get<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.get<T>(url, config);
  }

  public post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.post<T>(url, data, config);
  }

  public put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.put<T>(url, data, config);
  }

  public patch<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.patch<T>(url, data, config);
  }

  public delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.client.delete<T>(url, config);
  }

  /**
   * Get queue status
   */
  public getQueueStatus() {
    return {
      size: this.requestQueue.length,
      isOnline: this.isOnline,
      isProcessing: this.isProcessingQueue,
      requests: this.requestQueue.map((req) => ({
        id: req.id,
        url: req.config.url,
        method: req.config.method,
        timestamp: req.timestamp,
        retries: req.retries,
      })),
    };
  }

  /**
   * Clear queue
   */
  public async clearQueue(): Promise<void> {
    this.requestQueue = [];
    await this.saveQueueToStorage();
    logger.info('Request queue cleared');
  }
}

// Export singleton instance
export const apiClient = new APIClient();

// Export default for convenience
export default apiClient;
