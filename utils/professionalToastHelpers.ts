/**
 * مساعدات للـ Toast الاحترافي
 * تحتوي على دوال مساعدة لاستخدام النظام بسهولة في أي مكان
 */

import { ToastType } from '../components/common/ProfessionalToast';

// نوع الخيارات للـ Toast
export interface ToastOptions {
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
  onPress?: () => void; // للتأكيد أو الإجراءات
}

// دوال مساعدة للاستخدام السريع
export class ToastHelper {
  
  /**
   * عرض toast للعمليات الناجحة
   */
  static success(
    toast: any,
    title: string,
    message: string,
    options?: ToastOptions
  ) {
    toast.showSuccess(title, message, {
      duration: options?.duration || 3000,
      position: options?.position || 'top',
      onPress: options?.onPress,
    });
  }

  /**
   * عرض toast للأخطاء
   */
  static error(
    toast: any,
    title: string,
    message: string,
    options?: ToastOptions
  ) {
    toast.showError(title, message, {
      duration: options?.duration || 4000,
      position: options?.position || 'top',
      onPress: options?.onPress,
    });
  }

  /**
   * عرض toast للتحذيرات
   */
  static warning(
    toast: any,
    title: string,
    message: string,
    options?: ToastOptions
  ) {
    toast.showWarning(title, message, {
      duration: options?.duration || 5000,
      position: options?.position || 'center',
      onPress: options?.onPress,
    });
  }

  /**
   * عرض toast للمعلومات
   */
  static info(
    toast: any,
    title: string,
    message: string,
    options?: ToastOptions
  ) {
    toast.showInfo(title, message, {
      duration: options?.duration || 3000,
      position: options?.position || 'bottom',
      onPress: options?.onPress,
    });
  }

  /**
   * عرض toast للتأكيد مع إجراء
   */
  static confirm(
    toast: any,
    title: string,
    message: string,
    onConfirm: () => void,
    options?: Omit<ToastOptions, 'onPress'>
  ) {
    toast.showWarning(title, `${message}\n\nاضغط للتأكيد`, {
      duration: options?.duration || 8000,
      position: options?.position || 'center',
      onPress: onConfirm,
    });
  }

  /**
   * عرض toast لبداية رفع الملفات
   */
  static uploadStart(toast: any, fileType: 'video' | 'image' | 'file' = 'file') {
    const messages = {
      video: 'جاري رفع الفيديو...',
      image: 'جاري رفع الصورة...',
      file: 'جاري رفع الملف...',
    };
    
    toast.showInfo(
      'جاري الرفع',
      `${messages[fileType]} يرجى عدم إغلاق التطبيق`,
      { duration: 6000, position: 'bottom' }
    );
  }

  /**
   * عرض toast لنجاح رفع الملفات
   */
  static uploadSuccess(toast: any, fileType: 'video' | 'image' | 'file' = 'file') {
    const messages = {
      video: 'تم رفع الفيديو بنجاح',
      image: 'تم رفع الصورة بنجاح',
      file: 'تم رفع الملف بنجاح',
    };
    
    toast.showSuccess(
      'تم الرفع بنجاح',
      messages[fileType],
      { duration: 2000, position: 'top' }
    );
  }

  /**
   * عرض toast لفشل رفع الملفات
   */
  static uploadError(toast: any, error?: string) {
    toast.showError(
      'فشل الرفع',
      error || 'حدث خطأ أثناء رفع الملف. يرجى المحاولة مرة أخرى',
      { duration: 4000, position: 'top' }
    );
  }

  /**
   * عرض toast لتسجيل الدخول الناجح
   */
  static loginSuccess(toast: any, username?: string) {
    const message = username 
      ? `مرحباً بعودتك ${username}! تم تحميل بياناتك بنجاح`
      : 'تم تسجيل الدخول بنجاح. مرحباً بعودتك!';
    
    toast.showSuccess(
      'تم تسجيل الدخول',
      message,
      { duration: 2000, position: 'top' }
    );
  }

  /**
   * عرض toast لتسجيل الخروج الناجح
   */
  static logoutSuccess(toast: any) {
    toast.showSuccess(
      'تم تسجيل الخروج',
      'تم تسجيل خروجك بنجاح. نراك قريباً!',
      { duration: 2000, position: 'top' }
    );
  }

  /**
   * عرض toast لحفظ الإعدادات
   */
  static settingsSaved(toast: any) {
    toast.showSuccess(
      'تم الحفظ',
      'تم حفظ إعداداتك بنجاح',
      { duration: 2000, position: 'top' }
    );
  }

  /**
   * عرض toast لأخطاء الشبكة
   */
  static networkError(toast: any) {
    toast.showError(
      'خطأ في الاتصال',
      'تأكد من اتصالك بالإنترنت وحاول مرة أخرى',
      { duration: 4000, position: 'top' }
    );
  }

  /**
   * عرض toast لأخطاء الخادم
   */
  static serverError(toast: any) {
    toast.showError(
      'خطأ في الخادم',
      'حدث خطأ في الخادم. يرجى المحاولة مرة أخرى لاحقاً',
      { duration: 4000, position: 'top' }
    );
  }

  /**
   * عرض toast للتحديثات
   */
  static updateAvailable(toast: any) {
    toast.showInfo(
      'تحديث متاح',
      'يتوفر تحديث جديد للتطبيق. يرجى التحديث للحصول على أحدث الميزات',
      { duration: 6000, position: 'center' }
    );
  }

  /**
   * عرض toast لانتهاء الجلسة
   */
  static sessionExpired(toast: any) {
    toast.showWarning(
      'انتهت الجلسة',
      'انتهت صلاحية جلستك. يرجى تسجيل الدخول مرة أخرى',
      { duration: 5000, position: 'center' }
    );
  }

  /**
   * عرض toast للصيانة
   */
  static maintenanceMode(toast: any) {
    toast.showWarning(
      'وضع الصيانة',
      'الخدمة في وضع الصيانة حالياً. يرجى المحاولة لاحقاً',
      { duration: 6000, position: 'center' }
    );
  }
}

export default ToastHelper;