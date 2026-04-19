/**
 * Error State Component
 * Comprehensive error handling with retry
 * Supports network errors, API errors, timeout errors, etc.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { AlertCircle, RefreshCw, ArrowLeft } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

export type ErrorStateType = 'network' | 'api' | 'timeout' | 'generic';

interface ErrorStateProps {
  error: string | Error;
  type?: ErrorStateType;
  onRetry: () => void | Promise<void>;
  onGoBack?: () => void;
}

const ErrorState: React.FC<ErrorStateProps> = ({
  error,
  type = 'generic',
  onRetry,
  onGoBack,
}) => {
  const [isRetrying, setIsRetrying] = useState(false);

  const errorMessage = error instanceof Error ? error.message : error;

  // Get user-friendly error message based on type
  const getUserFriendlyMessage = () => {
    if (errorMessage.toLowerCase().includes('network') || type === 'network') {
      return 'Network connection failed. Please check your internet connection.';
    }
    if (errorMessage.toLowerCase().includes('timeout') || type === 'timeout') {
      return 'Request timed out. Please try again.';
    }
    if (type === 'api') {
      return 'Server error occurred. Please try again later.';
    }
    return errorMessage || 'An error occurred. Please try again.';
  };

  const handleRetry = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setIsRetrying(true);
    try {
      await onRetry();
    } catch (err) {
      // Error is handled by the caller
    } finally {
      setIsRetrying(false);
    }
  };

  const handleGoBack = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (onGoBack) {
      onGoBack();
    }
  };

  return (
    <Animated.View
      entering={FadeIn.duration(300).springify()}
      style={styles.container}
    >
      <View style={styles.content}>
        {/* Error Icon */}
        <View style={styles.iconContainer}>
          <LinearGradient
            colors={['rgba(239, 68, 68, 0.2)', 'rgba(239, 68, 68, 0.1)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.iconGradient}
          >
            <AlertCircle size={48} color="#EF4444" />
          </LinearGradient>
        </View>

        {/* Error Title */}
        <Text style={styles.title} accessibilityRole="header">
          Oops!
        </Text>

        {/* Error Message */}
        <Text style={styles.message}>{getUserFriendlyMessage()}</Text>

        {/* Retry Button */}
        <TouchableOpacity
          style={styles.retryButton}
          onPress={handleRetry}
          activeOpacity={0.8}
          disabled={isRetrying}
          accessibilityRole="button"
          accessibilityLabel="Retry"
          accessibilityState={{ disabled: isRetrying }}
        >
          <LinearGradient
            colors={['#EF4444', '#F87171']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.retryGradient}
          >
            {isRetrying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <RefreshCw size={18} color="#FFFFFF" />
                <Text style={styles.retryText}>Try Again</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        {/* Go Back Button (optional) */}
        {onGoBack && (
          <TouchableOpacity
            style={styles.goBackButton}
            onPress={handleGoBack}
            activeOpacity={0.7}
            accessibilityRole="button"
            accessibilityLabel="Go back"
          >
            <ArrowLeft size={16} color="rgba(255, 255, 255, 0.7)" />
            <Text style={styles.goBackText}>Go Back</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 60,
    minHeight: 300,
  },
  content: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.05)',
    borderRadius: 24,
    padding: 40,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
    width: '100%',
    maxWidth: 400,
  },
  iconContainer: {
    marginBottom: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconGradient: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: 'rgba(255, 255, 255, 0.7)',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  retryButton: {
    borderRadius: 25,
    overflow: 'hidden',
    marginBottom: 16,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  retryGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    gap: 8,
    minWidth: 140,
  },
  retryText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },
  goBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingVertical: 10,
    gap: 6,
  },
  goBackText: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.7)',
  },
});

export default ErrorState;
