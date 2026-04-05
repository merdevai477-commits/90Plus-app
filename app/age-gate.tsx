/**
 * Age Gate Screen
 * 
 * First screen after splash - MANDATORY age verification
 * COPPA compliance requirement
 * 
 * Features:
 * - Date of Birth picker
 * - Age calculation
 * - Tier routing (BLOCKED/TEEN/ADULT)
 * - Cannot skip or go back
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
  ActivityIndicator,
  Platform,
  ScrollView,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../src/i18n';
import { logger } from '../services/logger';
import { captureException } from '../services/sentry.service';
import { getApiEndpoint } from '../config/api.config';

export default function AgeGateScreen() {
  const { getToken } = useAuth();
  const { translate: t, language, isRTL } = useTranslation();
  
  const [dateOfBirth, setDateOfBirth] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Calculate max date (today)
  const maxDate = new Date();
  
  // Calculate min date (120 years ago - reasonable limit)
  const minDate = new Date();
  minDate.setFullYear(minDate.getFullYear() - 120);

  const handleDateChange = (event: any, selectedDate?: Date) => {
    setShowDatePicker(Platform.OS === 'ios');
    
    if (selectedDate) {
      setDateOfBirth(selectedDate);
      setError(null);
    }
  };

  const formatDate = (date: Date): string => {
    const day = date.getDate().toString().padStart(2, '0');
    const month = (date.getMonth() + 1).toString().padStart(2, '0');
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleContinue = async () => {
    if (!dateOfBirth) {
      setError(t('ageGate.selectDateError') || 'Please select your date of birth');
      return;
    }

    // Check if date is in the future
    if (dateOfBirth > new Date()) {
      setError(t('ageGate.futureDateError') || 'Date cannot be in the future');
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
      const response = await fetch(getApiEndpoint('auth/verify-age'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          dateOfBirth: dateOfBirth.toISOString().split('T')[0], // YYYY-MM-DD
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle age restriction (under 13)
        if (data.code === 'AGE_RESTRICTED' || data.ageTier === 'BLOCKED') {
          logger.info('[AgeGate] User blocked (under 13)');
          router.replace('/blocked');
          return;
        }

        throw new Error(data.message || 'Failed to verify age');
      }

      logger.info('[AgeGate] Age verified:', data.ageTier);

      // Route based on age tier
      if (data.ageTier === 'TEEN' && data.requiresParentalConsent) {
        // 13-17: Requires parental consent
        router.replace('/parental-consent');
      } else if (data.ageTier === 'ADULT') {
        // 18+: Continue to app
        router.replace('/(tabs)/Home');
      } else {
        // Unexpected tier
        throw new Error('Unexpected age tier');
      }

    } catch (err: any) {
      logger.error('[AgeGate] Verification failed:', err);
      captureException(err, {
        tags: { screen: 'AgeGate' },
        extra: { dateOfBirth: dateOfBirth?.toISOString() },
      });
      
      setError(err.message || t('ageGate.verificationError') || 'Failed to verify age. Please try again.');
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
          {/* Logo/Icon */}
          <View style={styles.iconContainer}>
            <Ionicons name="calendar-outline" size={80} color="#22c55e" />
          </View>

          {/* Title */}
          <Text style={styles.title}>
            {t('ageGate.title') || 'Welcome to 90Plus'}
          </Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {t('ageGate.subtitle') || 'To continue, please verify your age'}
          </Text>

          {/* Date Picker Button */}
          <TouchableOpacity
            style={styles.dateButton}
            onPress={() => setShowDatePicker(true)}
            disabled={loading}
          >
            <Ionicons name="calendar" size={24} color="#fff" />
            <Text style={styles.dateButtonText}>
              {dateOfBirth
                ? formatDate(dateOfBirth)
                : t('ageGate.selectDate') || 'Select Date of Birth'}
            </Text>
          </TouchableOpacity>

          {/* Date Picker */}
          {showDatePicker && (
            <DateTimePicker
              value={dateOfBirth || new Date(2000, 0, 1)}
              mode="date"
              display={Platform.OS === 'ios' ? 'spinner' : 'default'}
              onChange={handleDateChange}
              maximumDate={maxDate}
              minimumDate={minDate}
              textColor="#fff"
            />
          )}

          {/* Error Message */}
          {error && (
            <View style={styles.errorContainer}>
              <Ionicons name="alert-circle" size={20} color="#ef4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          {/* Continue Button */}
          <TouchableOpacity
            style={[
              styles.continueButton,
              (!dateOfBirth || loading) && styles.continueButtonDisabled,
            ]}
            onPress={handleContinue}
            disabled={!dateOfBirth || loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.continueButtonText}>
                {t('ageGate.continue') || 'Continue'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Info Text */}
          <View style={styles.infoContainer}>
            <Ionicons name="information-circle-outline" size={20} color="#6b7280" />
            <Text style={styles.infoText}>
              {t('ageGate.whyWeAsk') || 'Why we ask: COPPA compliance & safety'}
            </Text>
          </View>

          {/* Privacy Links */}
          <View style={styles.linksContainer}>
            <TouchableOpacity onPress={() => {/* TODO: Open privacy policy */}}>
              <Text style={styles.linkText}>
                {t('ageGate.privacyPolicy') || 'Privacy Policy'}
              </Text>
            </TouchableOpacity>
            <Text style={styles.linkSeparator}>•</Text>
            <TouchableOpacity onPress={() => {/* TODO: Open terms */}}>
              <Text style={styles.linkText}>
                {t('ageGate.terms') || 'Terms of Service'}
              </Text>
            </TouchableOpacity>
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
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  iconContainer: {
    marginBottom: 32,
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
    marginBottom: 48,
    paddingHorizontal: 20,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1f2937',
    borderWidth: 2,
    borderColor: '#374151',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 24,
    width: '100%',
    maxWidth: 400,
    marginBottom: 24,
  },
  dateButtonText: {
    fontSize: 18,
    color: '#fff',
    marginLeft: 12,
    fontWeight: '600',
  },
  errorContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#7f1d1d',
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    width: '100%',
    maxWidth: 400,
  },
  errorText: {
    fontSize: 14,
    color: '#fca5a5',
    marginLeft: 8,
    flex: 1,
  },
  continueButton: {
    backgroundColor: '#22c55e',
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 48,
    width: '100%',
    maxWidth: 400,
    alignItems: 'center',
    marginBottom: 24,
  },
  continueButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  continueButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000',
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
    paddingHorizontal: 20,
  },
  infoText: {
    fontSize: 14,
    color: '#6b7280',
    marginLeft: 8,
    textAlign: 'center',
  },
  linksContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  linkText: {
    fontSize: 14,
    color: '#22c55e',
    textDecorationLine: 'underline',
  },
  linkSeparator: {
    fontSize: 14,
    color: '#6b7280',
    marginHorizontal: 12,
  },
});
