/**
 * Parental Consent Screen (13-17)
 * 
 * Request parental consent for teen users
 * COPPA compliance requirement
 * 
 * Features:
 * - Parent email input
 * - Send consent request
 * - Email validation
 * - Rate limiting (3 requests/day)
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore } from '../src/i18n';
import { logger } from '../services/logger';
import { captureException } from '../services/sentry.service';

export default function ParentalConsentScreen() {
  const { getToken } = useAuth();
  const { t } = useLanguageStore();
  
  const [parentEmail, setParentEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validateEmail = (email: string): boolean => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const handleSendRequest = async () => {
    // Validation
    if (!parentEmail.trim()) {
      setError(t('parentalConsent.emailRequired') || 'Parent email is required');
      return;
    }

    if (!validateEmail(parentEmail)) {
      setError(t('parentalConsent.invalidEmail') || 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const token = await getToken();
      
      if (!token) {
        throw new Error('Authentication token not found');
      }

      // Call backend API
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/auth/request-parental-consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          parentEmail: parentEmail.trim().toLowerCase(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle rate limiting
        if (data.code === 'E006' || response.status === 429) {
          throw new Error(t('parentalConsent.rateLimitError') || 'Too many requests. Please try again tomorrow.');
        }

        throw new Error(data.message || 'Failed to send consent request');
      }

      logger.info('[ParentalConsent] Request sent successfully');

      // Navigate to waiting screen
      router.replace({
        pathname: '/waiting-consent',
        params: {
          parentEmail: parentEmail.trim().toLowerCase(),
          expiresAt: data.expiresAt,
        },
      });

    } catch (err: any) {
      logger.error('[ParentalConsent] Request failed:', err);
      captureException(err, {
        tags: { screen: 'ParentalConsent' },
        extra: { parentEmail },
      });
      
      setError(err.message || t('parentalConsent.requestError') || 'Failed to send request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="people-outline" size={80} color="#22c55e" />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {t('parentalConsent.title') || 'Parental Consent'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {t('parentalConsent.subtitle') || "You're 13-17 years old. We need your parent's permission to continue."}
          </Text>

          {/* Info Box */}
          <View style={styles.infoBox}>
            <Ionicons name="information-circle" size={24} color="#3b82f6" />
            <Text style={styles.infoText}>
              {t('parentalConsent.info') || "We'll send an email to your parent for verification. They'll need to confirm within 48 hours."}
            </Text>
          </View>

          {/* Email Input */}
          <View style={styles.inputContainer}>
            <Ionicons name="mail-outline" size={24} color="#9ca3af" />
            <TextInput
              style={styles.input}
              placeholder={t('parentalConsent.emailPlaceholder') || "Parent's Email"}
              placeholderTextColor="#6b7280"
              value={parentEmail}
              onChangeText={(text) => {
                setParentEmail(text);
                setError(null);
              }}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Send Button */}
          <TouchableOpacity
            style={[
              styles.sendButton,
              (!parentEmail.trim() || loading) && styles.sendButtonDisabled,
            ]}
            onPress={handleSendRequest}
            disabled={!parentEmail.trim() || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <>
                <Ionicons name="send" size={20} color="#000" />
                <Text style={styles.sendButtonText}>
                  {t('parentalConsent.sendRequest') || 'Send Request'}
                </Text>
              </>
            )}
          </TouchableOpacity>

          {/* What Happens Next */}
          <View style={styles.stepsContainer}>
            <Text style={styles.stepsTitle}>
              {t('parentalConsent.whatHappens') || 'What happens next?'}
            </Text>
            
            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>1</Text>
              </View>
              <Text style={styles.stepText}>
                {t('parentalConsent.step1') || "We'll email your parent"}
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>2</Text>
              </View>
              <Text style={styles.stepText}>
                {t('parentalConsent.step2') || 'They click the confirmation link'}
              </Text>
            </View>

            <View style={styles.step}>
              <View style={styles.stepNumber}>
                <Text style={styles.stepNumberText}>3</Text>
              </View>
              <Text style={styles.stepText}>
                {t('parentalConsent.step3') || 'You can start using 90Plus!'}
              </Text>
            </View>
          </View>

          {/* Privacy Note */}
          <View style={styles.privacyNote}>
            <Ionicons name="shield-checkmark-outline" size={20} color="#6b7280" />
            <Text style={styles.privacyText}>
              {t('parentalConsent.privacy') || "We respect your privacy. Your parent's email is only used for verification."}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  keyboardView: {
    flex: 1,
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
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#9ca3af',
    textAlign: 'center',
    marginBottom: 32,
    paddingHorizontal: 20,
    lineHeight: 24,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 32,
  },
  infoText: {
    fontSize: 14,
    color: '#93c5fd',
    marginLeft: 12,
    flex: 1,
    lineHeight: 20,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#374151',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 16,
  },
  input: {
    flex: 1,
    fontSize: 16,
    color: '#fff',
    paddingVertical: 12,
    marginLeft: 12,
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
  sendButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 32,
  },
  sendButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
    marginLeft: 8,
  },
  stepsContainer: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 20,
    marginBottom: 24,
  },
  stepsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  step: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#22c55e',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  stepNumberText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  stepText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
  },
  privacyNote: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  privacyText: {
    fontSize: 12,
    color: '#6b7280',
    marginLeft: 8,
    flex: 1,
    lineHeight: 18,
  },
});
