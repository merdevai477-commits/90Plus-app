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
  /** Sentry / log label (e.g. ProfileScreen, PublicUserProfile). */
  screenLabel?: string;
  /** User-facing message when a render error is caught. */
  errorMessage?: string;
  /** User-facing message when an infinite render loop is detected. */
  infiniteLoopMessage?: string;
  /** Secondary navigation after an error — back to previous screen or home tab. */
  secondaryAction?: 'home' | 'back';
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
  isInfiniteLoop: boolean;
  errorTimestamp: number | null;
  retryKey: number;
}

// ============================================================================
// ERROR BOUNDARY COMPONENT
// ============================================================================

export class ProfileErrorBoundary extends Component<Props, State> {
  private renderCountResetTimer: ReturnType<typeof setTimeout> | null = null;
  private burstRenderCount = 0;
  private lastBurstAt = 0;
  private loopReportedRef = false;
  private readonly MAX_RENDER_COUNT: number;
  private readonly RENDER_COUNT_RESET_INTERVAL = 5000; // 5 seconds

  constructor(props: Props) {
    super(props);
    
    this.MAX_RENDER_COUNT = props.maxRenderCount || 50;
    
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      isInfiniteLoop: false,
      errorTimestamp: null,
      retryKey: 0,
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
    if (this.state.hasError) return;

    const now = Date.now();
    // Count bursts of updates (true infinite loops), not normal tab revisits over 5s.
    if (now - this.lastBurstAt > 1000) {
      this.burstRenderCount = 0;
      this.lastBurstAt = now;
    }
    this.burstRenderCount += 1;

    if (
      this.burstRenderCount > 35 &&
      !this.loopReportedRef &&
      !this.state.isInfiniteLoop
    ) {
      this.loopReportedRef = true;
      const count = this.burstRenderCount;

      logger.error('[ProfileErrorBoundary] 🚨 INFINITE LOOP DETECTED!', {
        renderCount: count,
        maxRenderCount: this.MAX_RENDER_COUNT,
      });

      // Defer state update so RN Modal unmount does not collide with this commit.
      queueMicrotask(() => {
        if (this.state.hasError) return;
        this.setState({
          hasError: true,
          isInfiniteLoop: true,
          error: new Error(`Infinite render loop detected (${count} renders)`),
          errorTimestamp: Date.now(),
        });
        this.sendInfiniteLoopReport(count);
      });
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
    // Legacy timer kept for compatibility; burst counter resets per-second in didUpdate.
    this.renderCountResetTimer = setInterval(() => {
      if (!this.state.hasError) {
        this.burstRenderCount = 0;
      }
    }, this.RENDER_COUNT_RESET_INTERVAL);
  }

  // ============================================================================
  // ERROR REPORTING
  // ============================================================================

  private sendErrorReport(error: Error, errorInfo: ErrorInfo): void {
    try {
      logger.error('[ProfileErrorBoundary] Sending error report:', {
        errorMessage: error.message,
        errorStack: error.stack,
        componentStack: errorInfo.componentStack,
        timestamp: new Date().toISOString(),
      });

      // Send to Sentry
      try {
        const { captureException } = require('../../services/sentry.service');
        captureException(error, {
          tags: { errorBoundary: this.props.screenLabel ?? 'ProfileScreen' },
          extra: { componentStack: errorInfo.componentStack },
          level: 'error',
        });
      } catch { /* Sentry not available */ }
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

      try {
        const { captureException } = require('../../services/sentry.service');
        captureException(new Error(`Infinite render loop: ${renderCount} renders`), {
          tags: {
            errorBoundary: this.props.screenLabel ?? 'ProfileScreen',
            type: 'infinite_loop',
          },
          level: 'fatal',
        });
      } catch { /* Sentry not available */ }
    } catch (reportError) {
      logger.error('[ProfileErrorBoundary] Failed to send infinite loop report:', reportError);
    }
  }

  // ============================================================================
  // ACTIONS
  // ============================================================================

  private handleRetry = (): void => {
    logger.info('[ProfileErrorBoundary] User triggered retry');
    
    this.burstRenderCount = 0;
    this.lastBurstAt = 0;
    this.loopReportedRef = false;
    
    this.setState((prev) => ({
      hasError: false,
      error: null,
      errorInfo: null,
      isInfiniteLoop: false,
      errorTimestamp: null,
      retryKey: prev.retryKey + 1,
    }));
  };

  private handleSecondaryNavigate = (): void => {
    if (this.props.secondaryAction === 'back') {
      logger.info('[ProfileErrorBoundary] User navigating back');
      if (router.canGoBack()) {
        router.back();
      } else {
        router.replace('/(tabs)/matches');
      }
      return;
    }
    logger.info('[ProfileErrorBoundary] User navigating to home');
    router.replace('/(tabs)/matches');
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
    const { error, isInfiniteLoop } = this.state;
    const {
      errorMessage = 'عذراً، حدث خطأ غير متوقع في صفحة البروفايل.',
      infiniteLoopMessage = 'تم إيقاف الصفحة مؤقتاً لحماية التطبيق. جرّب إعادة المحاولة.',
      secondaryAction = 'home',
    } = this.props;

    // Never show Metro/stack URLs to users — keep details in logs only.
    if (error) {
      logger.error('[ProfileErrorBoundary] fallback shown', {
        message: error.message,
        stack: error.stack?.slice(0, 500),
      });
    }

    return (
      <View style={styles.container}>
        <LinearGradient
          colors={['#1A0B33', '#0B0614', '#030303']}
          style={StyleSheet.absoluteFill}
        />

        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.iconWrap}>
            <LinearGradient colors={['#8B5CF6', '#5B21B6']} style={styles.iconBg}>
              <Ionicons
                name={isInfiniteLoop ? 'infinite' : 'alert-circle'}
                size={36}
                color="#fff"
              />
            </LinearGradient>
          </View>

          <Text style={styles.title}>
            {isInfiniteLoop ? 'توقف مؤقت' : 'حدث خطأ'}
          </Text>

          <Text style={styles.message}>
            {isInfiniteLoop ? infiniteLoopMessage : errorMessage}
          </Text>

          <View style={styles.actionsContainer}>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={this.handleRetry}
              activeOpacity={0.88}
            >
              <LinearGradient
                colors={['#8B5CF6', '#5B21B6']}
                style={styles.buttonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
              >
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.primaryButtonText}>إعادة المحاولة</Text>
              </LinearGradient>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={this.handleSecondaryNavigate}
              activeOpacity={0.85}
            >
              <Ionicons
                name={secondaryAction === 'back' ? 'arrow-back' : 'home-outline'}
                size={20}
                color={ProfileTheme.colors.avatarRing}
              />
              <Text style={styles.secondaryButtonText}>
                {secondaryAction === 'back' ? 'رجوع' : 'العودة للرئيسية'}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.tertiaryButton}
              onPress={this.handleReload}
              activeOpacity={0.85}
            >
              <Text style={styles.tertiaryButtonText}>إعادة تحميل التطبيق</Text>
            </TouchableOpacity>
          </View>
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

    return <React.Fragment key={this.state.retryKey}>{this.props.children}</React.Fragment>;
  }
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: ProfileTheme.colors.profileBg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  iconWrap: {
    marginBottom: 22,
  },
  iconBg: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.16)',
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.65)',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 28,
    maxWidth: '92%',
  },
  actionsContainer: {
    width: '100%',
    gap: 12,
  },
  primaryButton: {
    borderRadius: 14,
    overflow: 'hidden',
  },
  buttonGradient: {
    height: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  primaryButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '800',
  },
  secondaryButton: {
    height: 52,
    borderRadius: 14,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#26095C',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  secondaryButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  tertiaryButton: {
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  tertiaryButtonText: {
    color: ProfileTheme.colors.profileMuted,
    fontSize: 14,
    fontWeight: '600',
  },
});

// ============================================================================
// EXPORT
// ============================================================================

export default ProfileErrorBoundary;
