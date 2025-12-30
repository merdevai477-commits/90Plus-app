import React, { createContext, useContext, useState, useCallback } from 'react';
import CustomToast from '../components/common/CustomToast';

type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastState {
    visible: boolean;
    type: ToastType;
    title: string;
    message?: string;
}

interface ToastContextType {
    showToast: (type: ToastType, title: string, message?: string) => void;
    showSuccess: (title: string, message?: string) => void;
    showError: (title: string, message?: string) => void;
    showWarning: (title: string, message?: string) => void;
    showInfo: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState>({
        visible: false,
        type: 'success',
        title: '',
        message: undefined,
    });

    const showToast = useCallback((type: ToastType, title: string, message?: string) => {
        setToast({ visible: true, type, title, message });
    }, []);

    const showSuccess = useCallback((title: string, message?: string) => {
        showToast('success', title, message);
    }, [showToast]);

    const showError = useCallback((title: string, message?: string) => {
        showToast('error', title, message);
    }, [showToast]);

    const showWarning = useCallback((title: string, message?: string) => {
        showToast('warning', title, message);
    }, [showToast]);

    const showInfo = useCallback((title: string, message?: string) => {
        showToast('info', title, message);
    }, [showToast]);

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, visible: false }));
    }, []);

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
            {children}
            <CustomToast
                visible={toast.visible}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                onHide={hideToast}
            />
        </ToastContext.Provider>
    );
}

export function useToast() {
    const context = useContext(ToastContext);
    if (!context) {
        throw new Error('useToast must be used within a ToastProvider');
    }
    return context;
}
