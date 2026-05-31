import React, { Component, ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import { logger } from '../../utils/logger';

export interface ReelsFeedErrorLabels {
  title: string;
  repeatedTitle: string;
  repeatedHint: string;
  retry: string;
  hint: string;
}

const DEFAULT_LABELS: ReelsFeedErrorLabels = {
  title: 'Could not load videos',
  repeatedTitle: 'Repeated error',
  repeatedHint: 'If this continues, please restart the app.',
  retry: 'Try again',
  hint: 'Check your internet connection',
};

interface Props {
  children: ReactNode;
  onRetry?: () => void;
  labels?: Partial<ReelsFeedErrorLabels>;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorCount: number;
}

/**
 * Error Boundary for Reels Feed
 * Catches errors in reels feed and displays a fallback UI
 */
export class ReelsFeedErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorCount: 0,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error('[ReelsFeedErrorBoundary] Reels feed error caught:', {
      error: error.message,
      stack: error.stack,
      componentStack: errorInfo.componentStack,
      errorCount: this.state.errorCount + 1,
    });

    this.setState(prev => ({
      errorCount: prev.errorCount + 1,
    }));

    if (this.state.errorCount > 5) {
      logger.error('[ReelsFeedErrorBoundary] Too many errors, stopping retries');
    }
  }

  handleRetry = () => {
    logger.info('[ReelsFeedErrorBoundary] User requested retry');
    this.setState({ hasError: false, error: null });
    this.props.onRetry?.();
  };

  render() {
    if (this.state.hasError) {
      const labels = { ...DEFAULT_LABELS, ...this.props.labels };
      const tooManyErrors = this.state.errorCount > 5;

      return (
        <View style={styles.errorContainer}>
          <View style={styles.errorContent}>
            <AlertCircle size={64} color="#FF3B30" />

            <Text style={styles.errorTitle}>
              {tooManyErrors ? labels.repeatedTitle : labels.title}
            </Text>

            <Text style={styles.errorMessage}>
              {tooManyErrors
                ? labels.repeatedHint
                : this.state.error?.message || labels.hint}
            </Text>

            {!tooManyErrors && (
              <TouchableOpacity
                style={styles.retryButton}
                onPress={this.handleRetry}
                activeOpacity={0.8}
              >
                <RefreshCw size={20} color="#000000" style={{ marginRight: 8 }} />
                <Text style={styles.retryButtonText}>{labels.retry}</Text>
              </TouchableOpacity>
            )}

            <Text style={styles.errorHint}>
              {tooManyErrors ? labels.repeatedHint : labels.hint}
            </Text>
          </View>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#000000',
    padding: 20,
  },
  errorContent: {
    alignItems: 'center',
    maxWidth: 320,
  },
  errorTitle: {
    color: '#FFFFFF',
    fontSize: 20,
    fontWeight: 'bold',
    marginTop: 24,
    marginBottom: 12,
    textAlign: 'center',
  },
  errorMessage: {
    color: 'rgba(255, 255, 255, 0.7)',
    fontSize: 15,
    textAlign: 'center',
    marginBottom: 32,
    lineHeight: 22,
  },
  retryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#FFD700',
    borderRadius: 28,
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
  errorHint: {
    color: 'rgba(255, 255, 255, 0.5)',
    fontSize: 13,
    textAlign: 'center',
    marginTop: 16,
  },
});
