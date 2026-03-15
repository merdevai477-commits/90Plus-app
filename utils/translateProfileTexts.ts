/**
 * Utility to replace hardcoded Arabic texts with translation keys in profile.tsx
 * This is a one-time utility to help with the translation process
 */

export const profileTextReplacements = [
  // Error messages
  { arabic: 'بيانات المستخدم غير متوفرة', key: 't.profile.userDataNotAvailable' },
  { arabic: 'يرجى تسجيل الدخول مرة أخرى', key: 't.profile.pleaseLoginAgain' },
  { arabic: 'لم يتم اختيار صورة صحيحة', key: 't.profile.noValidImageSelected' },
  { arabic: 'فشل في رفع صورة الغلاف', key: 't.profile.coverUploadFailed' },
  { arabic: 'حدث خطأ أثناء الرفع', key: 't.profile.uploadError' },
  { arabic: 'تم رفع صورة الغلاف بنجاح 🖼️', key: 't.profile.coverUploadSuccess' },
  { arabic: 'تم رفع صورة البروفايل بنجاح 📸', key: 't.profile.avatarUploadSuccess' },
  { arabic: 'فشل في رفع الصورة', key: 't.profile.avatarUploadFailed' },
  { arabic: 'جاري تحميل معلومات الرفع، يرجى المحاولة مرة أخرى', key: 't.profile.loadingUploadInfo' },
  { arabic: 'يتم رفع الفيديو في الخلفية...', key: 't.profile.uploadingInBackground' },
  { arabic: 'تم رفع الفيديو بنجاح! 🚀', key: 't.profile.videoUploadSuccess' },
  { arabic: 'فشل في رفع الفيديو', key: 't.profile.videoUploadFailed' },
  { arabic: 'حدث خطأ أثناء رفع الفيديو', key: 't.profile.videoUploadError' },
  
  // UI Labels
  { arabic: 'خطأ', key: 't.profile.error' },
  { arabic: 'تم', key: 't.profile.success' },
  { arabic: 'جاري التحميل', key: 't.profile.loading' },
  { arabic: 'جاري الرفع', key: 't.profile.loading' },
  { arabic: 'حسناً', key: 't.profile.okay' },
  { arabic: 'إلغاء', key: 't.profile.cancel' },
  { arabic: 'حذف', key: 't.profile.delete' },
  
  // Action messages
  { arabic: '⏳ انتظر قليلاً', key: 't.profile.waitABit' },
  { arabic: 'يمكنك تغيير صورة الغلاف بعد', key: 't.profile.canChangeCoverAfter' },
  { arabic: 'يمكنك تغيير صورة البروفايل بعد', key: 't.profile.canChangeAvatarAfter' },
  { arabic: 'يمكنك رفع فيديو جديد بعد', key: 't.profile.canUploadVideoAfter' },
  { arabic: 'يمكنك رفع فيديو كل 24 ساعة', key: 't.profile.cooldownActive' },
  
  // Video management
  { arabic: 'حذف الفيديو', key: 't.profile.deleteVideo' },
  { arabic: 'هل أنت متأكد من حذف هذا الفيديو؟', key: 't.profile.confirmDeleteVideo' },
  
  // Analytics section
  { arabic: '📊 إحصائيات التوقعات', key: '📊 ' + 't.profile.predictionStats' },
];

export const getTranslatedText = (arabicText: string): string => {
  const replacement = profileTextReplacements.find(r => r.arabic === arabicText);
  return replacement ? replacement.key : arabicText;
};