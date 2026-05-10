import { ToastType } from '../components/common/ProfessionalToast';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
}

// Global toast manager for use across the app
class ToastManager {
  private static instance: ToastManager;
  private showToastCallback: ((type: ToastType, title: string, message: string, options?: ToastOptions) => void) | null = null;

  static getInstance(): ToastManager {
    if (!ToastManager.instance) {
      ToastManager.instance = new ToastManager();
    }
    return ToastManager.instance;
  }

  setShowToastCallback(callback: (type: ToastType, title: string, message: string, options?: ToastOptions) => void) {
    this.showToastCallback = callback;
  }

  showSuccess(title: string, message: string, options?: ToastOptions) {
    this.showToastCallback?.('success', title, message, options);
  }

  showError(title: string, message: string, options?: ToastOptions) {
    this.showToastCallback?.('error', title, message, options);
  }

  showWarning(title: string, message: string, options?: ToastOptions) {
    this.showToastCallback?.('warning', title, message, options);
  }

  showInfo(title: string, message: string, options?: ToastOptions) {
    this.showToastCallback?.('info', title, message, options);
  }

  /**
   * Show a persistent loading toast with a spinning icon. Unlike the other
   * variants this one does NOT auto-dismiss — callers must call
   * `toastManager.hideLoading()` (or show another toast) when the work is
   * done. Useful for long-running actions like uploads.
   */
  showLoading(title: string, message: string, options?: ToastOptions) {
    this.showToastCallback?.('loading', title, message, options);
  }

  /** Dismiss the current loading toast (shows a fleeting success-less info). */
  hideLoading() {
    // Ask the provider to hide via a no-op info toast with duration=0 so it
    // exits immediately. Implementation: providers handle `loading` specially
    // (no auto-hide) and any new toast replaces it, so a new info with 1ms
    // duration + empty strings is the simplest way to dismiss.
    this.showToastCallback?.('info', '', '', { duration: 1 });
  }

  // Convenience methods for common scenarios
  showNetworkError() {
    this.showError('خطأ في الشبكة', 'تحقق من اتصالك بالإنترنت وحاول مرة أخرى');
  }

  showAuthError() {
    this.showError('خطأ في المصادقة', 'يرجى تسجيل الدخول مرة أخرى');
  }

  showValidationError(field: string) {
    this.showError('خطأ في البيانات', `يرجى التحقق من ${field} والمحاولة مرة أخرى`);
  }

  showUploadSuccess(type: 'video' | 'image' | 'avatar' | 'cover') {
    const typeMap = {
      video: 'الفيديو',
      image: 'الصورة', 
      avatar: 'صورة الملف الشخصي',
      cover: 'صورة الغلاف'
    };
    this.showSuccess('تم بنجاح', `تم رفع ${typeMap[type]} بنجاح`);
  }

  showUploadError(type: 'video' | 'image' | 'avatar' | 'cover') {
    const typeMap = {
      video: 'الفيديو',
      image: 'الصورة',
      avatar: 'صورة الملف الشخصي', 
      cover: 'صورة الغلاف'
    };
    this.showError('فشل الرفع', `فشل في رفع ${typeMap[type]}. حاول مرة أخرى`);
  }

  showDeleteSuccess(type: 'video' | 'comment' | 'account') {
    const typeMap = {
      video: 'الفيديو',
      comment: 'التعليق',
      account: 'الحساب'
    };
    this.showSuccess('تم الحذف', `تم حذف ${typeMap[type]} بنجاح`);
  }

  showBlockSuccess(username: string) {
    this.showSuccess('تم الحظر', `تم حظر @${username} بنجاح`);
  }

  showUnblockSuccess(username: string) {
    this.showSuccess('تم إلغاء الحظر', `تم إلغاء حظر @${username} بنجاح`);
  }

  showLanguageChangeSuccess(language: string) {
    this.showSuccess('تم تغيير اللغة', `تم تغيير اللغة إلى ${language} بنجاح`);
  }

  showPredictionSuccess() {
    this.showSuccess('تم التوقع', 'تم حفظ توقعك بنجاح');
  }

  showPredictionError() {
    this.showError('فشل التوقع', 'فشل في حفظ التوقع. حاول مرة أخرى');
  }

  showReportSuccess() {
    this.showSuccess('تم الإبلاغ', 'تم إرسال البلاغ بنجاح. سيتم مراجعته قريباً');
  }

  showSaveSuccess() {
    this.showSuccess('تم الحفظ', 'تم حفظ المحتوى في مجموعتك');
  }

  showShareSuccess() {
    this.showSuccess('تم المشاركة', 'تم مشاركة المحتوى بنجاح');
  }

  showFollowSuccess(username: string) {
    this.showSuccess('تم المتابعة', `أصبحت تتابع @${username}`);
  }

  showUnfollowSuccess(username: string) {
    this.showSuccess('تم إلغاء المتابعة', `لم تعد تتابع @${username}`);
  }

  showLikeSuccess() {
    this.showSuccess('تم الإعجاب', 'تم إضافة إعجابك');
  }

  showCommentSuccess() {
    this.showSuccess('تم التعليق', 'تم إضافة تعليقك بنجاح');
  }

  showProfileUpdateSuccess() {
    this.showSuccess('تم التحديث', 'تم تحديث ملفك الشخصي بنجاح');
  }

  showSettingsUpdateSuccess() {
    this.showSuccess('تم الحفظ', 'تم حفظ الإعدادات بنجاح');
  }

  // Cooldown specific methods
  showCooldownWarning(type: 'avatar' | 'cover' | 'video' | 'username', timeRemaining: string) {
    const typeMap = {
      avatar: 'الصورة الشخصية',
      cover: 'صورة الغلاف',
      video: 'الفيديو',
      username: 'اسم المستخدم'
    };
    this.showWarning('انتظر قليلاً', `يمكنك تغيير ${typeMap[type]} بعد ${timeRemaining}`);
  }

  showCooldownError(message: string) {
    // Extract time information from Arabic message if possible
    if (message.includes('يوم') || message.includes('ساعة')) {
      this.showWarning('انتظر قليلاً', message);
    } else {
      this.showWarning('انتظر قليلاً', message);
    }
  }
}

export const toastManager = ToastManager.getInstance();