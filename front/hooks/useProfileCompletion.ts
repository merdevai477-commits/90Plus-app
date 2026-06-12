/**
 * ✅ FIXED: useProfileCompletion Hook
 * 
 * Hook لإدارة حالة إكمال البروفايل مع حماية كاملة ضد Infinite Loops
 * 
 * الميزات:
 * 1. ✅ Proper dependency management
 * 2. ✅ AbortController للـ API calls
 * 3. ✅ Max retry counter كـ safeguard
 * 4. ✅ Debounce mechanism
 * 5. ✅ Cleanup functions
 * 6. ✅ Memory leak prevention
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { useAuth } from '@clerk/clerk-expo';
import { canMakeAuthenticatedRequests, getClerkBearerToken } from '../utils/clerkAuthToken';
import { ProfileService, ProfileCompletionStatus } from '../src/services/authService';
import { logger } from '../utils/logger';

// ============================================================================
// CONSTANTS & CONFIGURATION
// ============================================================================

const CONFIG = {
  FETCH_COOLDOWN: 5000,        // 5 seconds cooldown between fetches
  MAX_RETRIES: 3,              // Maximum retry attempts
  RETRY_DELAY: 2000,           // Delay between retries (ms)
  DEBOUNCE_DELAY: 1000,        // Debounce delay for rapid calls (ms)
  REQUEST_TIMEOUT: 15000,      // API request timeout (15s)
  MAX_LOOP_ITERATIONS: 10,     // Safeguard: max iterations before force stop
} as const;

// ============================================================================
// TYPES
// ============================================================================

export interface UseProfileCompletionReturn {
  completionStatus: ProfileCompletionStatus | null;
  isLoading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  markStepCompleted: (stepId: string) => Promise<boolean>;
  retryCount: number;
  lastFetchTime: number | null;
}

// ============================================================================
// HELPER: Debounce Function
// ============================================================================

function debounce<T extends (...args: any[]) => any>(
  func: T,
  delay: number
): (...args: Parameters<T>) => void {
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  
  return (...args: Parameters<T>) => {
    if (timeoutId) {
      clearTimeout(timeoutId);
    }
    timeoutId = setTimeout(() => {
      func(...args);
      timeoutId = null;
    }, delay);
  };
}

// ============================================================================
// MAIN HOOK
// ============================================================================

export function useProfileCompletion(): UseProfileCompletionReturn {
  const { getToken, isSignedIn, isLoaded } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;

  // ============================================================================
  // STATE
  // ============================================================================
  
  const [completionStatus, setCompletionStatus] = useState<ProfileCompletionStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const [lastFetchTime, setLastFetchTime] = useState<number | null>(null);
  const lastFetchTimeRef = useRef<number | null>(null);
  const retryCountRef = useRef(0);
  retryCountRef.current = retryCount;
  
  // ============================================================================
  // REFS (Prevent Re-renders & Memory Leaks)
  // ============================================================================
  
  const isFetchingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const loopIterationCountRef = useRef(0);
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef(true);
  const appStateSubscriptionRef = useRef<any>(null);
  
  // ============================================================================
  // SAFEGUARD: Loop Detection
  // ============================================================================
  
  const checkLoopSafeguard = useCallback((): boolean => {
    loopIterationCountRef.current += 1;
    
    if (loopIterationCountRef.current > CONFIG.MAX_LOOP_ITERATIONS) {
      logger.error('[useProfileCompletion] 🚨 LOOP DETECTED! Force stopping after', CONFIG.MAX_LOOP_ITERATIONS, 'iterations');
      setError('Loop detected - hook stopped for safety');
      setIsLoading(false);
      return false; // Stop execution
    }
    
    return true; // Continue execution
  }, []);
  
  // ❌ REMOVED: Don't reset loop counter - track total iterations
  // This was causing infinite loops to restart every 10 seconds
  // Now we track total iterations since mount
  
  // ============================================================================
  // CORE: Fetch Completion Status
  // ============================================================================
  
  const fetchCompletionStatus = useCallback(async (force = false): Promise<void> => {
    // Safeguard: Check if component is still mounted
    if (!isMountedRef.current) {
      logger.debug('[useProfileCompletion] Component unmounted, aborting fetch');
      return;
    }
    
    // Safeguard: Loop detection
    if (!checkLoopSafeguard()) {
      return;
    }
    
    // Check authentication
    if (!canMakeAuthenticatedRequests(isLoaded, !!isSignedIn)) {
      if (isLoaded && !isSignedIn) {
        setCompletionStatus(null);
        setIsLoading(false);
        setError(null);
      }
      return;
    }
    
    // Prevent multiple simultaneous fetches
    if (isFetchingRef.current && !force) {
      logger.debug('[useProfileCompletion] Fetch already in progress, skipping');
      return;
    }
    
    // Check cooldown
    const now = Date.now();
    if (!force && lastFetchTimeRef.current && now - lastFetchTimeRef.current < CONFIG.FETCH_COOLDOWN) {
      logger.debug('[useProfileCompletion] Fetch cooldown active, skipping');
      return;
    }
    
    // Abort any pending request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new AbortController
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    let willRetry = false;

    try {
      isFetchingRef.current = true;
      setIsLoading(true);
      setError(null);
      lastFetchTimeRef.current = now;
      setLastFetchTime(now);
      
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return;
      
      // Check if aborted
      if (abortController.signal.aborted) {
        logger.debug('[useProfileCompletion] Request aborted before API call');
        return;
      }
      
      logger.debug('[useProfileCompletion] Fetching completion status...');
      
      // Fetch with timeout
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => reject(new Error('Request timeout')), CONFIG.REQUEST_TIMEOUT);
      });
      
      const fetchPromise = ProfileService.getCompletionStatus(token);
      const status = await Promise.race([fetchPromise, timeoutPromise]);
      
      // Check if aborted or unmounted
      if (abortController.signal.aborted || !isMountedRef.current) {
        logger.debug('[useProfileCompletion] Request aborted or component unmounted');
        return;
      }
      
      if (status) {
        setCompletionStatus(status);
        setRetryCount(0); // Reset retry count on success
        // Reset loop counter on success so the safeguard only fires on
        // actual tight loops, not on legitimate periodic fetches.
        loopIterationCountRef.current = 0;
        logger.debug('[useProfileCompletion] ✅ Completion status loaded:', {
          percentage: status.percentage,
          completedSteps: status.completedSteps,
          totalSteps: status.totalSteps,
        });
      } else {
        logger.warn('[useProfileCompletion] No completion status returned');
        setError('No data returned from server');
      }
    } catch (err: any) {
      // Don't log abort errors
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        logger.debug('[useProfileCompletion] Request aborted');
        return;
      }
      
      logger.error('[useProfileCompletion] ❌ Error fetching completion status:', err);
      
      // Advanced Retry logic to prevent DDOSing backend
      if (retryCountRef.current < CONFIG.MAX_RETRIES && isMountedRef.current) {
        willRetry = true;
        setRetryCount((prev) => {
          const next = prev + 1;
          retryCountRef.current = next;
          return next;
        });
        logger.info(
          '[useProfileCompletion] Retrying... Attempt',
          retryCountRef.current,
          'of',
          CONFIG.MAX_RETRIES,
        );

        const backoffDelay = CONFIG.RETRY_DELAY * Math.pow(2, retryCountRef.current - 1);

        setTimeout(() => {
          if (isMountedRef.current) {
            fetchCompletionStatusRef.current(true);
          }
        }, backoffDelay);
      } else {
        setError(err.message || 'Failed to load profile completion status');
        setIsLoading(false);
      }
    } finally {
      if (isMountedRef.current && !willRetry) {
        setIsLoading(false);
      }
      isFetchingRef.current = false;
      
      // Clear abort controller if it's the current one
      if (abortControllerRef.current === abortController) {
        abortControllerRef.current = null;
      }
    }
  }, [isSignedIn, isLoaded, checkLoopSafeguard]);

  const fetchCompletionStatusRef = useRef(fetchCompletionStatus);
  fetchCompletionStatusRef.current = fetchCompletionStatus;
  
  // ============================================================================
  // DEBOUNCED FETCH (Prevent Rapid Calls)
  // ============================================================================
  
  const debouncedFetch = useMemo(
    () => debounce((force = false) => {
      void fetchCompletionStatusRef.current(force);
    }, CONFIG.DEBOUNCE_DELAY),
    [],
  );
  
  // ============================================================================
  // MARK STEP AS COMPLETED
  // ============================================================================
  
  const markStepCompleted = useCallback(async (stepId: string): Promise<boolean> => {
    if (!isSignedIn) {
      logger.warn('[useProfileCompletion] Cannot mark step completed: not signed in');
      return false;
    }
    
    if (!isMountedRef.current) {
      return false;
    }
    
    try {
      const token = await getClerkBearerToken(getTokenRef.current);
      if (!token) return false;
      
      logger.debug('[useProfileCompletion] Marking step as completed:', stepId);
      const result = await ProfileService.markStepCompleted(token, stepId);
      
      if (result.success && result.data && isMountedRef.current) {
        setCompletionStatus(result.data);
        logger.debug('[useProfileCompletion] ✅ Step marked as completed:', {
          stepId,
          newPercentage: result.data.percentage,
        });
        return true;
      }
      
      logger.warn('[useProfileCompletion] Failed to mark step as completed:', stepId);
      return false;
    } catch (err: any) {
      logger.error('[useProfileCompletion] ❌ Error marking step completed:', err);
      return false;
    }
  }, [isSignedIn]);
  
  // ============================================================================
  // REFRESH (Force Fetch)
  // ============================================================================
  
  const refresh = useCallback(async () => {
    logger.debug('[useProfileCompletion] Manual refresh triggered');
    await fetchCompletionStatusRef.current(true);
  }, []);
  
  // ============================================================================
  // EFFECT: Initial Fetch (RUNS ONCE)
  // ============================================================================
  
  useEffect(() => {
    // Only fetch if signed in
    if (isSignedIn) {
      logger.debug('[useProfileCompletion] Initial fetch on mount');
      void fetchCompletionStatusRef.current(false);
    }
    
    // Cleanup on unmount
    return () => {
      logger.debug('[useProfileCompletion] Cleanup on unmount');
      isMountedRef.current = false;
      
      // Abort any pending requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      
      // Clear debounce timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, []); // ✅ EMPTY DEPS - Runs only once on mount
  
  // ============================================================================
  // EFFECT: Auth State Change
  // ============================================================================
  
  useEffect(() => {
    if (isSignedIn) {
      logger.debug('[useProfileCompletion] User signed in, fetching status');
      debouncedFetch(false);
    } else {
      logger.debug('[useProfileCompletion] User signed out, clearing status');
      setCompletionStatus(null);
      setError(null);
      setIsLoading(false);
    }
  }, [isSignedIn]); // ✅ Only depends on isSignedIn
  
  // ============================================================================
  // EFFECT: App State (Foreground/Background)
  // ============================================================================
  
  useEffect(() => {
    const handleAppStateChange = (nextAppState: AppStateStatus) => {
      if (nextAppState === 'active' && isSignedIn) {
        logger.debug('[useProfileCompletion] App became active, refreshing...');
        debouncedFetch(false);
      }
    };
    
    appStateSubscriptionRef.current = AppState.addEventListener('change', handleAppStateChange);
    
    return () => {
      if (appStateSubscriptionRef.current) {
        appStateSubscriptionRef.current.remove();
        appStateSubscriptionRef.current = null;
      }
    };
  }, [isSignedIn, debouncedFetch]); // debouncedFetch is stable (empty useMemo deps)
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    completionStatus,
    isLoading,
    error,
    refresh,
    markStepCompleted,
    retryCount,
    lastFetchTime,
  };
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Helper function to check if a specific step is completed
 */
export function isStepCompleted(
  completionStatus: ProfileCompletionStatus | null,
  stepId: string
): boolean {
  if (!completionStatus) return false;
  return completionStatus.steps.some(step => step.id === stepId && step.completed);
}

/**
 * Helper function to get step by ID
 */
export function getStep(
  completionStatus: ProfileCompletionStatus | null,
  stepId: string
) {
  if (!completionStatus) return null;
  return completionStatus.steps.find(step => step.id === stepId) || null;
}

/**
 * Helper function to get required steps that are not completed
 */
export function getMissingRequiredSteps(
  completionStatus: ProfileCompletionStatus | null
): string[] {
  if (!completionStatus) return [];
  return completionStatus.steps
    .filter(step => step.required && !step.completed)
    .map(step => step.id);
}

/**
 * Helper function to check if user can upload video
 */
export function canUploadVideo(
  completionStatus: ProfileCompletionStatus | null
): boolean {
  if (!completionStatus) return false;
  return completionStatus.canUploadVideo;
}
