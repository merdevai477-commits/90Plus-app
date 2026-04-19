import React, { createContext, useContext, useState, useCallback } from 'react';
import { ProfessionalToast, ToastType } from '../components/common/ProfessionalToast';

interface ToastState {
    visible: boolean;
    type: ToastType;
    title: string;
    message: string;
    duration?: number;
    position?: 'top' | 'center' | 'bottom';
    onPress?: () => void;
}

interface ToastOptions {
    duration?: number;
    position?: 'top' | 'center' | 'bottom';
    onPress?: () => void;
}

interface ToastContextType {
    showToast: (type: ToastType, title: string, message: string, options?: ToastOptions) => void;
    showSuccess: (title: string, message: string, options?: ToastOptions) => void;
    showError: (title: string, message: string, options?: ToastOptions) => void;
    showWarning: (title: string, message: string, options?: ToastOptions) => void;
    showInfo: (title: string, message: string, options?: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toast, setToast] = useState<ToastState>({
        visible: false,
        type: 'success',
        title: '',
        message: '',
        duration: 4000,
        position: 'top',
        onPress: undefined,
    });

    const showToast = useCallback((type: ToastType, title: string, message: string, options?: ToastOptions) => {
        setToast({ 
            visible: true, 
            type, 
            title, 
            message,
            duration: options?.duration || 4000,
            position: options?.position || 'top',
            onPress: options?.onPress,
        });
    }, []);

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

    const hideToast = useCallback(() => {
        setToast(prev => ({ ...prev, visible: false }));
    }, []);

    const handleToastPress = useCallback(() => {
        if (toast.onPress) {
            toast.onPress();
            hideToast();
        }
    }, [toast.onPress, hideToast]);

    return (
        <ToastContext.Provider value={{ showToast, showSuccess, showError, showWarning, showInfo }}>
            {children}
            <ProfessionalToast
                visible={toast.visible}
                type={toast.type}
                title={toast.title}
                message={toast.message}
                duration={toast.duration}
                position={toast.position}
                onHide={hideToast}
                onPress={toast.onPress ? handleToastPress : undefined}
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
