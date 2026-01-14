import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, Wifi, WifiOff, RefreshCw } from 'lucide-react-native';

interface ErrorDisplayProps {
  /** Error type */
  type?: 'network' | 'server' | 'generic' | 'offline';
  /** Error title */
  title?: string;
  /** Error message */
  message?: string;
  /** Show retry button */
  showRetry?: boolean;
  /** Retry button text */
  retryText?: string;
  /** Retry callback */
  onRetry?: () => void;
  /** Show refresh button */
  showRefresh?: boolean;
  /** Refresh callback */
  onRefresh?: () => void;
  /** Custom icon */
  icon?: React.ReactNode;
  /** Custom style */
  style?: any;
}

/**
 * Unified Error Display Component
 * Requirement: Medium Priority #8 - Improve Error Messages for users
 * Shows clear, user-friendly error messages with recovery options
 */
export const ErrorDisplay: React.FC<ErrorDisplayProps> = ({
  type = 'generic',
  title,
  message,
  showRetry = true,
  retryText = 'إعادة المحاولة',
  onRetry,
  showRefresh = false,
  onRefresh,
  icon,
  style,
}) => {
  // Default messages based on error type
  const getDefaultContent = () => {
    switch (type) {
      case 'network':
        return {
          icon: <WifiOff size={56} color="#FF5252" />,
          title: 'لا يوجد اتصال بالإنترنت',
          message: 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى',
        };
      case 'offline':
        return {
          icon: <WifiOff size={56} color="#FF9800" />,
          title: 'وضع عدم الاتصال',
          message: 'أنت غير متصل بالإنترنت. يتم عرض المحتوى المحفوظ.',
        };
      case 'server':
        return {
          icon: <AlertCircle size={56} color="#FF5252" />,
          title: 'خطأ في الخادم',
          message: 'حدث خطأ في الخادم. يرجى المحاولة لاحقاً',
        };
      default:
        return {
          icon: <AlertCircle size={56} color="#FF5252" />,
          title: 'حدث خطأ',
          message: 'عذراً، حدث خطأ غير متوقع',
        };
    }
  };

  const defaultContent = getDefaultContent();
  const displayIcon = icon || defaultContent.icon;
  const displayTitle = title || defaultContent.title;
  const displayMessage = message || defaultContent.message;

  return (
    <View style={[styles.container, style]}>
      <View style={styles.content}>
        {/* Icon */}
        <View style={styles.iconContainer}>{displayIcon}</View>

        {/* Title */}
        <Text style={styles.title}>{displayTitle}</Text>

        {/* Message */}
        <Text style={styles.message}>{displayMessage}</Text>

        {/* Actions */}
        <View style={styles.actions}>
          {/* Retry Button */}
          {showRetry && onRetry && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.8}
            >
              <RefreshCw size={20} color="#000000" />
              <Text style={styles.retryButtonText}>{retryText}</Text>
            </TouchableOpacity>
          )}

          {/* Refresh Button */}
          {showRefresh && onRefresh && (
            <TouchableOpacity
              style={styles.refreshButton}
              onPress={onRefresh}
              activeOpacity={0.8}
            >
              <Text style={styles.refreshButtonText}>تحديث</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  content: {
    alignItems: 'center',
    maxWidth: 320,
    width: '100%',
  },
  iconContainer: {
    marginBottom: 20,
    padding: 20,
    borderRadius: 60,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  title: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 32,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  retryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#FFD700',
    borderRadius: 24,
    shadowColor: '#FFD700',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  retryButtonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '600',
  },
  refreshButton: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
  },
  refreshButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
});
