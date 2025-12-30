/**
 * ErrorBoundary Component
 *
 * Catches JavaScript errors in child components and displays a user-friendly
 * error screen instead of crashing the app.
 *
 * Requirements: 7.1, 7.2, 7.3, 7.4
 */

import React, { Component, ErrorInfo, ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  ScrollView,
} from 'react-native';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react-native';
import { logger } from '../services/logger';

/**
 * Props for the ErrorBoundary component
 */
export interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: ReactNode;
  onError?: (error: Error, errorInfo: ErrorInfo) => void;
  onRetry?: () => void;
  onGoHome?: () => void;
}

/**
 * State for the ErrorBoundary component
 */
export interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

/**
 * ErrorBoundary class component
 * Must be a class component to use componentDidCatch lifecycle method
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  /**
   * Static method to derive state from error
   * Requirement 7.1: Catch JavaScript errors in children
   */
  static getDerivedStateFromError(error: Error): Partial<ErrorBoundaryState> {
    return {
      hasError: true,
      error,
    };
  }

  /**
   * Lifecycle method called when an error is caught
   * Requirement 7.3: Log error details for debugging
   */
  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Log the error details
    logger.error('ErrorBoundary caught an error:', error.message);
    logger.error('Error stack:', error.stack || 'No stack trace');
    logger.error('Component stack:', errorInfo.componentStack);

    // Update state with error info
    this.setState({ errorInfo });

    // Call the optional onError callback
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
  }

  /**
   * Handle retry button press
   * Requirement 7.4: Provide retry option
   */
  handleRetry = (): void => {
    logger.info('User requested retry after error');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  /**
   * Handle go home button press
   * Requirement 7.4: Provide return to home option
   */
  handleGoHome = (): void => {
    logger.info('User requested to go home after error');
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });

    if (this.props.onGoHome) {
      this.props.onGoHome();
    }
  };

  /**
   * Render the error UI or children
   * Requirement 7.2: Display user-friendly error screen
   */
  render(): ReactNode {
    const { hasError, error } = this.state;
    const { children, fallback } = this.props;

    if (hasError) {
      // If a custom fallback is provided, use it
      if (fallback) {
        return fallback;
      }

      // Default error UI
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.content}>
              {/* Error Icon */}
              <View style={styles.iconContainer}>
                <AlertTriangle size={64} color="#ef4444" />
              </View>

              {/* Error Title */}
              <Text style={styles.title}>Oops! Something went wrong</Text>

              {/* Error Message */}
              <Text style={styles.message}>
                We encountered an unexpected error. Don't worry, your data is safe.
              </Text>

              {/* Error Details (only in development) */}
              {__DEV__ && error && (
                <View style={styles.errorDetails}>
                  <Text style={styles.errorDetailsTitle}>Error Details:</Text>
                  <Text style={styles.errorDetailsText}>{error.message}</Text>
                </View>
              )}

              {/* Action Buttons */}
              <View style={styles.buttonContainer}>
                {/* Retry Button */}
                <TouchableOpacity
                  style={styles.retryButton}
                  onPress={this.handleRetry}
                  activeOpacity={0.8}
                >
                  <RefreshCw size={20} color="#fff" />
                  <Text style={styles.retryButtonText}>Try Again</Text>
                </TouchableOpacity>

                {/* Go Home Button */}
                {this.props.onGoHome && (
                  <TouchableOpacity
                    style={styles.homeButton}
                    onPress={this.handleGoHome}
                    activeOpacity={0.8}
                  >
                    <Home size={20} color="#32CD32" />
                    <Text style={styles.homeButtonText}>Go Home</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </ScrollView>
        </SafeAreaView>
      );
    }

    return children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignItems: 'center',
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
  },
  message: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorDetails: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
    width: '100%',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.2)',
  },
  errorDetailsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
    marginBottom: 8,
  },
  errorDetailsText: {
    fontSize: 12,
    color: '#f87171',
    fontFamily: 'monospace',
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 8,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#32CD32',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    gap: 8,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  homeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'transparent',
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#32CD32',
    gap: 8,
  },
  homeButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#32CD32',
  },
});

export default ErrorBoundary;
