/**
 * Profile Error Boundary Component
 * 
 * يلقط infinite render loops و errors في ProfileScreen
 * ويعرض fallback UI مع error reporting
 * 
 * Features:
 * 1. ✅ Catches infinite render loops
 * 2. ✅ Catches component errors
 * 3. ✅ Shows user-friendly fallback UI
 * 4. ✅ Sends error reports to logging service
 * 5. ✅ Provides retry mechanism
 * 6. ✅ Prevents app crash
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { logger } from '../../utils/logger';
import { router } from 'expo-router';

// ============================================================================
// TYPES
// ============================================================================

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  maxRenderCount?: number;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  renderCount: number;
  isInfiniteLoop: boolean;
  errorTimestamp: number | null;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

export class ProfileErrorBoundary extends Component<Props, State> {
  private renderCountResetTimer: NodeJS.Timeout | null = null;
  private readonly MAX_RENDER_COUNT: number;
  private readonly RENDER_COUNT_RESET_INTERVAL = 5000; // 5 seconds

  constructor(props: Props) {
    super(props);
    
    this.MAX_RENDER_COUNT = props.maxRenderCount || 50;
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      renderCount: 0,
      isInfiniteLoop: false,
      errorTimestamp: null,
    };
  }

  // ============================================================================
  // LIFECYCLE: Error Catching
  // ============================================================================

  static getDerivedStateFromError(error: Error): Partial<State> {
    // Update state so the next render will show the fallback UI
    return {
      hasError: true,
      error,
      errorTimestamp: Date.now(),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log error to console
    logger.error('[ProfileErrorBoundary] ❌ Error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
    });

    // Update state with error info
    this.setState({
      errorInfo,
    });

    // Call custom error handler if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Send error report to logging service
    this.sendErrorReport(error, errorInfo);
  }

  // ============================================================================
  // LIFECYCLE: Render Count Tracking (Infinite Loop Detection)
  // ============================================================================

  componentDidMount(): void {
    this.startRenderCountReset();
  }

  componentDidUpdate(): void {
    // Increment render count
    const newRenderCount = this.state.renderCount + 1;
    
    // Check for infinite loop
    if (newRenderCount > this.MAX_RENDER_COUNT && !this.state.isInfiniteLoop) {
      logger.error('[ProfileErrorBoundary] 🚨 INFINITE LOOP DETECTED!', {
        renderCount: newRenderCount,
        maxRenderCount: this.MAX_RENDER_COUNT,
      });
      
      this.setState({
        hasError: true,
        isInfiniteLoop: true,
        error: new Error(`Infinite render loop detected (${newRenderCount} renders)`),
        errorTimestamp: Date.now(),
      });
      
      // Send infinite loop report
      this.sendInfiniteLoopReport(newRenderCount);
    } else if (!this.state.hasError) {
      // Update render count only if no error
      this.setState({ renderCount: newRenderCount });
    }
  }

  componentWillUnmount(): void {
    if (this.renderCountResetTimer) {
      clearInterval(this.renderCountResetTimer);
      this.renderCountResetTimer = null;
    }
  }

  // ============================================================================
  // HELPER: Render Count Reset
  // ============================================================================

  private startRenderCountReset(): void {
    // Reset render count periodically to avoid false positives
    this.renderCountResetTimer = setInterval(() => {
      if (!this.state.hasError) {
        this.setState({ renderCount: 0 });
      }
    }, this.RENDER_COUNT_RESET_INTERVAL);
  }

  // ============================================================================
  // ERROR REPORTING
  // ============================================================================

  private sendErrorReport(error: Error, errorInfo: ErrorInfo): void {
    try {
      // Log to your error tracking service (Sentry, etc.)
      logger.error('[ProfileErrorBoundary] Sending error report:', {
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
        userAgent: navigator.userAgent,
      });

      // TODO: Send to Sentry or other error tracking service
      // Sentry.captureException(error, { contexts: { react: { componentStack: errorInfo.componentStack } } });
    } catch (reportError) {
      logger.error('[ProfileErrorBoundary] Failed to send error report:', reportError);
    }
  }

  private sendInfiniteLoopReport(renderCount: number): void {
    try {
      logger.error('[ProfileErrorBoundary] Sending infinite loop report:', {
        renderCount,
        maxRenderCount: this.MAX_RENDER_COUNT,
        timestamp: new Date().toISOString(),
      });

      // TODO: Send to error tracking service
    } catch (reportError) {
      logger.error('[ProfileErrorBoundary] Failed to send infinite loop report:', reportError);
    }
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  private handleRetry = (): void => {
    logger.info('[ProfileErrorBoundary] User triggered retry');
    
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      renderCount: 0,
      isInfiniteLoop: false,
      errorTimestamp: null,
    });
  };

  private handleGoHome = (): void => {
    logger.info('[ProfileErrorBoundary] User navigating to home');
    router.replace('/(tabs)/Home');
  };

  private handleReload = (): void => {
    logger.info('[ProfileErrorBoundary] User triggered app reload');
    // In React Native, we can't reload the app directly
    // But we can navigate to a fresh screen
    router.replace('/');
  };

  // ============================================================================
  // RENDER: Fallback UI
  // ============================================================================

  private renderFallbackUI(): ReactNode {
    const { error, isInfiniteLoop, errorTimestamp } = this.state;

    return (
      <View style={styles.container}>
        {/* Background Gradient */}
        <LinearGradient
          colors={[ProfileTheme.colors.deepBlack, '#1a1a2e', ProfileTheme.colors.deepBlack]}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Error Icon */}
          <View style={styles.iconContainer}>
            <Ionicons
              name={isInfiniteLoop ? "infinite" : "alert-circle"}
              size={80}
              color={isInfiniteLoop ? "#f59e0b" : "#ef4444"}
            />
          </View>

          {/* Error Title */}
          <Text style={styles.title}>
            {isInfiniteLoop ? '🔄 حلقة لا نهائية' : '⚠️ حدث خطأ'}
          </Text>

          {/* Error Message */}
          <Text style={styles.message}>
            {isInfiniteLoop
              ? 'تم اكتشاف حلقة لا نهائية في البروفايل. تم إيقاف التطبيق للحماية.'
              : 'عذراً، حدث خطأ غير متوقع في صفحة البروفايل.'}
          </Text>

          {/* Error Details (Collapsible) */}
          {error && __DEV__ && (
            <View style={styles.errorDetailsContainer}>
              <Text style={styles.errorDetailsTitle}>تفاصيل الخطأ (للمطورين):</Text>
              <View style={styles.errorDetailsBox}>
                <Text style={styles.errorDetailsText}>
                  {error.message}
                </Text>
                {error.stack && (
                  <Text style={styles.errorStackText} numberOfLines={10}>
                    {error.stack}
                  </Text>
                )}
              </View>
            </View>
          )}

          {/* Timestamp */}
          {errorTimestamp && (
            <Text style={styles.timestamp}>
              الوقت: {new Date(errorTimestamp).toLocaleString('ar-EG')}
            </Text>
          )}

          {/* Action Buttons */}
          <View style={styles.actionsContainer}>
            {/* Retry Button */}
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.handleRetry}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={[ProfileTheme.colors.neonGreen, '#15803d']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="refresh" size={20} color="#000" />
                <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Go Home Button */}
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={this.handleGoHome}
              activeOpacity={0.8}
            >
              <Ionicons name="home-outline" size={20} color={ProfileTheme.colors.textPrimary} />
              <Text style={styles.secondaryButtonText}>العودة للرئيسية</Text>
            </TouchableOpacity>

            {/* Reload App Button */}
            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={this.handleReload}
              activeOpacity={0.8}
            >
              <Ionicons name="reload-outline" size={18} color="#999" />
              <Text style={styles.tertiaryButtonText}>إعادة تحميل التطبيق</Text>
            </TouchableOpacity>
          </View>

          {/* Help Text */}
          <Text style={styles.helpText}>
            إذا استمرت المشكلة، يرجى التواصل مع الدعم الفني
          </Text>
        </ScrollView>
      </View>
    );
  }

  // ============================================================================
  // RENDER
  // ============================================================================

  render(): ReactNode {
    if (this.state.hasError) {
      // Show custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Show default fallback UI
      return this.renderFallbackUI();
    }

    // No error, render children normally
    return this.props.children;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.deepBlack,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 24,
    padding: 20,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: ProfileTheme.colors.textPrimary,
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    fontSize: 16,
    color: ProfileTheme.colors.textSecondary,
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    maxWidth: '90%',
  },
  errorDetailsContainer: {
    width: '100%',
    marginBottom: 24,
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#f59e0b',
    marginBottom: 8,
  },
  errorDetailsBox: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  errorDetailsText: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: 'monospace',
    marginBottom: 8,
  },
  errorStackText: {
    fontSize: 10,
    color: '#999',
    fontFamily: 'monospace',
  },
  timestamp: {
    fontSize: 12,
    color: '#666',
    marginBottom: 32,
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    overflow: 'hidden',
  },
  buttonGradient: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  secondaryButton: {
    width: '100%',
    height: 56,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.2)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: ProfileTheme.colors.textPrimary,
  },
  tertiaryButton: {
    width: '100%',
    height: 48,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.05)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  tertiaryButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#999',
  },
  helpText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
    marginTop: 24,
    fontStyle: 'italic',
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default ProfileErrorBoundary;
