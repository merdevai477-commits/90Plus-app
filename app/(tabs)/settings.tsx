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
import * as LocalAuthentication from 'expo-local-authentication';
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
import AccountDeletionModal from '../../components/common/AccountDeletionModal';
import { AccountDeletionService } from '../../services/accountDeletionService';

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
    toggleBiometric,
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
  if (!t || !t.settings) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0a0a0a' }}>
        <ActivityIndicator size="large" color="#22c55e" />
      </View>
    );
  }

  // Use the new i18n language as the source of truth
  const currentLanguage = i18nLanguage;

  // Local state
  const [cacheSize, setCacheSize] = useState('12.5 MB');
  const [lastSync, setLastSync] = useState(t.settings.justNow || 'Just now');
  const [ipAddress, setIpAddress] = useState('Loading...');
  const [biometricSupported, setBiometricSupported] = useState(false);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [deletionModalVisible, setDeletionModalVisible] = useState(false);

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
    checkBiometrics();
  }, []);

  const fetchIpAddress = async () => {
    try {
      const ip = await Network.getIpAddressAsync();
      setIpAddress(ip || t.common.unknown);
    } catch (e) {
      setIpAddress(t.common.unavailable);
    }
  };

  const checkBiometrics = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const isEnrolled = await LocalAuthentication.isEnrolledAsync();
    setBiometricSupported(hasHardware && isEnrolled);
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
      setLastSync(t.settings.justNow || 'Just now');
    } else if (minutes < 60) {
      const template = t.settings.minutesAgo || '{n} minutes ago';
      setLastSync(template.replace('{n}', minutes.toString()));
    } else {
      const hours = Math.floor(minutes / 60);
      const template = t.settings.hoursAgo || '{n} hours ago';
      setLastSync(template.replace('{n}', hours.toString()));
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
      Alert.alert(t.common.error, t.settings.clearCacheError);
    }
  };

  const handleToggleMatchNotifications = async () => {
    try {
      await toggleMatchNotifications(!settings.matchNotifications);
    } catch (error) {
      Alert.alert(t.common.error, t.settings.clearCacheError);
    }
  };

  const handleToggleGoalNotifications = async () => {
    try {
      await toggleGoalNotifications(!settings.goalNotifications);
    } catch (error) {
      Alert.alert(t.common.error, t.settings.clearCacheError);
    }
  };

  const handleTogglePredictionReminders = async () => {
    try {
      await togglePredictionReminders(!settings.predictionReminders);
    } catch (error) {
      Alert.alert(t.common.error, t.settings.clearCacheError);
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
      t.settings.logout,
      t.settings.logoutDesc,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.settings.logout,
          style: 'destructive',
          onPress: async () => {
            try {
              console.log('🔄 Starting logout process...');

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
              setTimeout(() => {
                Alert.alert(t.common.done, isRTL ? 'تم تسجيل الخروج بنجاح' : 'Logged out successfully');
              }, 500);
            } catch (e: any) {
              console.error('❌ Logout error:', e);
              console.error('Error details:', e.message, e.stack);
              Alert.alert(t.common.error, isRTL ? 'فشل تسجيل الخروج. حاول مرة أخرى.' : 'Logout failed. Please try again.');
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    setDeletionModalVisible(true);
  };

  const handleConfirmDeletion = async () => {
    try {
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
    } catch (error) {
      console.error('Delete account error:', error);
      Alert.alert(t.common.error, isRTL ? 'فشل حذف الحساب' : 'Failed to delete account');
    }
  };

  const handleRateApp = () => {
    const storeUrl = Platform.select({
      ios: 'https://apps.apple.com/app/90plus/id6744076498',
      android: 'https://play.google.com/store/apps/details?id=com.ninetyplusapp',
    });
    if (storeUrl) {
      Linking.openURL(storeUrl).catch(() => {
        Alert.alert(
          t.settings.rateApp,
          isRTL ? 'شكراً لدعمك! يمكنك تقييم التطبيق من متجر التطبيقات.' : 'Thank you for your support! You can rate us on the App Store.'
        );
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
    Alert.alert(
      t.settings.helpSupport,
      t.settings.helpPrompt,
      [
        {
          text: t.settings.faq,
          onPress: () => Linking.openURL('https://90plus-app-production.up.railway.app/support'),
        },
        {
          text: isRTL ? 'تواصل معنا' : 'Contact Us',
          onPress: () => Linking.openURL('mailto:merdevai477@gmail.com?subject=Help%20-%2090Plus%20App'),
        },
        { text: t.common.cancel, style: 'cancel' },
      ]
    );
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
    try {
      // Update new i18n system
      await setI18nLanguage(lang);
      // Also update old context for backward compatibility
      await setAppLanguage(lang);
      setLanguageModalVisible(false);
    } catch (error) {
      Alert.alert(
        t.common.error,
        t.settings.changeLanguageError
      );
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
                t.settings.language,
                getLanguageName(currentLanguage),
                () => setLanguageModalVisible(true),
                'language-outline'
              )}
            </View>
          </View>

          {/* APPEARANCE SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.appearance, 'color-palette')}
            <View style={styles.sectionContent}>
              {renderSwitchItem(
                t.settings.soundEffects,
                t.settings.soundEffectsDesc,
                soundEffects,
                () => setSoundEffects(!soundEffects),
                'volume-high-outline'
              )}
              {renderSwitchItem(
                t.settings.hapticFeedback,
                t.settings.hapticFeedbackDesc,
                hapticFeedback,
                () => setHapticFeedback(!hapticFeedback),
                'phone-portrait-outline'
              )}
              {biometricSupported && renderSwitchItem(
                t.settings.biometricUnlock,
                t.settings.biometricUnlockDesc,
                settings.biometricEnabled,
                () => toggleBiometric(!settings.biometricEnabled),
                'finger-print-outline'
              )}
            </View>
          </View>

          {/* PERMISSIONS SECTION */}
          <View style={styles.section}>
            {renderSectionHeader(t.settings.permissions, 'shield-checkmark')}
            <View style={styles.sectionContent}>
              {renderActionItem(
                t.settings.managePermissions,
                t.settings.managePermissionsDesc,
                handleManagePermissions,
                'settings-outline'
              )}
              {renderActionItem(
                isRTL ? 'المستخدمون المحظورون' : 'Blocked Users',
                isRTL ? 'إدارة المستخدمين المحظورين' : 'Manage blocked users',
                () => router.push('/settings/blocked-users' as any),
                'ban-outline'
              )}
              {renderInfoItem(
                t.settings.notifications,
                settings.notificationsEnabled ? t.settings.enabled : t.settings.disabled,
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
                'merdevai477@gmail.com',
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

          {/* App Info Section */}
          <View style={styles.section}>
            {renderSectionHeader(isRTL ? 'معلومات التطبيق' : 'App Info', 'construct')}
            <View style={styles.sectionContent}>
              {renderInfoItem(
                isRTL ? 'البيئة' : 'Environment',
                __DEV__ ? 'Development' : 'Production',
                'globe-outline'
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

      {/* Language Selection Modal - Using new LanguagePickerModal component */}
      {/* Requirements: 7.1, 7.2, 7.3, 7.4 */}
      <LanguagePickerModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageChange={handleLanguageChange}
      />

      {/* Account Deletion Modal */}
      <AccountDeletionModal
        visible={deletionModalVisible}
        onClose={() => setDeletionModalVisible(false)}
        onConfirm={handleConfirmDeletion}
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
