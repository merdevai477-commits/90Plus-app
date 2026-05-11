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
  ActivityIndicator,
  Share,
} from 'react-native';
import * as Network from 'expo-network';
import { Ionicons } from '@expo/vector-icons';
import { useSettings } from '../../contexts/SettingsContext';
import { useLanguage } from '../../contexts/LanguageContext';
import { useVideos } from '../../contexts/VideosContext';
import { useRouter } from 'expo-router';
import { globalState } from '../../globalState';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguagePickerModal from '../../components/common/LanguagePickerModal';
import { useTranslation, getLanguageInfo, Language } from '../../src/i18n';
import ImprovedAccountDeletionModal from '../../components/common/ImprovedAccountDeletionModal';
import { AccountDeletionService } from '../../services/accountDeletionService';
import { toastManager } from '../../services/toastManager';
import { APP_BG } from '../../constants/ui';

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
  const { clearVideos } = useVideos();
  const {
    settings,
    loading: contextLoading,
    toggleNotifications,
    toggleMatchNotifications,
    toggleGoalNotifications,
    togglePredictionReminders,

    clearCache,
    deleteAccount,
  } = useSettings();

  const router = useRouter();
  const { signOut } = useAuth();

  // Use new i18n system (Requirements: 7.1, 7.4)
  const {
    language: i18nLanguage,
    setLanguage: setI18nLanguage,
    t: i18nT,
    isRTL: i18nIsRTL
  } = useTranslation();

  // Keep old context for backward compatibility during migration
  const { language: contextLanguage, setLanguage: setAppLanguage, t, isRTL } = useLanguage();

  // Safety check for translations
  if (!t) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="settings" size={48} color="#22c55e" />
          </View>
          <Text style={styles.loadingTitle}>
            {isRTL ? 'جاري تحميل الإعدادات...' : 'Loading Settings...'}
          </Text>
          <Text style={styles.loadingSubtitle}>
            {isRTL ? 'يرجى الانتظار قليلاً' : 'Please wait a moment'}
          </Text>
          <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 20 }} />
        </View>
      </View>
    );
  }

  // Use the new i18n language as the source of truth
  const currentLanguage = i18nLanguage;

  // Local state
  const [cacheSize, setCacheSize] = useState('12.5 MB');
  const [lastSync, setLastSync] = useState('الآن');
  const [ipAddress, setIpAddress] = useState('Loading...');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [deletionModalVisible, setDeletionModalVisible] = useState(false);

  // Loading states for better UX
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;

  // ============================================================================
  // LIFECYCLE
  // ============================================================================


  useEffect(() => {
    animateEntry();
    calculateCacheSize();
    fetchIpAddress();
  }, []);

  const fetchIpAddress = async () => {
    try {
      const ip = await Network.getIpAddressAsync();
      setIpAddress(ip || t.common.unknown);
    } catch (e) {
      setIpAddress(t.common.unavailable);
    }
  };

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
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      const values = await AsyncStorage.multiGet(keys);
      values.forEach(([_, value]) => {
        if (value) totalSize += value.length * 2; // UTF-16 chars = 2 bytes each
      });
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
      setCacheSize(`${sizeMB} MB`);
    } catch {
      setCacheSize('0 MB');
    }
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
      toastManager.showSettingsUpdateSuccess();
    } catch (error) {
      toastManager.showError('خطأ', 'فشل في تحديث إعدادات الإشعارات');
    }
  };

  const handleToggleMatchNotifications = async () => {
    try {
      await toggleMatchNotifications(!settings.matchNotifications);
      toastManager.showSettingsUpdateSuccess();
    } catch (error) {
      toastManager.showError('خطأ', 'فشل في تحديث إعدادات إشعارات المباريات');
    }
  };

  const handleToggleGoalNotifications = async () => {
    try {
      await toggleGoalNotifications(!settings.goalNotifications);
      toastManager.showSettingsUpdateSuccess();
    } catch (error) {
      toastManager.showError('خطأ', 'فشل في تحديث إعدادات إشعارات الأهداف');
    }
  };

  const handleTogglePredictionReminders = async () => {
    try {
      await togglePredictionReminders(!settings.predictionReminders);
      toastManager.showSettingsUpdateSuccess();
    } catch (error) {
      toastManager.showError('خطأ', 'فشل في تحديث إعدادات تذكير التوقعات');
    }
  };

  const handleClearCache = async () => {
    try {
      await clearCache();
      setCacheSize('0 MB');
      toastManager.showSuccess('تم المسح', 'تم مسح الذاكرة المؤقتة بنجاح');
    } catch (error) {
      toastManager.showError('خطأ', 'فشل مسح الذاكرة المؤقتة');
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      console.log('🔄 Starting logout process...');

      toastManager.showInfo('جاري تسجيل الخروج', 'جاري تنظيف البيانات وتسجيل الخروج...');

      // Clear videos data first
      await clearVideos();
      console.log('✅ Videos cleared');

      // Clear global state
      await globalState.logout();
      console.log('✅ Global state cleared');

      // Clear CoinsService user context
      const { CoinsService } = await import('../../services/coins.service');
      CoinsService.clearCurrentUser();
      console.log('✅ Coins service cleared');

      // Clear AuthService memory cache
      const { AuthService } = await import('../../src/services/authService');
      AuthService.clearMemoryCache();
      console.log('✅ Auth service cache cleared');

      // Clear RankingsService memory cache
      const { rankingsService } = await import('../../services/rankingsService');
      rankingsService.clearMemoryCache();
      console.log('✅ Rankings service cache cleared');

      // Clear home.store user data
      const { useHomeStore } = await import('../../src/store/home.store');
      useHomeStore.getState().clearUserData();
      console.log('✅ Home store cleared');

      // Disconnect WebSocket
      const { websocketClient } = await import('../../services/websocketClient');
      websocketClient.disconnect();
      console.log('✅ WebSocket disconnected');

      // Clear all cache (including profile, reels, notifications, etc.)
      const { cacheService } = await import('../../services/cacheService');
      await cacheService.clearAll();
      console.log('✅ Cache service cleared');

      // Clear AsyncStorage
      await AsyncStorage.removeItem('@username_setup_complete');
      await AsyncStorage.removeItem('@user_profile');
      console.log('✅ AsyncStorage cleared');

      // Sign out from Clerk LAST (after all cleanup)
      await signOut();
      console.log('✅ Clerk sign out complete');

      // Navigate to Auth screen
      router.replace('/auth');
      console.log('✅ Navigated to auth screen');

      // Show success message
      toastManager.showSuccess('تم تسجيل الخروج', 'تم تسجيل الخروج بنجاح. نراك قريباً!');
    } catch (e: any) {
      console.error('❌ Logout error:', e);
      console.error('Error details:', e.message, e.stack);
      toastManager.showError('خطأ في تسجيل الخروج', 'فشل تسجيل الخروج. حاول مرة أخرى.');
    } finally {
      setIsLoggingOut(false);
    }
  };

  const handleDeleteAccount = () => {
    setDeletionModalVisible(true);
  };

  const handleConfirmDeletion = async () => {
    setIsDeletingAccount(true);
    try {
      toastManager.showInfo('جاري حذف الحساب', 'جاري حذف حسابك وجميع بياناتك...');

      // Call the deletion service
      await AccountDeletionService.deleteAccount();

      // Clear videos data first
      await clearVideos();

      // Sign out from Clerk first
      await signOut();

      // Clear global state
      await globalState.logout();

      // Clear CoinsService user context
      const { CoinsService } = await import('../../services/coins.service');
      CoinsService.clearCurrentUser();

      // Clear AuthService memory cache
      const { AuthService } = await import('../../src/services/authService');
      AuthService.clearMemoryCache();

      // Clear RankingsService memory cache
      const { rankingsService } = await import('../../services/rankingsService');
      rankingsService.clearMemoryCache();

      // Clear home.store user data
      const { useHomeStore } = await import('../../src/store/home.store');
      useHomeStore.getState().clearUserData();

      // Disconnect WebSocket
      const { websocketClient } = await import('../../services/websocketClient');
      websocketClient.disconnect();

      // Clear all cache (including profile, reels, notifications, etc.)
      const { cacheService } = await import('../../services/cacheService');
      await cacheService.clearAll();

      // Clear AsyncStorage
      await AsyncStorage.removeItem('@username_setup_complete');
      await AsyncStorage.removeItem('@user_profile');

      // Navigate to Auth screen
      router.replace('/auth');

      toastManager.showSuccess('تم حذف الحساب', 'تم حذف حسابك بنجاح. شكراً لاستخدامك التطبيق.');
    } catch (error) {
      console.error('Delete account error:', error);
      toastManager.showError('فشل حذف الحساب', 'حدث خطأ أثناء حذف الحساب. يرجى المحاولة مرة أخرى.');
    } finally {
      setIsDeletingAccount(false);
      setDeletionModalVisible(false);
    }
  };

  const handleRateApp = () => {
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/90plus/id6744076498',
      android: 'https://play.google.com/store/apps/details?id=com.ninetyplusapp',
    });
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {
        toastManager.showInfo('شكراً لدعمك!', 'يمكنك تقييم التطبيق من متجر التطبيقات');
      });
    }
  };

  const handleShareApp = async () => {
    try {
      await Share.share({
        message: isRTL
          ? '🏆 جرّب تطبيق 90Plus - أفضل تطبيق لكرة القدم! تنبؤات، اختبارات، وأهداف مباشرة! https://apps.apple.com/app/90plus/id6744076498'
          : '🏆 Try 90Plus - The ultimate football app! Predictions, quizzes, and live highlights! https://apps.apple.com/app/90plus/id6744076498',
        title: '90Plus Football App',
      });
      toastManager.showSuccess('تم المشاركة', 'تم مشاركة التطبيق بنجاح');
    } catch (error) {
      // User cancelled share - no action needed
    }
  };

  const handleContactUs = () => {
    Linking.openURL('https://90plus-app-production.up.railway.app/support');
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL('https://90plus-app-production.up.railway.app/privacy');
  };

  const handleTerms = () => {
    Linking.openURL('https://90plus-app-production.up.railway.app/terms');
  };

  const handleManagePermissions = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleHelp = () => {
    toastManager.showInfo('المساعدة والدعم', 'اختر نوع المساعدة التي تحتاجها');
  };

  const handleReportBug = () => {
    Linking.openURL('mailto:merdevai477@gmail.com?subject=Bug Report - 90Plus App');
  };

  const handleFeatureRequest = () => {
    Linking.openURL('mailto:merdevai477@gmail.com?subject=Feature Request - 90Plus App');
  };

  /**
   * Handle language change from the new LanguagePickerModal
   * Uses the new i18n system and syncs with old context for compatibility
   * Requirements: 7.1, 7.4
   */
  const handleLanguageChange = async (lang: Language) => {
    setIsChangingLanguage(true);
    try {
      toastManager.showInfo('جاري تغيير اللغة', 'جاري تطبيق اللغة الجديدة...');

      // Update new i18n system
      await setI18nLanguage(lang);
      // Also update old context for backward compatibility
      await setAppLanguage(lang);
      
      // Show success message
      toastManager.showLanguageChangeSuccess(getLanguageName(lang));
      
      setLanguageModalVisible(false);
    } catch (error) {
      toastManager.showError('خطأ', 'فشل تغيير اللغة. حاول مرة أخرى.');
    } finally {
      setIsChangingLanguage(false);
    }
  };

  /**
   * Get display name for a language using the new i18n types
   * Requirements: 7.2, 7.3
   */
  const getLanguageName = (lang: string): string => {
    const info = getLanguageInfo(lang as Language);
    if (info) {
      return `${info.flag} ${info.nativeName} (${info.name})`;
    }
    return lang;
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
    danger: boolean = false,
    loading: boolean = false,
    loadingText?: string
  ) => (
    <TouchableOpacity
      style={[styles.settingItem, loading && styles.settingItemLoading]}
      onPress={loading ? undefined : onPress}
      activeOpacity={loading ? 1 : 0.7}
      disabled={loading}
    >
      <View style={styles.settingLeft}>
        <View style={styles.settingIconContainer}>
          {loading ? (
            <ActivityIndicator size="small" color={danger ? '#ef4444' : '#22c55e'} />
          ) : (
            <Ionicons
              name={icon as any}
              size={22}
              color={danger ? '#ef4444' : '#888'}
            />
          )}
        </View>
        <View style={styles.settingTextContainer}>
          <Text style={[styles.settingLabel, danger && styles.dangerText, loading && styles.loadingLabel]}>
            {loading && loadingText ? loadingText : label}
          </Text>
          <Text style={styles.settingSubtitle}>{subtitle}</Text>
        </View>
      </View>
      {showChevron && !loading && (
        <Ionicons name="chevron-forward" size={20} color="#666" />
      )}
      {loading && (
        <View style={styles.loadingIndicator}>
          <ActivityIndicator size="small" color="#22c55e" />
        </View>
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
        <View style={styles.loadingContent}>
          <View style={styles.loadingIconContainer}>
            <Ionicons name="settings" size={48} color="#22c55e" />
          </View>
          <Text style={styles.loadingTitle}>
            {isRTL ? 'جاري تحميل الإعدادات...' : 'Loading Settings...'}
          </Text>
          <Text style={styles.loadingSubtitle}>
            {isRTL ? 'يرجى الانتظار قليلاً' : 'Please wait a moment'}
          </Text>
          <ActivityIndicator size="large" color="#22c55e" style={{ marginTop: 20 }} />
        </View>
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
              <Text style={styles.headerTitle}>الإعدادات</Text>
              <Text style={styles.headerSubtitle}>تخصيص تجربتك</Text>
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
            {renderSectionHeader('الإشعارات', 'notifications')}
            <View style={styles.sectionContent}>
              {renderSwitchItem(
                'تفعيل الإشعارات',
                'استقبال جميع الإشعارات',
                settings.notificationsEnabled,
                handleToggleNotifications,
                'notifications-outline'
              )}
              {renderSwitchItem(
                'إشعارات المباريات',
                'تنبيهات قبل بدء المباريات المهمة',
                settings.matchNotifications,
                handleToggleMatchNotifications,
                'football-outline'
              )}
              {renderSwitchItem(
                'إشعارات الأهداف',
                'تنبيهات فورية عند تسجيل الأهداف',
                settings.goalNotifications,
                handleToggleGoalNotifications,
                'trophy-outline'
              )}
              {renderSwitchItem(
                'تذكير بالتوقعات',
                'تذكيرك بالتوقع قبل بدء المباراة',
                settings.predictionReminders,
                handleTogglePredictionReminders,
                'time-outline'
              )}
              {renderActionItem(
                'إعدادات الإشعارات التفصيلية',
                'تحكم في كل نوع من الإشعارات',
                () => router.push('/notification-preferences'),
                'options-outline'
              )}
            </View>
          </View>

          {/* PREFERENCES SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('التفضيلات', 'options')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                'اللغة',
                getLanguageName(currentLanguage),
                () => setLanguageModalVisible(true),
                'language-outline',
                true,
                false,
                isChangingLanguage,
                'جاري تغيير اللغة...'
              )}
            </View>
          </View>

          {/* APPEARANCE SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('المظهر', 'color-palette')}
            <View style={styles.sectionContent}>
              {renderSwitchItem(
                'المؤثرات الصوتية',
                'تشغيل الأصوات في التطبيق',
                soundEffects,
                () => {
                  setSoundEffects(!soundEffects);
                  toastManager.showSettingsUpdateSuccess();
                },
                'volume-high-outline'
              )}
              {renderSwitchItem(
                'الاهتزاز التفاعلي',
                'تفعيل الاهتزاز عند التفاعل',
                hapticFeedback,
                () => {
                  setHapticFeedback(!hapticFeedback);
                  toastManager.showSettingsUpdateSuccess();
                },
                'phone-portrait-outline'
              )}
            </View>
          </View>

          {/* PERMISSIONS SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('الأذونات', 'shield-checkmark')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                'إدارة الأذونات',
                'التحكم في أذونات التطبيق',
                handleManagePermissions,
                'settings-outline'
              )}
              {renderActionItem(
                'المستخدمون المحظورون',
                'إدارة المستخدمين المحظورين',
                () => router.push('/settings/blocked-users' as any),
                'ban-outline'
              )}
              {renderInfoItem(
                'الإشعارات',
                settings.notificationsEnabled ? 'مفعلة' : 'معطلة',
                'notifications-outline'
              )}
            </View>
          </View>

          {/* DATA & STORAGE SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('البيانات والتخزين', 'server')}
            <View style={styles.sectionContent}>
              {renderSwitchItem(
                'التحديث التلقائي',
                'تحديث البيانات تلقائياً',
                autoRefresh,
                () => {
                  setAutoRefresh(!autoRefresh);
                  toastManager.showSettingsUpdateSuccess();
                },
                'refresh-outline'
              )}
              {renderActionItem(
                'مسح الذاكرة المؤقتة',
                'حرر مساحة التخزين',
                handleClearCache,
                'trash-outline',
                false
              )}
              {renderInfoItem('حجم البيانات المخزنة', cacheSize, 'folder-outline')}
              {renderInfoItem('آخر مزامنة', lastSync, 'sync-outline')}
            </View>
          </View>

          {/* HELP & SUPPORT SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('المساعدة والدعم', 'help-circle')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                'المساعدة',
                'الأسئلة الشائعة ودليل الاستخدام',
                handleHelp,
                'help-circle-outline'
              )}
              {renderActionItem(
                'تواصل معنا',
                'merdevai477@gmail.com',
                handleContactUs,
                'mail-outline'
              )}
              {renderActionItem(
                'الإبلاغ عن مشكلة',
                'أخبرنا عن أي مشاكل تقنية',
                handleReportBug,
                'bug-outline'
              )}
              {renderActionItem(
                'اقتراح ميزة',
                'شاركنا أفكارك لتحسين التطبيق',
                handleFeatureRequest,
                'bulb-outline'
              )}
            </View>
          </View>

          {/* ABOUT SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('حول التطبيق', 'information-circle')}
            <View style={styles.sectionContent}>
              {renderInfoItem('الإصدار', `${APP_VERSION} (${BUILD_NUMBER})`, 'code-outline')}
              {renderActionItem(
                'تقييم التطبيق',
                'ساعدنا بتقييمك',
                handleRateApp,
                'star-outline',
                false
              )}
              {renderActionItem(
                'مشاركة التطبيق',
                'شارك مع أصدقائك',
                handleShareApp,
                'share-social-outline',
                false
              )}
              {renderActionItem(
                'سياسة الخصوصية',
                'اطلع على سياسة الخصوصية',
                handlePrivacyPolicy,
                'shield-checkmark-outline'
              )}
              {renderActionItem(
                'الشروط والأحكام',
                'اقرأ شروط الاستخدام',
                handleTerms,
                'document-text-outline'
              )}
            </View>
          </View>

          {/* App Info Section */}
          <View style={styles.section}>
            {renderSectionHeader('معلومات التطبيق', 'construct')}
            <View style={styles.sectionContent}>
              {renderInfoItem(
                'البيئة',
                __DEV__ ? 'Development' : 'Production',
                'globe-outline'
              )}
            </View>
          </View>

          {/* ACCOUNT SECTION */}
          <View style={styles.section}>
            {renderSectionHeader('الحساب', 'person')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                'تسجيل الخروج',
                'الخروج من حسابك الحالي',
                handleLogout,
                'log-out-outline',
                false,
                true,
                isLoggingOut,
                'جاري تسجيل الخروج...'
              )}
              {renderActionItem(
                'حذف الحساب',
                'حذف حسابك وجميع بياناتك نهائياً',
                handleDeleteAccount,
                'trash-outline',
                false,
                true,
                isDeletingAccount,
                'جاري حذف الحساب...'
              )}
            </View>
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <Text style={styles.footerText}>
              صُنع بـ ❤️ لعشاق كرة القدم
            </Text>
            <Text style={styles.footerCopyright}>
              © 2024 Football Predictions. All rights reserved.
            </Text>
          </View>
        </ScrollView>
      </Animated.View>

      {/* Language Selection Modal - Using new LanguagePickerModal component */}
      {/* Requirements: 7.1, 7.2, 7.3, 7.4 */}
      <LanguagePickerModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageChange={handleLanguageChange}
      />

      {/* Account Deletion Modal */}
      <ImprovedAccountDeletionModal
        visible={deletionModalVisible}
        onClose={() => setDeletionModalVisible(false)}
        onConfirm={handleConfirmDeletion}
        isDeleting={isDeletingAccount}
      />
    </View >
  );
}

// ============================================================================
// STYLES
// ============================================================================

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: APP_BG,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingContent: {
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  loadingIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#22c55e15',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    borderWidth: 2,
    borderColor: '#22c55e30',
  },
  loadingTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
  },
  loadingSubtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
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
  settingItemLoading: {
    opacity: 0.7,
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
  loadingLabel: {
    color: '#22c55e',
  },
  settingSubtitle: {
    fontSize: 12,
    color: '#666',
    lineHeight: 16,
  },
  dangerText: {
    color: '#ef4444',
  },
  loadingIndicator: {
    marginLeft: 8,
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
