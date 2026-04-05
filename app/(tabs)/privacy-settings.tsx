/**
 * Privacy Settings Screen
 * 
 * GDPR compliance features:
 * - Data export
 * - Account deletion
 * - Consent management
 * - Privacy policy
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../services/logger';
import { captureException } from '../../services/sentry.service';
import { router } from 'expo-router';

interface ConsentState {
  analytics: boolean;
  pushNotifications: boolean;
  emailCommunications: boolean;
  dataSharing: boolean;
}

export default function PrivacySettingsScreen() {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState<ConsentState>({
    analytics: true,
    pushNotifications: true,
    emailCommunications: true,
    dataSharing: false,
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<any>(null);

  useEffect(() => {
    loadConsentSettings();
    checkDeletionStatus();
  }, []);

  const loadConsentSettings = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/gdpr/consent`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok) {
        setConsent(data.consent);
      }
    } catch (error: any) {
      logger.error('[PrivacySettings] Load consent error:', error);
      captureException(error, { tags: { screen: 'PrivacySettings' } });
    } finally {
      setLoading(false);
    }
  };

  const checkDeletionStatus = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/gdpr/deletion-status`, {
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      });

      const data = await response.json();

      if (response.ok && data.hasDeletionRequest) {
        setDeletionStatus(data.deletionRequest);
      }
    } catch (error: any) {
      logger.error('[PrivacySettings] Check deletion status error:', error);
    }
  };

  const handleConsentChange = async (type: keyof ConsentState, value: boolean) => {
    try {
      // Optimistic update
      setConsent(prev => ({ ...prev, [type]: value }));

      const token = await getToken();
      if (!token) throw new Error('Authentication token not found');

      const consentTypeMap: Record<keyof ConsentState, string> = {
        analytics: 'ANALYTICS',
        pushNotifications: 'PUSH_NOTIFICATIONS',
        emailCommunications: 'EMAIL_COMMUNICATIONS',
        dataSharing: 'DATA_SHARING',
      };

      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/gdpr/consent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          consentType: consentTypeMap[type],
          granted: value,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to update consent');
      }

      logger.info(`[PrivacySettings] Consent updated: ${type} = ${value}`);

    } catch (error: any) {
      // Revert on error
      setConsent(prev => ({ ...prev, [type]: !value }));
      
      logger.error('[PrivacySettings] Update consent error:', error);
      captureException(error, { tags: { screen: 'PrivacySettings' } });
      
      Alert.alert(
        t.common.error,
        t.privacySettings.consentUpdateError || 'Failed to update consent'
      );
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      t.privacySettings.exportDataTitle || 'Export Your Data',
      t.privacySettings.exportDataMessage || 'We will prepare a file with all your data and send you a download link via email. This may take 5-10 minutes.',
      [
        {
          text: t.common.cancel,
          style: 'cancel',
        },
        {
          text: t.privacySettings.exportConfirm || 'Export',
          onPress: async () => {
            try {
              setExportLoading(true);
              const token = await getToken();
              
              if (!token) throw new Error('Authentication token not found');

              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/gdpr/export-data`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || 'Failed to request data export');
              }

              logger.info('[PrivacySettings] Data export requested');

              Alert.alert(
                t.common.success,
                t.privacySettings.exportSuccess || 'Data export requested. You will receive an email when ready.'
              );

            } catch (error: any) {
              logger.error('[PrivacySettings] Export data error:', error);
              captureException(error, { tags: { screen: 'PrivacySettings' } });
              
              Alert.alert(
                t.common.error,
                error.message || t.privacySettings.exportError || 'Failed to export data'
              );
            } finally {
              setExportLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    router.push('/delete-account');
  };

  const handleCancelDeletion = async () => {
    Alert.alert(
      t.privacySettings.cancelDeletionTitle || 'Cancel Account Deletion',
      t.privacySettings.cancelDeletionMessage || 'Are you sure you want to cancel the account deletion?',
      [
        {
          text: t.common.cancel,
          style: 'cancel',
        },
        {
          text: t.privacySettings.cancelDeletionConfirm || 'Yes, Cancel Deletion',
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error('Authentication token not found');

              const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/gdpr/cancel-deletion`, {
                method: 'POST',
                headers: {
                  'Authorization': `Bearer ${token}`,
                },
              });

              if (!response.ok) {
                throw new Error('Failed to cancel deletion');
              }

              logger.info('[PrivacySettings] Account deletion cancelled');

              Alert.alert(
                t.common.success,
                t.privacySettings.deletionCancelled || 'Account deletion cancelled successfully'
              );

              setDeletionStatus(null);

            } catch (error: any) {
              logger.error('[PrivacySettings] Cancel deletion error:', error);
              captureException(error, { tags: { screen: 'PrivacySettings' } });
              
              Alert.alert(
                t.common.error,
                t.privacySettings.cancelDeletionError || 'Failed to cancel deletion'
              );
            }
          },
        },
      ]
    );
  };

  const openPrivacyPolicy = () => {
    Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/privacy-policy.html`);
  };

  const openTerms = () => {
    Linking.openURL(`${process.env.EXPO_PUBLIC_API_URL}/terms-of-service.html`);
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#22c55e" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Ionicons name="shield-checkmark" size={48} color="#22c55e" />
          <Text style={styles.title}>
            {t.privacySettings.title}
          </Text>
          <Text style={styles.subtitle}>
            {t.privacySettings.subtitle}
          </Text>
        </View>

        {/* Deletion Warning */}
        {deletionStatus && deletionStatus.status === 'SCHEDULED' && (
          <View style={styles.warningBox}>
            <Ionicons name="warning" size={24} color="#f59e0b" />
            <View style={styles.warningContent}>
              <Text style={styles.warningTitle}>
                {t.privacySettings.deletionScheduled}
              </Text>
              <Text style={styles.warningText}>
                {t.privacySettings.deletionDate}{' '}
                {new Date(deletionStatus.scheduledAt).toLocaleDateString()}
              </Text>
              <TouchableOpacity
                style={styles.cancelDeletionButton}
                onPress={handleCancelDeletion}
              >
                <Text style={styles.cancelDeletionButtonText}>
                  {t.privacySettings.cancelDeletion}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Consent Management */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t.privacySettings.consentTitle}
          </Text>
          <Text style={styles.sectionDescription}>
            {t.privacySettings.consentDescription}
          </Text>

          <View style={styles.consentItem}>
            <View style={styles.consentInfo}>
              <Ionicons name="analytics" size={24} color="#3b82f6" />
              <View style={styles.consentText}>
                <Text style={styles.consentLabel}>
                  {t.privacySettings.analyticsLabel}
                </Text>
                <Text style={styles.consentDescription}>
                  {t.privacySettings.analyticsDescription}
                </Text>
              </View>
            </View>
            <Switch
              value={consent.analytics}
              onValueChange={(value) => handleConsentChange('analytics', value)}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.consentItem}>
            <View style={styles.consentInfo}>
              <Ionicons name="notifications" size={24} color="#3b82f6" />
              <View style={styles.consentText}>
                <Text style={styles.consentLabel}>
                  {t.privacySettings.pushLabel}
                </Text>
                <Text style={styles.consentDescription}>
                  {t.privacySettings.pushDescription}
                </Text>
              </View>
            </View>
            <Switch
              value={consent.pushNotifications}
              onValueChange={(value) => handleConsentChange('pushNotifications', value)}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.consentItem}>
            <View style={styles.consentInfo}>
              <Ionicons name="mail" size={24} color="#3b82f6" />
              <View style={styles.consentText}>
                <Text style={styles.consentLabel}>
                  {t.privacySettings.emailLabel}
                </Text>
                <Text style={styles.consentDescription}>
                  {t.privacySettings.emailDescription}
                </Text>
              </View>
            </View>
            <Switch
              value={consent.emailCommunications}
              onValueChange={(value) => handleConsentChange('emailCommunications', value)}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.consentItem}>
            <View style={styles.consentInfo}>
              <Ionicons name="share-social" size={24} color="#3b82f6" />
              <View style={styles.consentText}>
                <Text style={styles.consentLabel}>
                  {t.privacySettings.dataSharingLabel}
                </Text>
                <Text style={styles.consentDescription}>
                  {t.privacySettings.dataSharingDescription}
                </Text>
              </View>
            </View>
            <Switch
              value={consent.dataSharing}
              onValueChange={(value) => handleConsentChange('dataSharing', value)}
              trackColor={{ false: '#374151', true: '#22c55e' }}
              thumbColor="#fff"
            />
          </View>
        </View>

        {/* Data Export */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t.privacySettings.dataExportTitle}
          </Text>
          
          <TouchableOpacity
            style={styles.actionButton}
            onPress={handleExportData}
            disabled={exportLoading}
          >
            {exportLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="download" size={24} color="#fff" />
                <Text style={styles.actionButtonText}>
                  {t.privacySettings.exportData}
                </Text>
              </>
            )}
          </TouchableOpacity>
          <Text style={styles.actionDescription}>
            {t.privacySettings.exportDataDescription}
          </Text>
        </View>

        {/* Account Deletion */}
        {!deletionStatus && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>
              {t.privacySettings.dangerZone}
            </Text>
            
            <TouchableOpacity
              style={styles.dangerButton}
              onPress={handleDeleteAccount}
            >
              <Ionicons name="trash" size={24} color="#fff" />
              <Text style={styles.dangerButtonText}>
                {t.privacySettings.deleteAccount}
              </Text>
            </TouchableOpacity>
            <Text style={styles.dangerDescription}>
              {t.privacySettings.deleteAccountDescription}
            </Text>
          </View>
        )}

        {/* Legal Links */}
        <View style={styles.section}>
          <TouchableOpacity style={styles.linkButton} onPress={openPrivacyPolicy}>
            <Ionicons name="document-text" size={20} color="#22c55e" />
            <Text style={styles.linkText}>
              {t.privacySettings.privacyPolicy}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.linkButton} onPress={openTerms}>
            <Ionicons name="document-text" size={20} color="#22c55e" />
            <Text style={styles.linkText}>
              {t.privacySettings.terms}
            </Text>
            <Ionicons name="chevron-forward" size={20} color="#6b7280" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollContent: {
    padding: 20,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
  },
  subtitle: {
    fontSize: 14,
    color: '#9ca3af',
    marginTop: 8,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    backgroundColor: '#78350f',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  warningContent: {
    marginLeft: 12,
    flex: 1,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fbbf24',
    marginBottom: 4,
  },
  warningText: {
    fontSize: 14,
    color: '#fcd34d',
    marginBottom: 12,
  },
  cancelDeletionButton: {
    backgroundColor: '#22c55e',
    borderRadius: 8,
    paddingVertical: 8,
    paddingHorizontal: 16,
    alignSelf: 'flex-start',
  },
  cancelDeletionButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#000',
  },
  section: {
    marginBottom: 32,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#9ca3af',
    marginBottom: 16,
  },
  consentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  consentInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  consentText: {
    marginLeft: 12,
    flex: 1,
  },
  consentLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 4,
  },
  consentDescription: {
    fontSize: 12,
    color: '#9ca3af',
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#3b82f6',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 8,
  },
  actionButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  actionDescription: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  dangerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 8,
  },
  dangerButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  dangerDescription: {
    fontSize: 12,
    color: '#9ca3af',
    textAlign: 'center',
  },
  linkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
  },
  linkText: {
    fontSize: 16,
    color: '#fff',
    marginLeft: 12,
    flex: 1,
  },
});
