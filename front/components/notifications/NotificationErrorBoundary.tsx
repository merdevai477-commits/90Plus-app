import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { AlertCircle, RefreshCw } from 'lucide-react-native';
import * as Sentry from '@sentry/react-native';
import { COLORS } from '../reels/constants';
import { useLanguageStore } from '../../src/i18n/store';
import { translations } from '../../src/i18n/utils';

interface Props {
  children: React.ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Read translations directly from the Zustand store. Class components
 * can't use hooks, so we resolve the active language at render time.
 */
function getNotificationsT() {
  const lang = useLanguageStore.getState().language;
  return (translations[lang] ?? translations.en).notifications;
}

export class NotificationErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Notification Error:', error, errorInfo);

    Sentry.captureException(error, {
      contexts: {
        react: {
          componentStack: errorInfo.componentStack,
        },
      },
      tags: {
        screen: 'notifications',
      },
    });
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const tn = getNotificationsT();
      return (
        <View style={styles.container}>
          <AlertCircle size={64} color={COLORS.error} />
          <Text style={styles.title} numberOfLines={2}>{tn.somethingWentWrong}</Text>
          <Text style={styles.message} numberOfLines={3}>
            {this.state.error?.message || tn.unexpectedError}
          </Text>
          <TouchableOpacity style={styles.button} onPress={this.handleReset}>
            <RefreshCw size={20} color={COLORS.white} />
            <Text style={styles.buttonText}>{tn.tryAgain}</Text>
          </TouchableOpacity>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: COLORS.deepBlack,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginTop: 20,
  },
  message: {
    fontSize: 16,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginTop: 10,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: COLORS.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginTop: 20,
  },
  buttonText: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: '600',
  },
});

