/**
 * useReportSystem Hook
 * Manages report system state and API calls
 * 
 * Features:
 * - Easy integration
 * - Automatic token management
 * - Error handling
 * - Success callbacks
 */

import { useState, useCallback } from 'react';
import { useAuth } from '@clerk/clerk-expo';

export interface UseReportSystemProps {
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

export interface ReportConfig {
  contentType: 'reel' | 'comment' | 'user';
  contentId: string;
}

export const useReportSystem = (props?: UseReportSystemProps) => {
  const { getToken } = useAuth();
  const [isVisible, setIsVisible] = useState(false);
  const [reportConfig, setReportConfig] = useState<ReportConfig | null>(null);

  const openReport = useCallback((config: ReportConfig) => {
    setReportConfig(config);
    setIsVisible(true);
  }, []);

  const closeReport = useCallback(() => {
    setIsVisible(false);
    // Clear config after animation
    setTimeout(() => {
      setReportConfig(null);
    }, 300);
  }, []);

  const handleSuccess = useCallback(() => {
    props?.onSuccess?.();
    closeReport();
  }, [props, closeReport]);

  const handleError = useCallback((error: Error) => {
    props?.onError?.(error);
  }, [props]);

  return {
    isVisible,
    reportConfig,
    openReport,
    closeReport,
    handleSuccess,
    handleError,
    getToken,
  };
};

// Convenience hooks for specific content types
export const useReelReport = (props?: UseReportSystemProps) => {
  const reportSystem = useReportSystem(props);

  const reportReel = useCallback((reelId: string) => {
    reportSystem.openReport({ contentType: 'reel', contentId: reelId });
  }, [reportSystem]);

  return {
    ...reportSystem,
    reportReel,
  };
};

export const useCommentReport = (props?: UseReportSystemProps) => {
  const reportSystem = useReportSystem(props);

  const reportComment = useCallback((commentId: string) => {
    reportSystem.openReport({ contentType: 'comment', contentId: commentId });
  }, [reportSystem]);

  return {
    ...reportSystem,
    reportComment,
  };
};

export const useUserReport = (props?: UseReportSystemProps) => {
  const reportSystem = useReportSystem(props);

  const reportUser = useCallback((userId: string) => {
    reportSystem.openReport({ contentType: 'user', contentId: userId });
  }, [reportSystem]);

  return {
    ...reportSystem,
    reportUser,
  };
};
