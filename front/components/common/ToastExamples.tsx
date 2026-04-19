import React from 'react';
import { View, TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useToast } from '../../contexts/ToastContext';
import { useTranslation } from '../../src/i18n';

/**
 * مثال على استخدام النظام الجديد للـ Toast
 * يمكن استخدام هذا المكون كمرجع لكيفية استخدام النظام في أي مكان في التطبيق
 */
export const ToastExamples: React.FC = () => {
  const toast = useToast();
  const { t } = useTranslation();

  return (
    <View style={styles.container}>
      <Text style={styles.title}>أمثلة على استخدام Toast الاحترافي</Text>
      
      {/* Success Toast */}
      <TouchableOpacity
        style={[styles.button, styles.successButton]}
        onPress={() => toast.showSuccess(
          t.toast.success.profileUpdated,
          'تم تحديث جميع بياناتك بنجاح وسيتم مزامنتها مع الخادم',
          { duration: 3000, position: 'top' }
        )}
      >
        <Text style={styles.buttonText}>نجاح - تحديث الملف الشخصي</Text>
      </TouchableOpacity>

      {/* Error Toast */}
      <TouchableOpacity
        style={[styles.button, styles.errorButton]}
        onPress={() => toast.showError(
          t.toast.error.networkError,
          'تأكد من اتصالك بالإنترنت وحاول مرة أخرى',
          { duration: 4000, position: 'top' }
        )}
      >
        <Text style={styles.buttonText}>خطأ - مشكلة في الشبكة</Text>
      </TouchableOpacity>

      {/* Warning Toast */}
      <TouchableOpacity
        style={[styles.button, styles.warningButton]}
        onPress={() => toast.showWarning(
          t.toast.warning.unsavedChanges,
          'لديك تغييرات لم يتم حفظها. هل تريد المتابعة؟',
          { duration: 5000, position: 'center' }
        )}
      >
        <Text style={styles.buttonText}>تحذير - تغييرات غير محفوظة</Text>
      </TouchableOpacity>

      {/* Info Toast */}
      <TouchableOpacity
        style={[styles.button, styles.infoButton]}
        onPress={() => toast.showInfo(
          t.toast.info.uploadingInBackground,
          'سيتم إشعارك عند اكتمال العملية',
          { duration: 3000, position: 'bottom' }
        )}
      >
        <Text style={styles.buttonText}>معلومات - رفع في الخلفية</Text>
      </TouchableOpacity>

      {/* Login Success Example */}
      <TouchableOpacity
        style={[styles.button, styles.successButton]}
        onPress={() => toast.showSuccess(
          t.toast.success.loginSuccess,
          'مرحباً بعودتك! تم تحميل بياناتك بنجاح',
          { duration: 2000, position: 'top' }
        )}
      >
        <Text style={styles.buttonText}>مثال - تسجيل دخول ناجح</Text>
      </TouchableOpacity>

      {/* Upload Progress Example */}
      <TouchableOpacity
        style={[styles.button, styles.infoButton]}
        onPress={() => toast.showInfo(
          t.toast.info.processingRequest,
          'جاري معالجة الفيديو... يرجى عدم إغلاق التطبيق',
          { duration: 6000, position: 'center' }
        )}
      >
        <Text style={styles.buttonText}>مثال - معالجة فيديو</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 20,
    backgroundColor: '#000',
  },
  title: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 20,
  },
  button: {
    padding: 15,
    borderRadius: 12,
    marginVertical: 8,
    alignItems: 'center',
  },
  successButton: {
    backgroundColor: 'rgba(34, 197, 94, 0.2)',
    borderWidth: 1,
    borderColor: '#22c55e',
  },
  errorButton: {
    backgroundColor: 'rgba(239, 68, 68, 0.2)',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  warningButton: {
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
    borderWidth: 1,
    borderColor: '#f59e0b',
  },
  infoButton: {
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  buttonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default ToastExamples;