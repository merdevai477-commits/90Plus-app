/**
 * Professional Report System
 * Unified reporting for Reels, Comments, and Users
 * 
 * Features:
 * - Multi-language support (AR/EN)
 * - Haptic feedback
 * - Loading states
 * - Error handling
 * - Success animations
 * - Rate limiting protection
 * - Duplicate detection
 */

import React, { useState, useEffect } from 'react';
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
  Animated,
  Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { useLanguage } from '../../contexts/LanguageContext';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';

// Types
export interface ReportSystemProps {
  visible: boolean;
  onClose: () => void;
  contentType: 'reel' | 'comment' | 'user';
  contentId: string;
  getToken: () => Promise<string | null>;
  onSuccess?: () => void;
}

interface ReportReason {
  id: string;
  labelAr: string;
  labelEn: string;
  icon: keyof typeof Ionicons.glyphMap;
  description?: string;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  error: '#FF3B30',
  success: '#34C759',
  background: '#000000',
  backgroundCard: '#1C1C1E',
  textPrimary: '#FFFFFF',
  textSecondary: '#8E8E93',
  glassBorder: 'rgba(255, 255, 255, 0.1)',
  white: '#FFFFFF',
  darkGray: '#48484A',
};

const REPORT_REASONS: ReportReason[] = [
  {
    id: 'spam',
    labelAr: 'سبام أو محتوى متكرر',
    labelEn: 'Spam or Repetitive Content',
    icon: 'mail-outline',
  },
  {
    id: 'harassment',
    labelAr: 'تحرش أو تنمر',
    labelEn: 'Harassment or Bullying',
    icon: 'warning-outline',
  },
  {
    id: 'inappropriate',
    labelAr: 'محتوى غير لائق',
    labelEn: 'Inappropriate Content',
    icon: 'eye-off-outline',
  },
  {
    id: 'violence',
    labelAr: 'عنف أو تهديدات',
    labelEn: 'Violence or Threats',
    icon: 'skull-outline',
  },
  {
    id: 'hate',
    labelAr: 'خطاب كراهية',
    labelEn: 'Hate Speech',
    icon: 'alert-circle-outline',
  },
  {
    id: 'copyright',
    labelAr: 'انتهاك حقوق النشر',
    labelEn: 'Copyright Violation',
    icon: 'shield-outline',
  },
  {
    id: 'misinformation',
    labelAr: 'معلومات مضللة',
    labelEn: 'False Information',
    icon: 'information-circle-outline',
  },
  {
    id: 'other',
    labelAr: 'أسباب أخرى',
    labelEn: 'Other Reasons',
    icon: 'ellipsis-horizontal-outline',
  },
];

