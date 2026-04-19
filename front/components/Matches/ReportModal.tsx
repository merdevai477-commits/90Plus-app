import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  StyleSheet,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { CheckCircle } from 'lucide-react-native';
import { useHaptics } from '../Home/useHaptics';
// Types
interface ReportModalProps {
  visible: boolean;
  onClose: () => void;
  reelId: string;
  onReport: (reason: string) => void;
}

// Constants
const COLORS = {
  primary: '#FFD700',
  error: '#FF5252',
  success: '#4CAF50',
};

// Enhanced Report Modal Component
export const ReportModal: React.FC<ReportModalProps> = ({ 
  visible, 
  onClose, 
  reelId, 
  onReport 
}) => {
  const [selectedReason, setSelectedReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const haptic = useHaptics();

  const reasons = [
    'محتوى غير لائق',
    'إزعاج أو مضلل',
    'خطاب كراهية',
    'عنف أو إيذاء',
    'انتهاك حقوق الطبع',
    'محتوى للبالغين',
    'معلومات خاطئة',
    'أخرى'
  ];

  useEffect(() => {
    if (!visible) {
      setSelectedReason('');
      setCustomReason('');
      setIsSubmitted(false);
    }
  }, [visible]);

  const handleSubmit = async () => {
    if (!selectedReason || isSubmitting) return;
    
    haptic.hapticFeedback();
    setIsSubmitting(true);

    try {
      const finalReason = selectedReason === 'أخرى' ? customReason : selectedReason;
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      onReport(finalReason);
      setIsSubmitted(true);
      
      setTimeout(() => {
        onClose();
        setIsSubmitting(false);
      }, 2000);
    } catch (error) {
      Alert.alert('خطأ', 'حدث خطأ أثناء إرسال البلاغ');
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <View style={styles.modalOverlay}>
        <TouchableOpacity 
          style={styles.modalBackdrop} 
          activeOpacity={1} 
          onPress={() => !isSubmitting && !isSubmitted && onClose()}
        />
        
        <View style={styles.reportContainer}>
          {isSubmitted ? (
            <View style={styles.reportSuccess}>
              <View style={styles.successIcon}>
                <CheckCircle size={48} color={COLORS.success} />
              </View>
              <Text style={styles.successTitle}>تم إرسال البلاغ</Text>
              <Text style={styles.successMessage}>
                شكراً لمساعدتنا في الحفاظ على مجتمع آمن
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.dragHandle} />
              
              <Text style={styles.reportTitle}>الإبلاغ عن المحتوى</Text>
              <Text style={styles.reportSubtitle}>
                ساعدنا في فهم المشكلة
              </Text>
              
              <ScrollView 
                style={styles.reasonsList}
                showsVerticalScrollIndicator={false}
              >
                {reasons.map((reason) => (
                  <TouchableOpacity
                    key={reason}
                    style={[
                      styles.reasonItem,
                      selectedReason === reason && styles.reasonItemSelected
                    ]}
                    onPress={() => {
                      haptic.hapticFeedback();
                      setSelectedReason(reason);
                    }}
                    disabled={isSubmitting}
                  >
                    <View style={[
                      styles.radio,
                      selectedReason === reason && styles.radioSelected
                    ]}>
                      {selectedReason === reason && (
                        <View style={styles.radioInner} />
                      )}
                    </View>
                    <Text style={[
                      styles.reasonText,
                      selectedReason === reason && styles.reasonTextSelected
                    ]}>
                      {reason}
                    </Text>
                  </TouchableOpacity>
                ))}
                
                {selectedReason === 'أخرى' && (
                  <TextInput
                    style={styles.customReasonInput}
                    placeholder="اكتب السبب..."
                    placeholderTextColor="#999"
                    value={customReason}
                    onChangeText={setCustomReason}
                    multiline
                    maxLength={200}
                  />
                )}
              </ScrollView>
              
              <View style={styles.reportButtons}>
                <TouchableOpacity
                  onPress={onClose}
                  style={[styles.reportButton, styles.cancelButton]}
                  disabled={isSubmitting}
                >
                  <Text style={styles.cancelButtonText}>إلغاء</Text>
                </TouchableOpacity>
                
                <TouchableOpacity
                  onPress={handleSubmit}
                  disabled={!selectedReason || isSubmitting || (selectedReason === 'أخرى' && !customReason)}
                  style={[
                    styles.reportButton, 
                    styles.submitButton,
                    (!selectedReason || isSubmitting) && styles.submitButtonDisabled
                  ]}
                >
                  {isSubmitting ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text style={styles.submitButtonText}>إرسال البلاغ</Text>
                  )}
                </TouchableOpacity>
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'transparent',
  },
  modalBackdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  dragHandle: {
    width: 40,
    height: 4,
    backgroundColor: '#ccc',
    borderRadius: 2,
    alignSelf: 'center',
    marginTop: 8,
    marginBottom: 16,
  },
  reportContainer: {
    backgroundColor: 'white',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 20,
    paddingBottom: 30,
    maxHeight: 600,
  },
  reportTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  reportSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 24,
  },
  reasonsList: {
    maxHeight: 300,
    marginBottom: 24,
  },
  reasonItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    backgroundColor: '#f8f8f8',
    gap: 12,
  },
  reasonItemSelected: {
    backgroundColor: '#ffebeb',
    borderWidth: 1,
    borderColor: COLORS.error,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioSelected: {
    borderColor: COLORS.error,
  },
  radioInner: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: COLORS.error,
  },
  reasonText: {
    fontSize: 15,
    color: '#333',
    flex: 1,
  },
  reasonTextSelected: {
    color: COLORS.error,
    fontWeight: '500',
  },
  customReasonInput: {
    borderWidth: 1,
    borderColor: '#e0e0e0',
    borderRadius: 12,
    padding: 12,
    fontSize: 14,
    color: '#000',
    backgroundColor: 'white',
    marginTop: 12,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  reportButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  reportButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 24,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: '#f0f0f0',
  },
  cancelButtonText: {
    color: '#666',
    fontSize: 15,
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.error,
    shadowColor: COLORS.error,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 5,
  },
  submitButtonDisabled: {
    backgroundColor: '#ccc',
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    color: 'white',
    fontSize: 15,
    fontWeight: '600',
  },
  reportSuccess: {
    alignItems: 'center',
    paddingVertical: 40,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e8f5e9',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  successTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#000',
    marginBottom: 8,
  },
  successMessage: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    paddingHorizontal: 40,
  },
});
