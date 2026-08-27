/**
 * Waiting for Consent Screen
 * 
 * Shown while waiting for parent to confirm consent
 * 
 * Features:
 * - Countdown timer (48 hours)
 * - Resend email option
 * - Change email option
 * - Auto-refresh status
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../src/i18n';
import { logger } from '../services/logger';
import { captureException } from '../services/sentry.service';
import { getApiEndpoint } from '../config/api.config';
import { useParentalConsentPoll } from '../hooks/useParentalConsentPoll';
import { fetchParentalConsentStatus } from '../hooks/useAgeVerification';

export default function WaitingConsentScreen() {
  const { getToken } = useAuth();
  const { translate: t, language, isRTL } = useTranslation();
  const params = useLocalSearchParams();
  
  const [parentEmail] = useState(params.parentEmail as string || '');
  const [expiresAt] = useState(params.expiresAt as string || '');
  const [timeRemaining, setTimeRemaining] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const { lastError: pollError, stopReason } = useParentalConsentPoll({
    getToken,
    expiresAt: expiresAt || undefined,
    fastIntervalMs: 30_000,
    maxFastPolls: 12,
    slowIntervalMs: 120_000,
    maxTotalChecks: 40,
    onConsentGranted: () => {
      logger.info('[WaitingConsent] Consent confirmed (poll)!');
      router.replace('/(tabs)/matches');
    },
  });

  // Calculate time remaining
  useEffect(() => {
    if (!expiresAt) return;

    const updateTimer = () => {
      const now = new Date().getTime();
      const expiry = new Date(expiresAt).getTime();
      const diff = expiry - now;

      if (diff <= 0) {
        setTimeRemaining(t('waitingConsent.expired') || 'Expired');
        return;
      }

      const hours = Math.floor(diff / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      
      setTimeRemaining(`${hours}h ${minutes}m`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [expiresAt, t]);

  const handleRefresh = async () => {
    setRefreshing(true);
    setError(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication token not found');

      const { ok, parentalConsent } = await fetchParentalConsentStatus(token);

      if (ok && parentalConsent) {
        logger.info('[WaitingConsent] Consent confirmed!');
        router.replace('/(tabs)/matches');
        return;
      }
    } catch (err: any) {
      logger.error('[WaitingConsent] Refresh failed:', err);
      setError(t('waitingConsent.refreshError') || 'Failed to check status');
    } finally {
      setRefreshing(false);
    }
  };

  const handleResend = async () => {
    setResending(true);
    setError(null);
    setSuccess(null);

    try {
      const token = await getToken();
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(getApiEndpoint('auth/resend-parental-consent'), {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to resend email');
      }

      logger.info('[WaitingConsent] Email resent successfully');
      setSuccess(t('waitingConsent.resendSuccess') || 'Email resent successfully!');

    } catch (err: any) {
      logger.error('[WaitingConsent] Resend failed:', err);
      captureException(err, {
        tags: { screen: 'WaitingConsent' },
      });
      
      setError(err.message || t('waitingConsent.resendError') || 'Failed to resend email');
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = () => {
    router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#22c55e"
          />
        }
      >
        {/* Icon */}
        <View style={styles.iconContainer}>
          <Ionicons name="hourglass-outline" size={80} color="#f59e0b" />
        </View>

        {/* Title */}
        <Text style={styles.title}>
          {t('waitingConsent.title') || 'Waiting for Parent'}
        </Text>

        {/* Email Info */}
        <View style={styles.emailBox}>
          <Text style={styles.emailLabel}>
            {t('waitingConsent.emailSentTo') || 'We sent an email to:'}
          </Text>
          <Text style={styles.emailText}>{parentEmail}</Text>
        </View>

        {/* Instructions */}
        <Text style={styles.instructions}>
          {t('waitingConsent.instructions') || 'Please ask your parent to check their email and confirm.'}
        </Text>

        {/* Timer */}
        {timeRemaining && (
          <View style={styles.timerBox}>
            <Ionicons name="time-outline" size={24} color="#f59e0b" />
            <View style={styles.timerContent}>
              <Text style={styles.timerLabel}>
                {t('waitingConsent.expiresIn') || 'Expires in:'}
              </Text>
              <Text style={styles.timerText}>{timeRemaining}</Text>
            </View>
          </View>
        )}

        {/* Success Message */}
        {success && (
          <View style={styles.successContainer}>
            <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            <Text style={styles.successText}>{success}</Text>
          </View>
        )}

        {/* Error Message */}
        {error && (
          <View style={styles.errorContainer}>
            <Ionicons name="alert-circle" size={20} color="#ef4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          <TouchableOpacity
            style={styles.resendButton}
            onPress={handleResend}
            disabled={resending}
          >
            {resending ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="refresh" size={20} color="#fff" />
                <Text style={styles.resendButtonText}>
                  {t('waitingConsent.resend') || 'Resend Email'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.changeButton}
            onPress={handleChangeEmail}
            disabled={loading}
          >
            <Ionicons name="create-outline" size={20} color="#22c55e" />
            <Text style={styles.changeButtonText}>
              {t('waitingConsent.changeEmail') || 'Change Email'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Help Text */}
        <View style={styles.helpBox}>
          <Ionicons name="help-circle-outline" size={24} color="#6b7280" />
          <View style={styles.helpContent}>
            <Text style={styles.helpTitle}>
              {t('waitingConsent.helpTitle') || "Didn't receive the email?"}
            </Text>
            <Text style={styles.helpText}>
              {t('waitingConsent.helpText') || 'Check spam folder or try resending'}
            </Text>
          </View>
        </View>

        {stopReason === 'cap' && (
          <Text style={styles.pullHint}>
            {t('waitingConsent.autoPollPaused') ||
              'Automatic checks paused to save data. Pull down to check status anytime.'}
          </Text>
        )}

        {/* Pull to Refresh Hint */}
        <Text style={styles.pullHint}>
          {t('waitingConsent.pullToRefresh') || 'Pull down to check status'}
        </Text>

        {pollError ? (
          <Text style={[styles.pullHint, { color: '#f87171', marginTop: 8 }]}>
            {pollError}
          </Text>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  iconContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 32,
  },
  emailBox: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
    alignItems: 'center',
  },
  emailLabel: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 8,
  },
  emailText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#22c55e',
  },
  instructions: {
    fontSize: 16,
    color: '#d1d5db',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  timerBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#78350f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  timerContent: {
    marginLeft: 12,
    flex: 1,
  },
  timerLabel: {
    fontSize: 14,
    color: '#fcd34d',
    marginBottom: 4,
  },
  timerText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fbbf24',
  },
  successContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#064e3b',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  successText: {
    fontSize: 14,
    color: '#86efac',
    marginLeft: 8,
    flex: 1,
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
  },
  errorText: {
    fontSize: 14,
    color: '#fca5a5',
    marginLeft: 8,
    flex: 1,
  },
  actionsContainer: {
    marginBottom: 32,
  },
  resendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  resendButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  changeButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
  },
  changeButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#22c55e',
    marginLeft: 8,
  },
  helpBox: {
    flexDirection: 'row',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  helpContent: {
    marginLeft: 12,
    flex: 1,
  },
  helpTitle: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  helpText: {
    fontSize: 12,
    color: '#9ca3af',
    lineHeight: 18,
  },
  pullHint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
    fontStyle: 'italic',
  },
});
