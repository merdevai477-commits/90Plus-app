/**
 * Settings Screen - Football Predictions App
 * 
 * Professional AMOLED Dark Theme Settings
 * Designed for optimal user experience and performance
 * 
 * @author Staff Engineer
 * @version 2.0.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  StatusBar,
  Animated,
  Dimensions,
  Platform,
  Linking,
  Modal,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';

const { width } = Dimensions.get('window');

// ============================================================================
// CONSTANTS
// ============================================================================

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '100';

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function SettingsScreen() {
  // Context
  const {
    settings,
    loading: contextLoading,
    toggleNotifications,
    toggleMatchNotifications,
    toggleGoalNotifications,
    togglePredictionReminders,
    clearCache,
    resetSettings,
  } = useSettings();

  const { language, setLanguage: setAppLanguage, t, isRTL } = useLanguage();

  // Safety check for translations
  if (!t || !t.settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // Local state
  const [cacheSize, setCacheSize] = useState('12.5 MB');
  const [lastSync, setLastSync] = useState(isRTL ? 'منذ 5 دقائق' : '5 minutes ago');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [theme, setTheme] = useState<'dark' | 'amoled' | 'light'>('amoled');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================

  useEffect(() => {
    animateEntry();
    calculateCacheSize();
  }, []);

  const animateEntry = () => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 50,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const calculateCacheSize = async () => {
    // Calculate actual cache size here
    // For now, using placeholder
    setCacheSize('12.5 MB');
  };

  const updateLastSync = () => {
    const now = new Date();
    const diff = now.getTime() - settings.lastSyncTime;
    const minutes = Math.floor(diff / 60000);
    
    if (minutes < 1) {
      setLastSync('الآن');
    } else if (minutes < 60) {
      setLastSync(`منذ ${minutes} دقيقة`);
    } else {
      const hours = Math.floor(minutes / 60);
      setLastSync(`منذ ${hours} ساعة`);
    }
  };

  useEffect(() => {
    updateLastSync();
    const interval = setInterval(updateLastSync, 60000); // Update every minute
    return () => clearInterval(interval);
  }, [settings.lastSyncTime]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleToggleNotifications = async () => {
    try {
      await toggleNotifications(!settings.notificationsEnabled);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث إعدادات الإشعارات');
    }
  };

  const handleToggleMatchNotifications = async () => {
    try {
      await toggleMatchNotifications(!settings.matchNotifications);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث إعدادات إشعارات المباريات');
    }
  };

  const handleToggleGoalNotifications = async () => {
    try {
      await toggleGoalNotifications(!settings.goalNotifications);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث إعدادات إشعارات الأهداف');
    }
  };

  const handleTogglePredictionReminders = async () => {
    try {
      await togglePredictionReminders(!settings.predictionReminders);
    } catch (error) {
      Alert.alert('خطأ', 'فشل تحديث إعدادات تذكير التوقعات');
    }
  };

  const handleClearCache = () => {
    Alert.alert(
      t.settings.clearCacheTitle,
      t.settings.clearCacheMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.common.delete,
          style: 'destructive',
          onPress: async () => {
            try {
              await clearCache();
              setCacheSize('0 MB');
              Alert.alert(t.common.done, t.settings.clearCacheSuccess);
            } catch (error) {
              Alert.alert(t.common.error, t.settings.clearCacheError);
            }
          },
        },
      ]
    );
  };

  const handleLogout = () => {
    Alert.alert(
      'تسجيل الخروج',
      'هل أنت متأكد من تسجيل الخروج؟',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'تسجيل الخروج',
          style: 'destructive',
          onPress: () => {
            // Logout logic here
            Alert.alert('تم', 'تم تسجيل الخروج بنجاح');
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    Alert.alert(
      'حذف الحساب',
      'تحذير: هذا الإجراء لا يمكن التراجع عنه. سيتم حذف جميع بياناتك وتوقعاتك بشكل نهائي.',
      [
        { text: 'إلغاء', style: 'cancel' },
        {
          text: 'حذف الحساب',
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              'تأكيد الحذف',
              'هل أنت متأكد تماماً؟ لن تتمكن من استعادة حسابك.',
              [
                { text: 'إلغاء', style: 'cancel' },
                {
                  text: 'نعم، احذف حسابي',
                  style: 'destructive',
                  onPress: () => {
                    // Delete account logic here
                  },
                },
              ]
            );
          },
        },
      ]
    );
  };

  const handleRateApp = () => {
    // Open app store for rating
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/id123456789',
      android: 'https://play.google.com/store/apps/details?id=com.footballpredictions',
    });
    if (storeUrl) {
      Linking.openURL(storeUrl);
    }
  };

  const handleShareApp = () => {
    // Share app logic
    Alert.alert('مشاركة التطبيق', 'شارك التطبيق مع أصدقائك!');
  };

  const handleContactUs = () => {
    Linking.openURL('mailto:support@footballpredictions.com');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://footballpredictions.com/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://footballpredictions.com/terms');
  };

  const handleManagePermissions = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleResetSettings = () => {
    Alert.alert(
      isRTL ? 'إعادة تعيين الإعدادات' : 'Reset Settings',
      isRTL 
        ? 'هل أنت متأكد من إعادة تعيين جميع الإعدادات إلى الوضع الافتراضي؟'
        : 'Are you sure you want to reset all settings to default?',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: isRTL ? 'إعادة تعيين' : 'Reset',
          style: 'destructive',
          onPress: async () => {
            try {
              await resetSettings();
              Alert.alert(t.common.done, isRTL ? 'تم إعادة تعيين الإعدادات' : 'Settings reset successfully');
            } catch (error) {
              Alert.alert(t.common.error, isRTL ? 'فشل إعادة التعيين' : 'Failed to reset settings');
            }
          },
        },
      ]
    );
  };

  const handleExportData = () => {
    Alert.alert(
      isRTL ? 'تصدير البيانات' : 'Export Data',
      isRTL 
        ? 'سيتم تصدير جميع بياناتك وتوقعاتك'
        : 'All your data and predictions will be exported',
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: isRTL ? 'تصدير' : 'Export',
          onPress: () => {
            Alert.alert(t.settings.comingSoon, t.settings.featureInDevelopment);
          },
        },
      ]
    );
  };

  const handleHelp = () => {
    Alert.alert(
      isRTL ? 'المساعدة' : 'Help',
      isRTL 
        ? 'كيف يمكننا مساعدتك؟'
        : 'How can we help you?',
      [
        { text: isRTL ? 'الأسئلة الشائعة' : 'FAQ', onPress: () => {} },
        { text: isRTL ? 'دليل الاستخدام' : 'User Guide', onPress: () => {} },
        { text: t.common.cancel, style: 'cancel' },
      ]
    );
  };

  const handleReportBug = () => {
    Linking.openURL('mailto:support@footballpredictions.com?subject=Bug Report');
  };

  const handleFeatureRequest = () => {
    Linking.openURL('mailto:support@footballpredictions.com?subject=Feature Request');
  };

  const handleLanguageChange = async (lang: 'ar' | 'en' | 'fr' | 'es' | 'de' | 'it' | 'tr' | 'pt') => {
    try {
      await setAppLanguage(lang);
      setLanguageModalVisible(false);
      Alert.alert(
        isRTL ? 'تم تغيير اللغة' : 'Language Changed',
        isRTL 
          ? 'تم تغيير اللغة بنجاح. قد تحتاج لإعادة تشغيل التطبيق لتطبيق التغييرات بالكامل.'
          : 'Language changed successfully. You may need to restart the app for full effect.'
      );
    } catch (error) {
      Alert.alert(
        isRTL ? 'خطأ' : 'Error',
        isRTL ? 'فشل تغيير اللغة' : 'Failed to change language'
      );
    }
  };

  const getLanguageName = (lang: string): string => {
    const names: { [key: string]: string } = {
      ar: 'العربية',
      en: 'English',
      fr: 'Français',
      es: 'Español',
      de: 'Deutsch',
      it: 'Italiano',
      tr: 'Türkçe',
      pt: 'Português',
    };
    return names[lang] || lang;
  };

  // ============================================================================
  // RENDER COMPONENTS
  // ============================================================================

  const renderSectionHeader = (title: string, icon: string) => (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionHeaderLeft}>
        <View style={styles.sectionIconContainer}>
          <Ionicons name={icon as any} size={20} color="#22c55e" />
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
    </View>
  );

  const renderSwitchItem = (
    label: string,
    subtitle: string,
    value: boolean,
    onToggle: () => void,
    icon: string
  ) => (
    <View style={styles.settingItem}>
      <View style={styles.settingLeft}>
        <View style={styles.settingIconContainer}>
          <Ionicons name={icon as any} size={22} color="#888" />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={styles.settingLabel}>{label}</Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      <Switch
        value={value}
        onValueChange={onToggle}
        trackColor={{ false: '#1a1a1a', true: '#22c55e40' }}
        thumbColor={value ? '#22c55e' : '#666'}
        ios_backgroundColor="#1a1a1a"
      />
    </View>
  );

  const renderActionItem = (
    label: string,
    subtitle: string,
    onPress: () => void,
    icon: string,
    showChevron: boolean = true,
    danger: boolean = false
  ) => (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIconContainer}>
          <Ionicons 
            name={icon as any} 
            size={22} 
            color={danger ? '#ef4444' : '#888'} 
          />
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingLabel, danger && styles.dangerText]}>
            {label}
          </Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {showChevron && (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
    </TouchableOpacity>
  );

  const renderInfoItem = (label: string, value: string, icon: string) => (
    <View style={styles.infoItem}>
      <View style={styles.infoLeft}>
        <Ionicons name={icon as any} size={20} color="#888" />
        <Text style={styles.infoLabel}>{label}</Text>
      </View>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  if (contextLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <Ionicons name="settings" size={48} color="#22c55e" />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.headerLeft}>
            <View style={styles.headerIconContainer}>
              <Ionicons name="settings" size={28} color="#22c55e" />
            </View>
            <View>
              <Text style={styles.headerTitle}>{t.settings.title}</Text>
              <Text style={styles.headerSubtitle}>{t.settings.subtitle}</Text>
            </View>
          </View>
        </View>
      </View>

      <Animated.View
        style={{
          flex: 1,
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* NOTIFICATIONS SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.notifications, 'notifications')}
            <View style={styles.sectionContent}>
              {renderSwitchItem(
                t.settings.enableNotifications,
                t.settings.enableNotificationsDesc,
                settings.notificationsEnabled,
                handleToggleNotifications,
                'notifications-outline'
              )}
              {renderSwitchItem(
                t.settings.matchNotifications,
                t.settings.matchNotificationsDesc,
                settings.matchNotifications,
                handleToggleMatchNotifications,
                'football-outline'
              )}
              {renderSwitchItem(
                t.settings.goalNotifications,
                t.settings.goalNotificationsDesc,
                settings.goalNotifications,
                handleToggleGoalNotifications,
                'trophy-outline'
              )}
              {renderSwitchItem(
                t.settings.predictionReminders,
                t.settings.predictionRemindersDesc,
                settings.predictionReminders,
                handleTogglePredictionReminders,
                'time-outline'
              )}
            </View>
          </View>

          {/* PREFERENCES SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.preferences, 'options')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                t.settings.favoriteTeams,
                t.settings.favoriteTeamsDesc,
                () => Alert.alert(t.settings.comingSoon, t.settings.featureInDevelopment),
                'heart-outline'
              )}
              {renderActionItem(
                t.settings.favoriteLeagues,
                t.settings.favoriteLeaguesDesc,
                () => Alert.alert(t.settings.comingSoon, t.settings.featureInDevelopment),
                'trophy-outline'
              )}
              {renderActionItem(
                t.settings.language,
                getLanguageName(language),
                () => setLanguageModalVisible(true),
                'language-outline'
              )}
            </View>
          </View>

          {/* APPEARANCE SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(isRTL ? 'المظهر' : 'Appearance', 'color-palette')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                isRTL ? 'الثيم' : 'Theme',
                theme === 'amoled' ? 'AMOLED Dark' : theme === 'dark' ? 'Dark' : 'Light',
                () => Alert.alert(t.settings.comingSoon, t.settings.featureInDevelopment),
                'moon-outline'
              )}
              {renderSwitchItem(
                isRTL ? 'المؤثرات الصوتية' : 'Sound Effects',
                isRTL ? 'تشغيل الأصوات في التطبيق' : 'Play sounds in app',
                soundEffects,
                () => setSoundEffects(!soundEffects),
                'volume-high-outline'
              )}
              {renderSwitchItem(
                isRTL ? 'الاهتزاز' : 'Haptic Feedback',
                isRTL ? 'اهتزاز عند اللمس' : 'Vibrate on touch',
                hapticFeedback,
                () => setHapticFeedback(!hapticFeedback),
                'phone-portrait-outline'
              )}
            </View>
          </View>

          {/* PERMISSIONS SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(isRTL ? 'الأذونات' : 'Permissions', 'shield-checkmark')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                isRTL ? 'إدارة الأذونات' : 'Manage Permissions',
                isRTL ? 'التحكم في أذونات التطبيق' : 'Control app permissions',
                handleManagePermissions,
                'settings-outline'
              )}
              {renderInfoItem(
                isRTL ? 'الإشعارات' : 'Notifications',
                settings.notificationsEnabled ? (isRTL ? 'مفعلة' : 'Enabled') : (isRTL ? 'معطلة' : 'Disabled'),
                'notifications-outline'
              )}
            </View>
          </View>

          {/* DATA & STORAGE SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.dataStorage, 'server')}
            <View style={styles.sectionContent}>
              {renderSwitchItem(
                isRTL ? 'التحديث التلقائي' : 'Auto Refresh',
                isRTL ? 'تحديث البيانات تلقائياً' : 'Automatically refresh data',
                autoRefresh,
                () => setAutoRefresh(!autoRefresh),
                'refresh-outline'
              )}
              {renderActionItem(
                t.settings.clearCache,
                t.settings.clearCacheDesc,
                handleClearCache,
                'trash-outline',
                false
              )}
              {renderActionItem(
                isRTL ? 'تصدير البيانات' : 'Export Data',
                isRTL ? 'تصدير جميع بياناتك' : 'Export all your data',
                handleExportData,
                'download-outline',
                false
              )}
              {renderInfoItem(t.settings.cacheSize, cacheSize, 'folder-outline')}
              {renderInfoItem(t.settings.lastSync, lastSync, 'sync-outline')}
            </View>
          </View>

          {/* HELP & SUPPORT SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(isRTL ? 'المساعدة والدعم' : 'Help & Support', 'help-circle')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                isRTL ? 'المساعدة' : 'Help Center',
                isRTL ? 'الأسئلة الشائعة ودليل الاستخدام' : 'FAQ and user guide',
                handleHelp,
                'help-circle-outline'
              )}
              {renderActionItem(
                t.settings.contactUs,
                'support@footballpredictions.com',
                handleContactUs,
                'mail-outline'
              )}
              {renderActionItem(
                isRTL ? 'الإبلاغ عن مشكلة' : 'Report a Bug',
                isRTL ? 'أخبرنا عن أي مشاكل تقنية' : 'Tell us about technical issues',
                handleReportBug,
                'bug-outline'
              )}
              {renderActionItem(
                isRTL ? 'اقتراح ميزة' : 'Feature Request',
                isRTL ? 'شاركنا أفكارك لتحسين التطبيق' : 'Share your ideas to improve the app',
                handleFeatureRequest,
                'bulb-outline'
              )}
            </View>
          </View>

          {/* ABOUT SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.about, 'information-circle')}
            <View style={styles.sectionContent}>
              {renderInfoItem(t.settings.version, `${APP_VERSION} (${BUILD_NUMBER})`, 'code-outline')}
              {renderActionItem(
                t.settings.rateApp,
                t.settings.rateAppDesc,
                handleRateApp,
                'star-outline',
                false
              )}
              {renderActionItem(
                t.settings.shareApp,
                t.settings.shareAppDesc,
                handleShareApp,
                'share-social-outline',
                false
              )}
              {renderActionItem(
                t.settings.privacyPolicy,
                t.settings.privacyPolicyDesc,
                handlePrivacyPolicy,
                'shield-checkmark-outline'
              )}
              {renderActionItem(
                t.settings.termsConditions,
                t.settings.termsConditionsDesc,
                handleTerms,
                'document-text-outline'
              )}
            </View>
          </View>

          {/* ADVANCED SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(isRTL ? 'متقدم' : 'Advanced', 'construct')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                isRTL ? 'إعادة تعيين الإعدادات' : 'Reset Settings',
                isRTL ? 'استعادة الإعدادات الافتراضية' : 'Restore default settings',
                handleResetSettings,
                'refresh-circle-outline',
                false,
                true
              )}
              {renderInfoItem(
                isRTL ? 'معرف الجهاز' : 'Device ID',
                'XXXX-XXXX-XXXX',
                'phone-portrait-outline'
              )}
            </View>
          </View>

          {/* ACCOUNT SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.account, 'person')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                t.settings.logout,
                t.settings.logoutDesc,
                handleLogout,
                'log-out-outline',
                false,
                true
              )}
              {renderActionItem(
                t.settings.deleteAccount,
                t.settings.deleteAccountDesc,
                handleDeleteAccount,
                'trash-outline',
                false,
                true
              )}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              {t.settings.madeWith}
            </Text>
            <Text style={styles.footerCopyright}>
              {t.settings.copyright}
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Language Selection Modal */}
      <Modal
        visible={languageModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setLanguageModalVisible(false)}
      >
        <TouchableOpacity
          style={styles.modalOverlay}
          activeOpacity={1}
          onPress={() => setLanguageModalVisible(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isRTL ? 'اختر اللغة' : 'Select Language'}
              </Text>
              <TouchableOpacity
                onPress={() => setLanguageModalVisible(false)}
                style={styles.modalCloseButton}
              >
                <Ionicons name="close" size={24} color="#888" />
              </TouchableOpacity>
            </View>

            <ScrollView style={styles.languageList} showsVerticalScrollIndicator={false}>
              {/* Arabic */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'ar' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('ar')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇸🇦</Text>
                  <View>
                    <Text style={styles.languageName}>العربية</Text>
                    <Text style={styles.languageNative}>Arabic</Text>
                  </View>
                </View>
                {language === 'ar' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* English */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'en' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('en')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇬🇧</Text>
                  <View>
                    <Text style={styles.languageName}>English</Text>
                    <Text style={styles.languageNative}>الإنجليزية</Text>
                  </View>
                </View>
                {language === 'en' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* French */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'fr' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('fr')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇫🇷</Text>
                  <View>
                    <Text style={styles.languageName}>Français</Text>
                    <Text style={styles.languageNative}>French</Text>
                  </View>
                </View>
                {language === 'fr' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* Spanish */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'es' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('es')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇪🇸</Text>
                  <View>
                    <Text style={styles.languageName}>Español</Text>
                    <Text style={styles.languageNative}>Spanish</Text>
                  </View>
                </View>
                {language === 'es' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* German */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'de' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('de')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇩🇪</Text>
                  <View>
                    <Text style={styles.languageName}>Deutsch</Text>
                    <Text style={styles.languageNative}>German</Text>
                  </View>
                </View>
                {language === 'de' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* Italian */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'it' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('it')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇮🇹</Text>
                  <View>
                    <Text style={styles.languageName}>Italiano</Text>
                    <Text style={styles.languageNative}>Italian</Text>
                  </View>
                </View>
                {language === 'it' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* Turkish */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'tr' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('tr')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇹🇷</Text>
                  <View>
                    <Text style={styles.languageName}>Türkçe</Text>
                    <Text style={styles.languageNative}>Turkish</Text>
                  </View>
                </View>
                {language === 'tr' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>

              {/* Portuguese */}
              <TouchableOpacity
                style={[
                  styles.languageItem,
                  language === 'pt' && styles.languageItemActive,
                ]}
                onPress={() => handleLanguageChange('pt')}
              >
                <View style={styles.languageLeft}>
                  <Text style={styles.languageFlag}>🇵🇹</Text>
                  <View>
                    <Text style={styles.languageName}>Português</Text>
                    <Text style={styles.languageNative}>Portuguese</Text>
                  </View>
                </View>
                {language === 'pt' && (
                  <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                )}
              </TouchableOpacity>
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.modalFooterText}>
                {isRTL 
                  ? 'قد تحتاج لإعادة تشغيل التطبيق لتطبيق التغييرات بالكامل'
                  : 'You may need to restart the app for full effect'}
              </Text>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: '#000',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
  },
  header: {
    backgroundColor: '#0a0a0a',
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  headerIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#22c55e15',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 4,
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#888',
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  sectionHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  sectionIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: '#22c55e15',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#fff',
  },
  sectionContent: {
    backgroundColor: '#0a0a0a',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    overflow: 'hidden',
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  settingLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    flex: 1,
  },
  settingIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1a1a1a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingTextContainer: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 3,
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  dangerText: {
    color: '#ef4444',
  },
  infoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  infoLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  infoLabel: {
    fontSize: 14,
    color: '#888',
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 8,
  },
  footerText: {
    fontSize: 13,
    color: '#666',
    textAlign: 'center',
  },
  footerCopyright: {
    fontSize: 11,
    color: '#444',
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#0a0a0a',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#1a1a1a',
    width: '100%',
    maxWidth: 400,
    overflow: 'hidden',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#1a1a1a',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  modalCloseButton: {
    padding: 4,
  },
  languageList: {
    padding: 12,
    maxHeight: 400,
  },
  languageItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 16,
    borderRadius: 12,
    backgroundColor: '#1a1a1a',
    marginBottom: 8,
  },
  languageItemActive: {
    backgroundColor: '#22c55e15',
    borderWidth: 1,
    borderColor: '#22c55e30',
  },
  languageLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
  },
  languageFlag: {
    fontSize: 32,
  },
  languageName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
    marginBottom: 2,
  },
  languageNative: {
    fontSize: 12,
    color: '#888',
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#1a1a1a',
  },
  modalFooterText: {
    fontSize: 12,
    color: '#888',
    textAlign: 'center',
    lineHeight: 18,
  },
});
