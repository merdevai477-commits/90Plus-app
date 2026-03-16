import React, { createContext, useContext, ReactNode, useEffect } from 'react';
import { ProfessionalToast, ToastType } from '../components/common/ProfessionalToast';
import { useProfessionalToast } from '../hooks/useProfessionalToast';
import { toastManager } from '../services/toastManager';

interface ToastContextType {
  showSuccess: (title: string, message: string, options?: { duration?: number; position?: 'top' | 'center' | 'bottom' }) => void;
  showError: (title: string, message: string, options?: { duration?: number; position?: 'top' | 'center' | 'bottom' }) => void;
  showWarning: (title: string, message: string, options?: { duration?: number; position?: 'top' | 'center' | 'bottom' }) => void;
  showInfo: (title: string, message: string, options?: { duration?: number; position?: 'top' | 'center' | 'bottom' }) => void;
  showToast: (type: ToastType, title: string, message: string, options?: { duration?: number; position?: 'top' | 'center' | 'bottom' }) => void;
}

const ProfessionalToastContext = createContext<ToastContextType | undefined>(undefined);

interface ProfessionalToastProviderProps {
  children: ReactNode;
}

export const ProfessionalToastProvider: React.FC<ProfessionalToastProviderProps> = ({ children }) => {
  const {
    toastState,
    showToast,
    hideToast,
    showSuccess,
    showError,
    showWarning,
    showInfo,
  } = useProfessionalToast();

  // Register the toast manager callback
  useEffect(() => {
    toastManager.setShowToastCallback(showToast);
  }, [showToast]);

  const contextValue: ToastContextType = {
    showSuccess,
    showError,
    showWarning,
    showInfo,
    showToast,
  };

  return (
    <ProfessionalToastContext.Provider value={contextValue}>
      {children}
      <ProfessionalToast
        visible={toastState.visible}
        type={toastState.type}
        title={toastState.title}
        message={toastState.message}
        duration={toastState.duration}
        position={toastState.position}
        onHide={hideToast}
      />
    </ProfessionalToastContext.Provider>
  );
};

export const useProfessionalToastContext = (): ToastContextType => {
  const context = useContext(ProfessionalToastContext);
  if (!context) {
    throw new Error('useProfessionalToastContext must be used within a ProfessionalToastProvider');
  }
  return context;
};

export default ProfessionalToastProvider;