export const ReportSystem: React.FC<ReportSystemProps> = ({
  visible,
  onClose,
  contentType,
  contentId,
  getToken,
  onSuccess,
}) => {
  const { language, t } = useLanguage();
  const isRTL = language === 'ar';

  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [additionalInfo, setAdditionalInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Animation values
  const fadeAnim = useState(new Animated.Value(0))[0];
  const scaleAnim = useState(new Animated.Value(0.9))[0];
  const successAnim = useState(new Animated.Value(0))[0];

  useEffect(() => {
    if (visible) {
      // Reset state
      setSelectedReason(null);
      setAdditionalInfo('');
      setSubmitted(false);
      setError(null);

      // Animate in
      Animated.parallel([
        Animated.timing(fadeAnim, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }),
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      fadeAnim.setValue(0);
      scaleAnim.setValue(0.9);
      successAnim.setValue(0);
    }
  }, [visible]);

  const handleReasonSelect = (reasonId: string) => {
    if (loading) return;
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSelectedReason(reasonId);
    setError(null);
  };

  const handleSubmit = async () => {
    if (!selectedReason || loading) return;

    // Validate additional info for "other" reason
    if (selectedReason === 'other' && !additionalInfo.trim()) {
      setError(isRTL ? 'يرجى كتابة السبب' : 'Please provide a reason');
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      const token = await getToken();
      if (!token) {
        throw new Error(isRTL ? 'يجب تسجيل الدخول أولاً' : 'Authentication required');
      }

      const endpoint = `${getApiUrl()}/reports/${contentType}/${contentId}`;
      
      logger.info('Submitting report:', {
        contentType,
        contentId,
        reason: selectedReason,
      });

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          reason: selectedReason,
          additionalInfo: additionalInfo.trim() || undefined,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        // Handle specific error cases
        if (response.status === 429) {
          throw new Error(
            isRTL
              ? 'لقد وصلت للحد الأقصى من البلاغات اليومية'
              : 'You have reached the daily report limit'
          );
        }
        if (response.status === 409) {
          throw new Error(
            isRTL
              ? 'لقد أبلغت عن هذا المحتوى مسبقاً'
              : 'You have already reported this content'
          );
        }
        throw new Error(data.message || (isRTL ? 'فشل إرسال البلاغ' : 'Failed to submit report'));
      }

      // Success!
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSubmitted(true);

      // Animate success
      Animated.spring(successAnim, {
        toValue: 1,
        friction: 8,
        tension: 40,
        useNativeDriver: true,
      }).start();

      // Auto close after 2 seconds
      setTimeout(() => {
        handleClose();
        onSuccess?.();
      }, 2000);

      logger.info('Report submitted successfully');
    } catch (error: any) {
      logger.error('Error submitting report:', error);
      setError(error.message || (isRTL ? 'حدث خطأ' : 'An error occurred'));
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(scaleAnim, {
        toValue: 0.9,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onClose();
    });
  };

  const getContentTypeLabel = () => {
    const labels = {
      reel: { ar: 'الفيديو', en: 'Reel' },
      comment: { ar: 'التعليق', en: 'Comment' },
      user: { ar: 'المستخدم', en: 'User' },
    };
    return isRTL ? labels[contentType].ar : labels[contentType].en;
  };

  const renderSuccessView = () => (
    <Animated.View
      style={[
        styles.successContainer,
        {
          opacity: successAnim,
          transform: [
            {
              scale: successAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.8, 1],
              }),
            },
          ],
        },
      ]}
    >
      <View style={styles.successIconContainer}>
        <Ionicons name="checkmark-circle" size={80} color={COLORS.success} />
      </View>
      <Text style={styles.successTitle}>
        {isRTL ? 'تم إرسال البلاغ' : 'Report Submitted'}
      </Text>
      <Text style={styles.successMessage}>
        {isRTL
          ? 'شكراً لمساعدتنا في الحفاظ على مجتمع آمن. سنراجع البلاغ قريباً.'
          : 'Thank you for helping keep our community safe. We will review this report shortly.'}
      </Text>
    </Animated.View>
  );

  const renderReportForm = () => (
    <>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <Ionicons name="flag-outline" size={24} color={COLORS.error} />
          <Text style={styles.title}>
            {isRTL ? `الإبلاغ عن ${getContentTypeLabel()}` : `Report ${getContentTypeLabel()}`}
          </Text>
        </View>
        <TouchableOpacity onPress={handleClose} style={styles.closeButton} disabled={loading}>
          <Ionicons name="close" size={24} color={COLORS.textPrimary} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.subtitle}>
          {isRTL ? 'لماذا تريد الإبلاغ عن هذا المحتوى؟' : 'Why are you reporting this content?'}
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
              activeOpacity={0.7}
            >
              <Ionicons
                name={reason.icon}
                size={22}
                color={selectedReason === reason.id ? COLORS.error : COLORS.textSecondary}
              />
              <Text
                style={[
                  styles.reasonText,
                  selectedReason === reason.id && styles.reasonTextSelected,
                ]}
              >
                {isRTL ? reason.labelAr : reason.labelEn}
              </Text>
              {selectedReason === reason.id && (
                <Ionicons name="checkmark-circle" size={22} color={COLORS.error} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        {/* Additional Details */}
        <Text style={styles.detailsLabel}>
          {isRTL ? 'تفاصيل إضافية (اختياري)' : 'Additional details (optional)'}
          {selectedReason === 'other' && (
            <Text style={styles.requiredMark}> *</Text>
          )}
        </Text>
        <TextInput
          style={[
            styles.detailsInput,
            error && styles.detailsInputError,
          ]}
          placeholder={
            isRTL
              ? 'اكتب المزيد من التفاصيل...'
              : 'Provide more information...'
          }
          placeholderTextColor={COLORS.textSecondary}
          value={additionalInfo}
          onChangeText={(text) => {
            setAdditionalInfo(text);
            setError(null);
          }}
          multiline
          numberOfLines={4}
          maxLength={500}
          editable={!loading}
          textAlign="left"
        />
        <View style={styles.characterCountRow}>
          {error && <Text style={styles.errorText}>{error}</Text>}
          <Text style={styles.characterCount}>{additionalInfo.length}/500</Text>
        </View>

        {/* Info */}
        <View style={styles.infoContainer}>
          <Ionicons name="information-circle-outline" size={20} color={COLORS.primary} />
          <Text style={styles.infoText}>
            {isRTL
              ? 'بلاغك سري تماماً. سنراجعه ونتخذ الإجراء المناسب.'
              : 'Your report is completely anonymous. We will review it and take appropriate action.'}
          </Text>
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={handleClose}
          disabled={loading}
          activeOpacity={0.7}
        >
          <Text style={styles.cancelButtonText}>
            {isRTL ? 'إلغاء' : 'Cancel'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.submitButton,
            (!selectedReason || loading) && styles.submitButtonDisabled,
          ]}
          onPress={handleSubmit}
          disabled={!selectedReason || loading}
          activeOpacity={0.7}
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
              <ActivityIndicator color={COLORS.white} size="small" />
            ) : (
              <Text style={styles.submitButtonText}>
                {isRTL ? 'إرسال البلاغ' : 'Submit Report'}
              </Text>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </>
  );

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent={true}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.backdrop}
          activeOpacity={1}
          onPress={() => !loading && !submitted && handleClose()}
        />
        <Animated.View
          style={[
            styles.container,
            {
              transform: [{ scale: scaleAnim }],
            },
          ]}
        >
          {/* Drag Handle */}
          <View style={styles.dragHandle} />

          {submitted ? renderSuccessView() : renderReportForm()}
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    justifyContent: 'flex-end',
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
  },
  container: {
    backgroundColor: COLORS.backgroundCard,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
      },
      android: {
        elevation: 8,
      },
    }),
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: COLORS.textSecondary,
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 12,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.glassBorder,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.white,
    flex: 1,
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
    gap: 10,
    marginBottom: 24,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
    gap: 12,
  },
  reasonButtonSelected: {
    backgroundColor: `${COLORS.error}15`,
    borderColor: COLORS.error,
  },
  reasonText: {
    flex: 1,
    fontSize: 15,
    color: COLORS.textPrimary,
  },
  reasonTextSelected: {
    color: COLORS.error,
    fontWeight: '600',
  },
  detailsLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.textPrimary,
    marginBottom: 8,
  },
  requiredMark: {
    color: COLORS.error,
  },
  detailsInput: {
    backgroundColor: COLORS.background,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
    padding: 12,
    fontSize: 14,
    color: COLORS.textPrimary,
    minHeight: 100,
    textAlignVertical: 'top',
  },
  detailsInputError: {
    borderColor: COLORS.error,
  },
  characterCountRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 16,
  },
  characterCount: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  errorText: {
    fontSize: 12,
    color: COLORS.error,
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
    paddingBottom: Platform.OS === 'ios' ? 34 : 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: COLORS.glassBorder,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: COLORS.glassBorder,
    alignItems: 'center',
    justifyContent: 'center',
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
    justifyContent: 'center',
  },
  submitButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.white,
  },
  successContainer: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 20,
  },
  successIconContainer: {
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: COLORS.white,
    marginBottom: 12,
    textAlign: 'center',
  },
  successMessage: {
    fontSize: 15,
    color: COLORS.textSecondary,
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: 20,
  },
});
