import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../contexts/LanguageContext';

const { height } = Dimensions.get('window');

interface AccountDeletionModalProps {
  visible: boolean;
  onClose: () => void;
  onConfirm: () => Promise<void>;
}

const AccountDeletionModal: React.FC<AccountDeletionModalProps> = ({
  visible,
  onClose,
  onConfirm,
}) => {
  const { t, isRTL } = useLanguage();
  const [step, setStep] = useState<1 | 2>(1);
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleClose = () => {
    setStep(1);
    setConfirmed(false);
    onClose();
  };

  const handleContinue = () => {
    setStep(2);
  };

  const handleBiometricAuth = async () => {
    // Biometric authentication has been removed for better compatibility
    // Proceed directly without biometric check
    return true;
  };

  const handleDelete = async () => {
    if (!confirmed) return;

    // Request biometric authentication
    const authSuccess = await handleBiometricAuth();
    
    if (!authSuccess) {
      Alert.alert(
        isRTL ? 'فشل التحقق' : 'Authentication Failed',
        isRTL ? 'يجب التحقق من هويتك لحذف الحساب' : 'You must authenticate to delete your account'
      );
      return;
    }

    setLoading(true);
    try {
      await onConfirm();
      handleClose();
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل حذف الحساب. حاول مرة أخرى.' : 'Failed to delete account. Please try again.'
      );
    } finally {
      setLoading(false);
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
        <View style={styles.modalContainer}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerLeft}>
              <View style={[styles.iconContainer, styles.dangerIcon]}>
                <Ionicons name="warning" size={24} color="#ef4444" />
              </View>
              <Text style={styles.headerTitle}>
                {isRTL ? 'حذف الحساب' : 'Delete Account'}
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
              <Ionicons name="close" size={24} color="#888" />
            </TouchableOpacity>
          </View>

          {/* Content */}
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {step === 1 ? (
              // Step 1: Warning and Data List
              <>
                <View style={styles.warningBox}>
                  <Ionicons name="alert-circle" size={48} color="#ef4444" />
                  <Text style={styles.warningTitle}>
                    {isRTL ? 'تحذير: هذا الإجراء لا يمكن التراجع عنه!' : 'Warning: This action cannot be undone!'}
                  </Text>
                  <Text style={styles.warningText}>
                    {isRTL
                      ? 'سيتم حذف جميع بياناتك بشكل دائم خلال 30 يومًا.'
                      : 'All your data will be permanently deleted within 30 days.'}
                  </Text>
                </View>

                <Text style={styles.sectionTitle}>
                  {isRTL ? 'البيانات التي سيتم حذفها:' : 'Data that will be deleted:'}
                </Text>

                <View style={styles.dataList}>
                  <DataItem icon="person" text={isRTL ? 'معلومات الملف الشخصي' : 'Profile information'} />
                  <DataItem icon="videocam" text={isRTL ? 'جميع الفيديوهات (Reels)' : 'All videos (Reels)'} />
                  <DataItem icon="chatbubbles" text={isRTL ? 'جميع التعليقات' : 'All comments'} />
                  <DataItem icon="heart" text={isRTL ? 'جميع الإعجابات' : 'All likes'} />
                  <DataItem icon="trophy" text={isRTL ? 'التوقعات والنقاط' : 'Predictions and points'} />
                  <DataItem icon="school" text={isRTL ? 'تقدم الاختبارات' : 'Quiz progress'} />
                  <DataItem icon="notifications" text={isRTL ? 'الإشعارات' : 'Notifications'} />
                  <DataItem icon="people" text={isRTL ? 'المتابعون والمتابعة' : 'Followers and following'} />
                  <DataItem icon="settings" text={isRTL ? 'الإعدادات والتفضيلات' : 'Settings and preferences'} />
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="information-circle" size={20} color="#22c55e" />
                  <Text style={styles.infoText}>
                    {isRTL
                      ? 'سيتم إرسال بريد إلكتروني للتأكيد بعد الحذف.'
                      : 'A confirmation email will be sent after deletion.'}
                  </Text>
                </View>
              </>
            ) : (
              // Step 2: Final Confirmation
              <>
                <View style={styles.finalWarningBox}>
                  <Ionicons name="skull" size={64} color="#ef4444" />
                  <Text style={styles.finalWarningTitle}>
                    {isRTL ? 'تأكيد نهائي' : 'Final Confirmation'}
                  </Text>
                  <Text style={styles.finalWarningText}>
                    {isRTL
                      ? 'هل أنت متأكد تمامًا من رغبتك في حذف حسابك؟'
                      : 'Are you absolutely sure you want to delete your account?'}
                  </Text>
                </View>

                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setConfirmed(!confirmed)}
                  >
                    <View style={[styles.checkboxBox, confirmed && styles.checkboxBoxChecked]}>
                      {confirmed && <Ionicons name="checkmark" size={18} color="#fff" />}
                    </View>
                    <Text style={styles.checkboxLabel}>
                      {isRTL
                        ? 'نعم، أريد حذف حسابي وجميع بياناتي بشكل دائم'
                        : 'Yes, I want to permanently delete my account and all my data'}
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.infoBox}>
                  <Ionicons name="shield-checkmark" size={20} color="#22c55e" />
                  <Text style={styles.infoText}>
                    {isRTL
                      ? 'سيتم تأكيد العملية بعد الضغط على زر الحذف.'
                      : 'The operation will be confirmed after pressing the delete button.'}
                  </Text>
                </View>
              </>
            )}
          </ScrollView>

          {/* Action Buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={step === 1 ? handleClose : () => setStep(1)}
            >
              <Text style={styles.cancelButtonText}>
                {step === 1 ? (isRTL ? 'إلغاء' : 'Cancel') : (isRTL ? 'رجوع' : 'Back')}
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.deleteButton,
                step === 2 && !confirmed && styles.deleteButtonDisabled,
              ]}
              onPress={step === 1 ? handleContinue : handleDelete}
              disabled={step === 2 && (!confirmed || loading)}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.deleteButtonText}>
                  {step === 1
                    ? (isRTL ? 'متابعة' : 'Continue')
                    : (isRTL ? 'حذف حسابي' : 'Delete My Account')}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const DataItem: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
  <View style={styles.dataItem}>
    <Ionicons name={icon as any} size={20} color="#888" />
    <Text style={styles.dataItemText}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.9)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContainer: {
    width: '90%',
    maxHeight: height * 0.85,
    backgroundColor: '#0a0a0a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#22c55e15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dangerIcon: {
    backgroundColor: '#ef444415',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    padding: 4,
  },
  scrollView: {
    maxHeight: height * 0.5,
  },
  scrollContent: {
    padding: 20,
  },
  warningBox: {
    alignItems: 'center',
    padding: 24,
    backgroundColor: '#ef444410',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ef444430',
    marginBottom: 24,
  },
  warningTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 12,
    marginBottom: 8,
    textAlign: 'center',
  },
  warningText: {
    fontSize: 14,
    color: '#ccc',
    textAlign: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 16,
  },
  dataList: {
    gap: 12,
    marginBottom: 24,
  },
  dataItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 12,
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
  },
  dataItemText: {
    fontSize: 14,
    color: '#ccc',
    flex: 1,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 16,
    backgroundColor: '#22c55e10',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  infoText: {
    fontSize: 13,
    color: '#22c55e',
    flex: 1,
  },
  finalWarningBox: {
    alignItems: 'center',
    padding: 32,
    backgroundColor: '#ef444410',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ef444430',
    marginBottom: 24,
  },
  finalWarningTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#ef4444',
    marginTop: 16,
    marginBottom: 8,
    textAlign: 'center',
  },
  finalWarningText: {
    fontSize: 15,
    color: '#ccc',
    textAlign: 'center',
  },
  checkboxContainer: {
    marginBottom: 24,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  checkboxBox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  checkboxBoxChecked: {
    backgroundColor: '#ef4444',
    borderColor: '#ef4444',
  },
  checkboxLabel: {
    fontSize: 14,
    color: '#fff',
    flex: 1,
    lineHeight: 20,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  cancelButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#888',
  },
  deleteButton: {
    flex: 1,
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#ef4444',
    alignItems: 'center',
  },
  deleteButtonDisabled: {
    backgroundColor: '#333',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});

export default AccountDeletionModal;
