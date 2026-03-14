/**
 * TEMPORARILY DISABLED: useProfileCompletion Hook
 * This hook has been disabled to fix infinite loop issues
 */

export interface UseProfileCompletionReturn {
  completionStatus: null;
  isLoading: false;
  error: null;
  refresh: () => Promise<void>;
  markStepCompleted: (stepId: string) => Promise<boolean>;
}

export function useProfileCompletion(): UseProfileCompletionReturn {
  return {
    completionStatus: null,
    isLoading: false,
    error: null,
    refresh: async () => {
      console.log('[useProfileCompletion] DISABLED - No action taken');
    },
    markStepCompleted: async (stepId: string) => {
      console.log('[useProfileCompletion] DISABLED - Step not marked:', stepId);
      return false;
    },
  };
}

// Helper functions (disabled)
export function isStepCompleted(): boolean {
  return false;
}

export function getStep(): null {
  return null;
}
