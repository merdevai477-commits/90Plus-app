import { useState, useCallback, useRef } from 'react';
import { ToastType } from '../components/common/ProfessionalToast';

interface ToastState {
  visible: boolean;
  type: ToastType;
  title: string;
  message: string;
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
}

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
}

export const useProfessionalToast = () => {
  const [toastState, setToastState] = useState<ToastState>({
    visible: false,
    type: 'info',
    title: '',
    message: '',
    duration: 4000,
    position: 'top',
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((
    type: ToastType,
    title: string,
    message: string,
    options?: ToastOptions
  ) => {
    // Clear any existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    setToastState({
      visible: true,
      type,
      title,
      message,
      duration: options?.duration || 4000,
      position: options?.position || 'top',
    });
  }, []);

  const hideToast = useCallback(() => {
    setToastState(prev => ({ ...prev, visible: false }));
  }, []);

  // Convenience methods for different toast types
  const showSuccess = useCallback((title: string, message: string, options?: ToastOptions) => {
    showToast('success', title, message, options);
  }, [showToast]);

  const showError = useCallback((title: string, message: string, options?: ToastOptions) => {
    showToast('error', title, message, options);
  }, [showToast]);

  const showWarning = useCallback((title: string, message: string, options?: ToastOptions) => {
    showToast('warning', title, message, options);
  }, [showToast]);

  const showInfo = useCallback((title: string, message: string, options?: ToastOptions) => {
    showToast('info', title, message, options);
  }, [showToast]);

  return {
    toastState,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  };
};

export default useProfessionalToast;