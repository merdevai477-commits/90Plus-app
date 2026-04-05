/**
 * Report Content Modal
 * Apple Compliance - Guideline 1.2
 * 
 * Allows users to report inappropriate content (reels, comments, users)
 */

import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../reels/constants';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';

interface ReportContentModalProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'reel' | 'comment' | 'user';
  contentId: string;
  getToken: () => Promise<string | null>;
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam', icon: 'mail-outline' },
  { id: 'harassment', label: 'Harassment or Bullying', icon: 'warning-outline' },
  { id: 'hate_speech', label: 'Hate Speech', icon: 'alert-circle-outline' },
  { id: 'violence', label: 'Violence or Threats', icon: 'skull-outline' },
  { id: 'nudity', label: 'Nudity or Sexual Content', icon: 'eye-off-outline' },
  { id: 'misinformation', label: 'False Information', icon: 'information-circle-outline' },
  { id: 'copyright', label: 'Copyright Violation', icon: 'shield-outline' },
  { id: 'other', label: 'Other', icon: 'ellipsis-horizontal-outline' },
];

export const ReportContentModal: React.FC<ReportContentModalProps> = ({
  visible,
  onClose,
  contentType,
  contentId,
  getToken,
}) => {
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [details, setDetails] = useState('');
  const [loading, setLoading] = useState(false);

  const handleReasonSelect = (reasonId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(reasonId);
  };

  const handleSubmit = async () => {
    if (!selectedReason) {
      Alert.alert('Error', 'Please select a reason for reporting');
      return;
    }

    try {
      setLoading(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const token = await getToken();
      if (!token) {
        throw new Error('Not authenticated');
      }

      const endpoint = `${getApiUrl()}/reports/${contentType}/${contentId}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (response.ok && (data.status === 'SUCCESS' || response.status === 200)) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        Alert.alert(
          'Report Submitted',
          'Thank you for helping keep our community safe. We will review this report shortly.',
          [{ text: 'OK', onPress: handleClose }]
        );
      } else {
        if (response.status === 409) {
          throw new Error('You have already reported this content');
        }
        if (response.status === 429) {
          throw new Error('You have reached the daily report limit');
        }
        throw new Error(data.message || 'Failed to submit report');
      }
    } catch (error: any) {
      logger.error('Error submitting report:', error);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      Alert.alert('Error', error.message || 'Failed to submit report. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setSelectedReason(null);
    setDetails('');
    onClose();
  };

  const getContentTypeLabel = () => {
    switch (contentType) {
      case 'reel':
        return 'Reel';
      case 'comment':
        return 'Comment';
      case 'user':
        return 'User';
      default:
        return 'Content';
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={handleClose}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <Ionicons name="flag-outline" size={24} color={COLORS.error} />
              <Text style={styles.title}>Report {getContentTypeLabel()}</Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color={COLORS.textPrimary} />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <Text style={styles.subtitle}>
              Why are you reporting this {contentType}?
            </Text>

            {/* Reasons */}
            <View style={styles.reasonsContainer}>
              {REPORT_REASONS.map((reason) => (
                <TouchableOpacity
                  key={reason.id}
                  style={[
                    styles.reasonButton,
                    selectedReason === reason.id && styles.reasonButtonSelected,
                  ]}
                  onPress={() => handleReasonSelect(reason.id)}
                  disabled={loading}
                >
                  <Ionicons
                    name={reason.icon as any}
                    size={20}
                    color={
                      selectedReason === reason.id ? COLORS.primary : COLORS.textSecondary
                    }
                  />
                  <Text
                    style={[
                      styles.reasonText,
                      selectedReason === reason.id && styles.reasonTextSelected,
                    ]}
                  >
                    {reason.label}
                  </Text>
                  {selectedReason === reason.id && (
                    <Ionicons name="checkmark-circle" size={20} color={COLORS.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* Additional Details */}
            <Text style={styles.detailsLabel}>
              Additional details (optional)
            </Text>
            <TextInput
              style={styles.detailsInput}
              placeholder="Provide more information..."
              placeholderTextColor={COLORS.textSecondary}
              value={details}
              onChangeText={setDetails}
              multiline
              numberOfLines={4}
              maxLength={500}
              editable={!loading}
            />
            <Text style={styles.characterCount}>{details.length}/500</Text>

            {/* Info */}
            <View style={styles.infoContainer}>
              <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
              <Text style={styles.infoText}>
                Your report is anonymous. We'll review it and take appropriate action.
              </Text>
            </View>
          </ScrollView>

          {/* Footer */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={handleClose}
              disabled={loading}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.submitButton,
                (!selectedReason || loading) && styles.submitButtonDisabled,
              ]}
              onPress={handleSubmit}
              disabled={!selectedReason || loading}
            >
              <LinearGradient
                colors={
                  selectedReason && !loading
                    ? [COLORS.error, '#c0392b']
                    : [COLORS.darkGray, COLORS.darkGray]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                {loading ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.submitButtonText}>Submit Report</Text>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  container: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  closeButton: {
    padding: 4,
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 16,
  },
  reasonsContainer: {
    gap: 12,
    marginBottom: 24,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    gap: 12,
  },
  reasonButtonSelected: {
    backgroundColor: `${COLORS.primary}15`,
    borderColor: COLORS.primary,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  reasonTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  detailsInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
    textAlign: 'right',
    marginTop: 4,
    marginBottom: 16,
  },
  infoContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    backgroundColor: `${COLORS.primary}10`,
    borderRadius: 12,
    gap: 8,
    marginBottom: 20,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    color: COLORS.textSecondary,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 20,
    paddingBottom: 30,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  submitButton: {
    flex: 1,
    borderRadius: 12,
    overflow: 'hidden',
  },
  submitButtonDisabled: {
    opacity: 0.5,
  },
  submitButtonGradient: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
});
