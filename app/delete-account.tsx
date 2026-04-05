/**
 * Delete Account Screen
 * 
 * Account deletion with:
 * - Warning messages
 * - Reason selection
 * - Confirmation
 * - 30-day grace period
 * 
 * @author Kiro AI Assistant
 * @date 2026-03-30
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { useLanguageStore } from '../src/i18n';
import { logger } from '../services/logger';
import { getApiEndpoint } from '../config/api.config';
import { captureException } from '../services/sentry.service';

const DELETION_REASONS = [
  { id: 'privacy', label: 'Privacy concerns' },
  { id: 'not_useful', label: 'App not useful' },
  { id: 'too_many_notifications', label: 'Too many notifications' },
  { id: 'found_alternative', label: 'Found alternative' },
  { id: 'temporary_break', label: 'Taking a break' },
  { id: 'other', label: 'Other' },
];

export default function DeleteAccountScreen() {
  const { getToken, signOut } = useAuth();
  const { t } = useLanguageStore();
  
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleDeleteAccount = async () => {
    if (!agreed) {
      Alert.alert(
        t('common.warning') || 'Warning',
        t('deleteAccount.mustAgree') || 'You must agree to the terms before deleting your account'
      );
      return;
    }

    if (!selectedReason) {
      Alert.alert(
        t('common.warning') || 'Warning',
        t('deleteAccount.selectReason') || 'Please select a reason for deletion'
      );
      return;
    }

    Alert.alert(
      t('deleteAccount.finalConfirmTitle') || 'Final Confirmation',
      t('deleteAccount.finalConfirmMessage') || 'Are you absolutely sure? This action cannot be undone after 30 days.',
      [
        {
          text: t('common.cancel') || 'Cancel',
          style: 'cancel',
        },
        {
          text: t('deleteAccount.confirmDelete') || 'Yes, Delete My Account',
          style: 'destructive',
          onPress: async () => {
            try {
              setLoading(true);
              const token = await getToken();
              
              if (!token) throw new Error('Authentication token not found');

              const reason = selectedReason === 'other' ? otherReason : selectedReason;

              const response = await fetch(getApiEndpoint('gdpr/delete-account'), {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${token}`,
                },
                body: JSON.stringify({ reason }),
              });

              const data = await response.json();

              if (!response.ok) {
                throw new Error(data.message || 'Failed to delete account');
              }

              logger.info('[DeleteAccount] Account deletion requested');

              Alert.alert(
                t('common.success') || 'Success',
                t('deleteAccount.deletionScheduled') || 'Your account will be deleted in 30 days. You can cancel anytime before then.',
                [
                  {
                    text: t('common.done') || 'Done',
                    onPress: () => {
                      signOut();
                      router.replace('/');
                    },
                  },
                ]
              );

            } catch (error: any) {
              logger.error('[DeleteAccount] Deletion error:', error);
              captureException(error, { tags: { screen: 'DeleteAccount' } });
              
              Alert.alert(
                t('common.error') || 'Error',
                error.message || t('deleteAccount.deletionError') || 'Failed to delete account'
              );
            } finally {
              setLoading(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>
            {t('deleteAccount.title') || 'Delete Account'}
          </Text>
        </View>

        {/* Warning */}
        <View style={styles.warningBox}>
          <Ionicons name="warning" size={48} color="#ef4444" />
          <Text style={styles.warningTitle}>
            {t('deleteAccount.warningTitle') || 'Important Warning'}
          </Text>
          <Text style={styles.warningText}>
            {t('deleteAccount.warningMessage') || 'Account deletion is permanent and cannot be undone. All your data will be deleted including:'}
          </Text>
        </View>

        {/* What Will Be Deleted */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('deleteAccount.whatWillBeDeleted') || 'What will be deleted:'}
          </Text>
          
          {[
            { icon: 'person', text: t('deleteAccount.profile') || 'Profile and settings' },
            { icon: 'videocam', text: t('deleteAccount.videos') || 'All videos and content' },
            { icon: 'trophy', text: t('deleteAccount.achievements') || 'Predictions, points, and achievements' },
            { icon: 'people', text: t('deleteAccount.social') || 'Followers and following' },
            { icon: 'chatbubbles', text: t('deleteAccount.interactions') || 'Comments and interactions' },
          ].map((item, index) => (
            <View key={index} style={styles.deleteItem}>
              <Ionicons name={item.icon as any} size={20} color="#ef4444" />
              <Text style={styles.deleteItemText}>{item.text}</Text>
            </View>
          ))}
        </View>

        {/* Grace Period */}
        <View style={styles.infoBox}>
          <Ionicons name="time" size={24} color="#3b82f6" />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>
              {t('deleteAccount.gracePeriodTitle') || '30-Day Grace Period'}
            </Text>
            <Text style={styles.infoText}>
              {t('deleteAccount.gracePeriodMessage') || 'You have 30 days to cancel the deletion. After that, your account will be permanently deleted.'}
            </Text>
          </View>
        </View>

        {/* Reason Selection */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            {t('deleteAccount.reasonTitle') || 'Why are you leaving? (Optional)'}
          </Text>
          
          {DELETION_REASONS.map((reason) => (
            <TouchableOpacity
              key={reason.id}
              style={[
                styles.reasonButton,
                selectedReason === reason.id && styles.reasonButtonSelected,
              ]}
              onPress={() => setSelectedReason(reason.id)}
            >
              <View style={[
                styles.radioButton,
                selectedReason === reason.id && styles.radioButtonSelected,
              ]}>
                {selectedReason === reason.id && (
                  <View style={styles.radioButtonInner} />
                )}
              </View>
              <Text style={styles.reasonText}>{reason.label}</Text>
            </TouchableOpacity>
          ))}

          {selectedReason === 'other' && (
            <TextInput
              style={styles.otherReasonInput}
              placeholder={t('deleteAccount.otherReasonPlaceholder') || 'Please tell us more...'}
              placeholderTextColor="#6b7280"
              value={otherReason}
              onChangeText={setOtherReason}
              multiline
              numberOfLines={3}
            />
          )}
        </View>

        {/* Agreement */}
        <TouchableOpacity
          style={styles.agreementContainer}
          onPress={() => setAgreed(!agreed)}
        >
          <View style={[
            styles.checkbox,
            agreed && styles.checkboxChecked,
          ]}>
            {agreed && (
              <Ionicons name="checkmark" size={16} color="#000" />
            )}
          </View>
          <Text style={styles.agreementText}>
            {t('deleteAccount.agreement') || 'I understand that this action is permanent and I cannot recover my data after 30 days'}
          </Text>
        </TouchableOpacity>

        {/* Delete Button */}
        <TouchableOpacity
          style={[
            styles.deleteButton,
            (!agreed || loading) && styles.deleteButtonDisabled,
          ]}
          onPress={handleDeleteAccount}
          disabled={!agreed || loading}
        >
          {loading ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Ionicons name="trash" size={24} color="#fff" />
              <Text style={styles.deleteButtonText}>
                {t('deleteAccount.deleteButton') || 'Delete My Account'}
              </Text>
            </>
          )}
        </TouchableOpacity>

        {/* Cancel Button */}
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => router.back()}
        >
          <Text style={styles.cancelButtonText}>
            {t('common.cancel') || 'Cancel'}
          </Text>
        </TouchableOpacity>
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
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
  },
  backButton: {
    marginRight: 16,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
  },
  warningBox: {
    backgroundColor: '#7f1d1d',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fca5a5',
    marginTop: 12,
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#fca5a5',
    textAlign: 'center',
    lineHeight: 20,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 12,
  },
  deleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  deleteItemText: {
    fontSize: 14,
    color: '#d1d5db',
    marginLeft: 12,
  },
  infoBox: {
    flexDirection: 'row',
    backgroundColor: '#1e3a8a',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  infoContent: {
    marginLeft: 12,
    flex: 1,
  },
  infoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#93c5fd',
    marginBottom: 4,
  },
  infoText: {
    fontSize: 14,
    color: '#93c5fd',
    lineHeight: 20,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    marginBottom: 8,
  },
  reasonButtonSelected: {
    backgroundColor: '#374151',
    borderWidth: 2,
    borderColor: '#22c55e',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  radioButtonSelected: {
    borderColor: '#22c55e',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#22c55e',
  },
  reasonText: {
    fontSize: 14,
    color: '#d1d5db',
  },
  otherReasonInput: {
    backgroundColor: '#1f2937',
    borderRadius: 8,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginTop: 8,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 24,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#6b7280',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  agreementText: {
    fontSize: 14,
    color: '#d1d5db',
    flex: 1,
    lineHeight: 20,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#ef4444',
    borderRadius: 12,
    paddingVertical: 16,
    marginBottom: 12,
  },
  deleteButtonDisabled: {
    backgroundColor: '#374151',
    opacity: 0.5,
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginLeft: 8,
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  cancelButtonText: {
    fontSize: 16,
    color: '#9ca3af',
  },
});
