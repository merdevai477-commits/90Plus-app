import { ToastType } from '../components/common/ProfessionalToast';
import { useLanguageStore } from '../src/i18n/store';
import { translations } from '../src/i18n/utils';

interface ToastOptions {
  duration?: number;
  position?: 'top' | 'center' | 'bottom';
}

/**
 * Read the current translations object directly from the Zustand store.
 * Used by the toast manager (and other non-React utilities) so toasts
 * pick up the user's selected language without requiring a hook call.
 */
function getCurrentTranslations() {
  const lang = useLanguageStore.getState().language;
  return translations[lang] ?? translations.en;
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
   * Show a persistent loading toast. Caller must dismiss it.
   */
  showLoading(title: string, message: string, options?: ToastOptions) {
    this.showToastCallback?.('loading', title, message, options);
  }

  /** Dismiss the current loading toast. */
  hideLoading() {
    this.showToastCallback?.('info', '', '', { duration: 1 });
  }

  // ── Convenience methods (use current language from i18n store) ─────────
  showNetworkError() {
    const t = getCurrentTranslations();
    this.showError(
      t.toastManager?.networkErrorTitle ?? t.common.error,
      t.toastManager?.networkErrorMessage ?? t.common.errorOccurred,
    );
  }

  showAuthError() {
    const t = getCurrentTranslations();
    this.showError(
      t.toastManager?.authErrorTitle ?? t.common.error,
      t.toastManager?.authErrorMessage ?? t.common.errorOccurred,
    );
  }

  showValidationError(field: string) {
    const t = getCurrentTranslations();
    const template = t.toastManager?.validationErrorMessage ?? 'Please check {field} and try again';
    this.showError(
      t.toastManager?.validationErrorTitle ?? t.common.error,
      template.replace('{field}', field),
    );
  }

  showUploadSuccess(type: 'video' | 'image' | 'avatar' | 'cover') {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    const itemMap = {
      video: tm?.itemVideo ?? 'video',
      image: tm?.itemImage ?? 'image',
      avatar: tm?.itemAvatar ?? 'profile picture',
      cover: tm?.itemCover ?? 'cover image',
    };
    const template = tm?.uploadSuccessMessage ?? 'Uploaded {item} successfully';
    this.showSuccess(
      tm?.successTitle ?? 'Success',
      template.replace('{item}', itemMap[type]),
    );
  }

  showUploadError(type: 'video' | 'image' | 'avatar' | 'cover') {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    const itemMap = {
      video: tm?.itemVideo ?? 'video',
      image: tm?.itemImage ?? 'image',
      avatar: tm?.itemAvatar ?? 'profile picture',
      cover: tm?.itemCover ?? 'cover image',
    };
    const template = tm?.uploadFailedMessage ?? 'Failed to upload {item}. Try again.';
    this.showError(
      tm?.uploadFailedTitle ?? 'Upload failed',
      template.replace('{item}', itemMap[type]),
    );
  }

  showDeleteSuccess(type: 'video' | 'comment' | 'account') {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    const itemMap = {
      video: tm?.itemVideo ?? 'video',
      comment: tm?.itemComment ?? 'comment',
      account: tm?.itemAccount ?? 'account',
    };
    const template = tm?.deleteSuccessMessage ?? 'Deleted {item} successfully';
    this.showSuccess(
      tm?.deleteSuccessTitle ?? 'Deleted',
      template.replace('{item}', itemMap[type]),
    );
  }

  showBlockSuccess(username: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.blockSuccessTitle ?? 'Blocked',
      (tm?.blockSuccessMessage ?? 'Blocked @{username}').replace('{username}', username),
    );
  }

  showUnblockSuccess(username: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.unblockSuccessTitle ?? 'Unblocked',
      (tm?.unblockSuccessMessage ?? 'Unblocked @{username}').replace('{username}', username),
    );
  }

  showLanguageChangeSuccess(language: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.languageChangedTitle ?? 'Language changed',
      (tm?.languageChangedMessage ?? 'Language changed to {language}').replace('{language}', language),
    );
  }

  showPredictionSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.predictionSavedTitle ?? 'Prediction saved',
      tm?.predictionSavedMessage ?? 'Your prediction was saved.',
    );
  }

  showPredictionError() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showError(
      tm?.predictionFailedTitle ?? 'Prediction failed',
      tm?.predictionFailedMessage ?? 'Could not save the prediction. Try again.',
    );
  }

  showReportSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.reportSentTitle ?? 'Report sent',
      tm?.reportSentMessage ?? 'Thanks for the report. Our team will review it.',
    );
  }

  showSaveSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.saveSuccessTitle ?? 'Saved',
      tm?.saveSuccessMessage ?? 'Saved to your collection',
    );
  }

  showShareSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.shareSuccessTitle ?? 'Shared',
      tm?.shareSuccessMessage ?? 'Content shared successfully',
    );
  }

  showFollowSuccess(username: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.followSuccessTitle ?? 'Following',
      (tm?.followSuccessMessage ?? 'You are now following @{username}').replace('{username}', username),
    );
  }

  showUnfollowSuccess(username: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.unfollowSuccessTitle ?? 'Unfollowed',
      (tm?.unfollowSuccessMessage ?? 'You are no longer following @{username}').replace('{username}', username),
    );
  }

  showLikeSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.likeSuccessTitle ?? 'Liked',
      tm?.likeSuccessMessage ?? 'Your like was added',
    );
  }

  showCommentSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.commentSuccessTitle ?? 'Comment posted',
      tm?.commentSuccessMessage ?? 'Your comment was posted',
    );
  }

  showProfileUpdateSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.profileUpdatedTitle ?? 'Updated',
      tm?.profileUpdatedMessage ?? 'Your profile has been updated',
    );
  }

  showSettingsUpdateSuccess() {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showSuccess(
      tm?.settingsSavedTitle ?? 'Saved',
      tm?.settingsSavedMessage ?? 'Settings saved successfully',
    );
  }

  // Cooldown specific methods
  showCooldownWarning(type: 'avatar' | 'cover' | 'video' | 'username', timeRemaining: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    const itemMap = {
      avatar: tm?.itemAvatar ?? 'profile picture',
      cover: tm?.itemCover ?? 'cover image',
      video: tm?.itemVideo ?? 'video',
      username: tm?.itemUsername ?? 'username',
    };
    const template = tm?.cooldownMessage ?? 'You can change {item} after {time}';
    this.showWarning(
      tm?.cooldownTitle ?? 'Wait a moment',
      template.replace('{item}', itemMap[type]).replace('{time}', timeRemaining),
    );
  }

  showCooldownError(message: string) {
    const t = getCurrentTranslations();
    const tm = t.toastManager;
    this.showWarning(tm?.cooldownTitle ?? 'Wait a moment', message);
  }
}

export const toastManager = ToastManager.getInstance();
