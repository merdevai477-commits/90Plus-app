/**
 * Improved Account Deletion Modal
 * Enhanced version with checkbox confirmation and better UX
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { useTranslation } from '../../src/i18n';

interface ImprovedAccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

const ImprovedAccountDeletionModal: React.FC<ImprovedAccountDeletionModalProps> = ({
  visible,
  onClose,
  onConfirm,
  isDeleting = false,
}) => {
  const { t, isRTL } = useTranslation();
  const [isAgreed, setIsAgreed] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConfirm = async () => {
    if (!isAgreed) {
      Alert.alert(
        t.common.warning,
        isRTL ? 'يجب الموافقة على الشروط أولاً' : 'You must agree to the terms first'
      );
      return;
    }

    setIsProcessing(true);
    try {
      await onConfirm();
    } catch (error) {
      console.error('Account deletion error:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleClose = () => {
    if (isProcessing || isDeleting) return;
    setIsAgreed(false);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleClose}
    >
      <BlurView intensity={90} tint="dark" style={styles.overlay}>
        <View style={styles.modalContainer}>
          <LinearGradient
            colors={['#1a1a1a', '#0a0a0a']}
            style={styles.modalContent}
          >
            {/* Header */}
            <View style={styles.header}>
              <View style={styles.warningIconContainer}>
                <Ionicons name="warning" size={32} color="#ef4444" />
              </View>
              <Text style={styles.title}>
                {isRTL ? '⚠️ حذف الحساب نهائياً' : '⚠️ Permanently Delete Account'}
              </Text>
              {!isProcessing && !isDeleting && (
                <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#888" />
                </TouchableOpacity>
              )}
            </View>

            {/* Warning Content */}
            <View style={styles.content}>
              <View style={styles.warningBox}>
                <Text style={styles.warningTitle}>
                  {isRTL ? '🚨 تحذير مهم' : '🚨 Important Warning'}
                </Text>
                <Text style={styles.warningText}>
                  {isRTL 
                    ? 'حذف الحساب عملية نهائية ولا يمكن التراجع عنها. سيتم حذف جميع بياناتك بما في ذلك:'
                    : 'Account deletion is permanent and cannot be undone. All your data will be deleted including:'
                  }
                </Text>
              </View>

              <View style={styles.deletionList}>
                <View style={styles.deletionItem}>
                  <Ionicons name="person-outline" size={20} color="#ef4444" />
                  <Text style={styles.deletionItemText}>
                    {isRTL ? 'الملف الشخصي والإعدادات' : 'Profile and settings'}
                  </Text>
                </View>
                <View style={styles.deletionItem}>
                  <Ionicons name="videocam-outline" size={20} color="#ef4444" />
                  <Text style={styles.deletionItemText}>
                    {isRTL ? 'جميع الفيديوهات والمحتوى' : 'All videos and content'}
                  </Text>
                </View>
                <View style={styles.deletionItem}>
                  <Ionicons name="trophy-outline" size={20} color="#ef4444" />
                  <Text style={styles.deletionItemText}>
                    {isRTL ? 'التوقعات والنقاط والإنجازات' : 'Predictions, points, and achievements'}
                  </Text>
                </View>
                <View style={styles.deletionItem}>
                  <Ionicons name="people-outline" size={20} color="#ef4444" />
                  <Text style={styles.deletionItemText}>
                    {isRTL ? 'المتابعون والمتابَعون' : 'Followers and following'}
                  </Text>
                </View>
                <View style={styles.deletionItem}>
                  <Ionicons name="chatbubble-outline" size={20} color="#ef4444" />
                  <Text style={styles.deletionItemText}>
                    {isRTL ? 'التعليقات والتفاعلات' : 'Comments and interactions'}
                  </Text>
                </View>
              </View>

              {/* Confirmation Checkbox */}
              <TouchableOpacity
                style={styles.checkboxContainer}
                onPress={() => setIsAgreed(!isAgreed)}
                disabled={isProcessing || isDeleting}
              >
                <View style={[styles.checkbox, isAgreed && styles.checkboxChecked]}>
                  {isAgreed && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
                <Text style={styles.checkboxText}>
                  {isRTL 
                    ? 'أوافق على حذف حسابي نهائياً وأدرك أنه لا يمكنني استرداد بياناتي'
                    : 'I agree to permanently delete my account and understand that I cannot recover my data'
                  }
                </Text>
              </TouchableOpacity>
            </View>

            {/* Actions */}
            <View style={styles.actions}>
              <TouchableOpacity
                style={[styles.cancelButton, (isProcessing || isDeleting) && styles.buttonDisabled]}
                onPress={handleClose}
                disabled={isProcessing || isDeleting}
              >
                <Text style={styles.cancelButtonText}>
                  {t.common.cancel}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.deleteButton,
                  (!isAgreed || isProcessing || isDeleting) && styles.buttonDisabled
                ]}
                onPress={handleConfirm}
                disabled={!isAgreed || isProcessing || isDeleting}
              >
                <LinearGradient
                  colors={(!isAgreed || isProcessing || isDeleting) ? ['#666', '#444'] : ['#ef4444', '#dc2626']}
                  style={styles.deleteButtonGradient}
                >
                  {(isProcessing || isDeleting) ? (
                    <View style={styles.loadingContainer}>
                      <ActivityIndicator size="small" color="#fff" />
                      <Text style={styles.deleteButtonText}>
                        {isRTL ? 'جاري الحذف...' : 'Deleting...'}
                      </Text>
                    </View>
                  ) : (
                    <Text style={styles.deleteButtonText}>
                      {isRTL ? '🗑️ حذف الحساب نهائياً' : '🗑️ Delete Account Permanently'}
                    </Text>
                  )}
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </LinearGradient>
        </View>
      </BlurView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContainer: {
    width: '100%',
    maxWidth: 400,
    borderRadius: 20,
    overflow: 'hidden',
  },
  modalContent: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#ef444440',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  warningIconContainer: {
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  content: {
    padding: 20,
  },
  warningBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 20,
  },
  warningTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#ef4444',
    marginBottom: 8,
  },
  warningText: {
    fontSize: 14,
    color: '#ccc',
    lineHeight: 20,
  },
  deletionList: {
    marginBottom: 24,
  },
  deletionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    gap: 12,
  },
  deletionItemText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#333',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#666',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxChecked: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  checkboxText: {
    flex: 1,
    fontSize: 13,
    color: '#ccc',
    lineHeight: 18,
  },
  actions: {
    flexDirection: 'row',
    padding: 20,
    gap: 12,
    borderTopWidth: 1,
    borderTopColor: '#333',
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 12,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  cancelButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  deleteButton: {
    flex: 2,
    borderRadius: 12,
    overflow: 'hidden',
  },
  deleteButtonGradient: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
});

export default ImprovedAccountDeletionModal;