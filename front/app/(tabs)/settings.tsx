/**
 * Settings Screen - 90Plus
 * 
 * New purple-gradient design with glass cards.
 * Uses tokens from constants/tokens.ts for design consistency.
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  StatusBar,
  Animated,
  Platform,
  Linking,
  ActivityIndicator,
  Share,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import {
  Bell,
  Shield,
  ChevronRight,
  Globe,
  Volume2,
  Smartphone,
  RefreshCw,
  Trash2,
  HelpCircle,
  Star,
  Share2,
  FileText,
  LogOut,
  UserX,
  Ban,
  Settings,
  Palette,
  Database,
  Info,
  User,
  Mail,
  Bug,
  Lightbulb,
} from 'lucide-react-native';
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
import { useScreenFont } from '../../utils/fontSetup';
import { MainShell } from '../../components/shell/MainShell';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_SOFT,
  PURPLE_GLOW_SM,
  SCREEN_PADDING_H,
  GRADIENT_HERO_PURPLE_BLUE,
  BORDER_ARENA,
  RADIUS_LG,
  PURPLE_PRIMARY,
  BLUE_GLOW_SM,
  GOLD_SOFT,
} from '../../constants/tokens';

const APP_VERSION = '1.0.0';
const BUILD_NUMBER = '100';

export default function SettingsScreen() {
  useScreenFont();

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

  const {
    language: i18nLanguage,
    setLanguage: setI18nLanguage,
    t: i18nT,
    isRTL: i18nIsRTL,
  } = useTranslation();

  const { language: contextLanguage, setLanguage: setAppLanguage, t, isRTL } = useLanguage();

  if (!t) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color={PURPLE_PRIMARY} />
        <Text style={styles.loadingText}>
          {i18nIsRTL ? 'جاري تحميل الإعدادات...' : 'Loading Settings...'}
        </Text>
      </View>
    );
  }

  const currentLanguage = i18nLanguage;

  const [cacheSize, setCacheSize] = useState('12.5 MB');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [soundEffects, setSoundEffects] = useState(true);
  const [hapticFeedback, setHapticFeedback] = useState(true);
  const [deletionModalVisible, setDeletionModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    calculateCacheSize();
  }, []);

  const calculateCacheSize = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      let totalSize = 0;
      const values = await AsyncStorage.multiGet(keys);
      values.forEach(([_, value]) => {
        if (value) totalSize += value.length * 2;
      });
      const sizeMB = (totalSize / (1024 * 1024)).toFixed(1);
      setCacheSize(`${sizeMB} MB`);
    } catch {
      setCacheSize('0 MB');
    }
  };

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      toastManager.showInfo('جاري تسجيل الخروج', 'جاري تنظيف البيانات وتسجيل الخروج...');
      await clearVideos();
      await globalState.logout();
      const { CoinsService } = await import('../../services/coins.service');
      CoinsService.clearCurrentUser();
      const { AuthService } = await import('../../src/services/authService');
      AuthService.clearMemoryCache();
      const { rankingsService } = await import('../../services/rankingsService');
      rankingsService.clearMemoryCache();
      const { useHomeStore } = await import('../../src/store/home.store');
      useHomeStore.getState().clearUserData();
      const { websocketClient } = await import('../../services/websocketClient');
      websocketClient.disconnect();
      const { cacheService } = await import('../../services/cacheService');
      await cacheService.clearAll();
      await AsyncStorage.removeItem('@username_setup_complete');
      await AsyncStorage.removeItem('@user_profile');
      await signOut();
      router.replace('/auth');
      toastManager.showSuccess('تم تسجيل الخروج', 'تم تسجيل الخروج بنجاح. نراك قريباً!');
    } catch (e: any) {
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
      await AccountDeletionService.deleteAccount();
      await clearVideos();
      await signOut();
      await globalState.logout();
      const { CoinsService } = await import('../../services/coins.service');
      CoinsService.clearCurrentUser();
      const { AuthService } = await import('../../src/services/authService');
      AuthService.clearMemoryCache();
      const { rankingsService } = await import('../../services/rankingsService');
      rankingsService.clearMemoryCache();
      const { useHomeStore } = await import('../../src/store/home.store');
      useHomeStore.getState().clearUserData();
      const { websocketClient } = await import('../../services/websocketClient');
      websocketClient.disconnect();
      const { cacheService } = await import('../../services/cacheService');
      await cacheService.clearAll();
      await AsyncStorage.removeItem('@username_setup_complete');
      await AsyncStorage.removeItem('@user_profile');
      router.replace('/auth');
      toastManager.showSuccess('تم حذف الحساب', 'تم حذف حسابك بنجاح. شكراً لاستخدامك التطبيق.');
    } catch (error) {
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
    } catch (error) {
      // User cancelled share
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

  const handleReportBug = () => {
    Linking.openURL('mailto:merdevai477@gmail.com?subject=Bug Report - 90Plus App');
  };

  const handleFeatureRequest = () => {
    Linking.openURL('mailto:merdevai477@gmail.com?subject=Feature Request - 90Plus App');
  };

  const handleLanguageChange = async (lang: Language) => {
    setIsChangingLanguage(true);
    try {
      toastManager.showInfo('جاري تغيير اللغة', 'جاري تطبيق اللغة الجديدة...');
      await setI18nLanguage(lang);
      await setAppLanguage(lang);
      toastManager.showLanguageChangeSuccess(getLanguageName(lang));
      setLanguageModalVisible(false);
    } catch (error) {
      toastManager.showError('خطأ', 'فشل تغيير اللغة. حاول مرة أخرى.');
    } finally {
      setIsChangingLanguage(false);
    }
  };

  const getLanguageName = (lang: string): string => {
    const info = getLanguageInfo(lang as Language);
    if (info) {
      return `${info.flag} ${info.nativeName} (${info.name})`;
    }
    return lang;
  };

  // ── Loading ───────────────────────────────────────────────────────────────

  if (contextLoading) {
    return (
      <View style={styles.loadingContainer}>
        <StatusBar barStyle="light-content" backgroundColor="#000" />
        <ActivityIndicator size="large" color={PURPLE_PRIMARY} />
        <Text style={styles.loadingText}>
          {isRTL ? 'جاري تحميل الإعدادات...' : 'Loading Settings...'}
        </Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <MainShell title={isRTL ? 'الإعدادات' : 'Settings'} subtitle={isRTL ? 'تحكم في تجربتك وتفضيلاتك' : 'Control your preferences and app behavior'}>
      {/* Hero banner */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[...GRADIENT_HERO_PURPLE_BLUE]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.heroEyebrow}>{isRTL ? 'مركز التحكم' : 'CONTROL CENTER'}</Text>
        <Text style={styles.heroTitle}>{isRTL ? 'التنبيهات وسلوك التطبيق' : 'Alerts & app behavior'}</Text>
      </View>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isRTL ? 'الإشعارات' : 'Notifications'}</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={() => router.push('/notification-preferences')}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <Bell size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'صندوق الإشعارات' : 'Notification inbox'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'عرض التنبيهات والسجل' : 'View alerts and history'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <View style={styles.switchCard}>
        <RowToggle
          label={isRTL ? 'إشعارات المباريات' : 'Match reminders'}
          sub={isRTL ? 'تنبيهات بداية المباريات والأهداف' : 'Kickoffs and score bursts'}
          value={settings.matchNotifications}
          onValueChange={handleToggleMatchNotifications}
        />
        <View style={styles.divider} />
        <RowToggle
          label={isRTL ? 'إشعارات الأهداف' : 'Goal alerts'}
          sub={isRTL ? 'تنبيه فوري عند تسجيل هدف' : 'Instant goal notifications'}
          value={settings.goalNotifications}
          onValueChange={handleToggleGoalNotifications}
        />
        <View style={styles.divider} />
        <RowToggle
          label={isRTL ? 'تذكير التوقعات' : 'Prediction reminders'}
          sub={isRTL ? 'تذكيرك بالتوقع قبل المباراة' : 'Remind before match starts'}
          value={settings.predictionReminders}
          onValueChange={handleTogglePredictionReminders}
        />
        <View style={styles.divider} />
        <RowToggle
          label={isRTL ? 'كل الإشعارات' : 'All notifications'}
          sub={isRTL ? 'تفعيل أو تعطيل الكل' : 'Master toggle for all alerts'}
          value={settings.notificationsEnabled}
          onValueChange={handleToggleNotifications}
        />
      </View>

      {/* ── Preferences ───────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isRTL ? 'التفضيلات' : 'Preferences'}</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={() => setLanguageModalVisible(true)}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Globe size={18} color="#93c5fd" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'اللغة' : 'Language'}</Text>
            <Text style={styles.linkSub}>{getLanguageName(currentLanguage)}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <View style={styles.switchCard}>
        <RowToggle
          label={isRTL ? 'المؤثرات الصوتية' : 'Sound effects'}
          sub={isRTL ? 'تشغيل الأصوات في التطبيق' : 'In-app audio feedback'}
          value={soundEffects}
          onValueChange={(v) => {
            setSoundEffects(v);
            toastManager.showSettingsUpdateSuccess();
          }}
        />
        <View style={styles.divider} />
        <RowToggle
          label={isRTL ? 'الاهتزاز التفاعلي' : 'Haptic feedback'}
          sub={isRTL ? 'تفعيل الاهتزاز عند التفاعل' : 'Vibration on interactions'}
          value={hapticFeedback}
          onValueChange={(v) => {
            setHapticFeedback(v);
            toastManager.showSettingsUpdateSuccess();
          }}
        />
        <View style={styles.divider} />
        <RowToggle
          label={isRTL ? 'التحديث التلقائي' : 'Auto refresh'}
          sub={isRTL ? 'تحديث البيانات تلقائياً' : 'Refresh data automatically'}
          value={autoRefresh}
          onValueChange={(v) => {
            setAutoRefresh(v);
            toastManager.showSettingsUpdateSuccess();
          }}
        />
      </View>

      {/* ── Data & Storage ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isRTL ? 'البيانات والتخزين' : 'Data & storage'}</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={handleClearCache}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Trash2 size={18} color="#fca5a5" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'مسح الذاكرة المؤقتة' : 'Clear cache'}</Text>
            <Text style={styles.linkSub}>{isRTL ? `الحجم الحالي: ${cacheSize}` : `Current size: ${cacheSize}`}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.88}
        style={[styles.linkRow, { marginTop: 8 }]}
        onPress={handleManagePermissions}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <Shield size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'إدارة الأذونات' : 'Manage permissions'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'التحكم في أذونات التطبيق' : 'Control app permissions'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.88}
        style={[styles.linkRow, { marginTop: 8 }]}
        onPress={() => router.push('/settings/blocked-users' as any)}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(245,197,24,0.12)' }]}>
            <Ban size={18} color="#fcd34d" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'المستخدمون المحظورون' : 'Blocked users'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'إدارة المستخدمين المحظورين' : 'Manage blocked users'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Support & Legal ───────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isRTL ? 'الدعم والقانوني' : 'Support & legal'}</Text>

      <TouchableOpacity activeOpacity={0.88} style={styles.linkRow} onPress={handleContactUs}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Mail size={18} color="#93c5fd" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'تواصل معنا' : 'Contact us'}</Text>
            <Text style={styles.linkSub}>merdevai477@gmail.com</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={handleReportBug}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Bug size={18} color="#fca5a5" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'الإبلاغ عن مشكلة' : 'Report a bug'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'أخبرنا عن أي مشاكل تقنية' : 'Tell us about technical issues'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={handleFeatureRequest}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: GOLD_SOFT }]}>
            <Lightbulb size={18} color="#fcd34d" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'اقتراح ميزة' : 'Feature request'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'شاركنا أفكارك' : 'Share your ideas'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={handlePrivacyPolicy}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <FileText size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'سياسة الخصوصية' : 'Privacy policy'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'اطلع على كيفية حماية بياناتك' : 'How we protect your data'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={handleTerms}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <FileText size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'الشروط والأحكام' : 'Terms & conditions'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'اقرأ شروط الاستخدام' : 'Read our usage terms'}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isRTL ? 'حول التطبيق' : 'About'}</Text>

      <View style={styles.switchCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{isRTL ? 'الإصدار' : 'Version'}</Text>
          <Text style={styles.infoValue}>{APP_VERSION} ({BUILD_NUMBER})</Text>
        </View>
        <View style={styles.divider} />
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{isRTL ? 'البيئة' : 'Environment'}</Text>
          <Text style={styles.infoValue}>{__DEV__ ? 'Development' : 'Production'}</Text>
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.88} style={styles.linkRow} onPress={handleRateApp}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: GOLD_SOFT }]}>
            <Star size={18} color="#fcd34d" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'تقييم التطبيق' : 'Rate app'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'ساعدنا بتقييمك' : 'Help us improve'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={handleShareApp}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Share2 size={18} color="#93c5fd" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{isRTL ? 'مشاركة التطبيق' : 'Share app'}</Text>
            <Text style={styles.linkSub}>{isRTL ? 'شارك مع أصدقائك' : 'Invite your friends'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Account ───────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{isRTL ? 'الحساب' : 'Account'}</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={handleLogout}
        disabled={isLoggingOut}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            {isLoggingOut ? (
              <ActivityIndicator size={18} color="#fca5a5" />
            ) : (
              <LogOut size={18} color="#fca5a5" strokeWidth={2.2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.linkTitle, { color: '#fca5a5' }]}>
              {isLoggingOut ? (isRTL ? 'جاري تسجيل الخروج...' : 'Logging out...') : (isRTL ? 'تسجيل الخروج' : 'Log out')}
            </Text>
            <Text style={styles.linkSub}>{isRTL ? 'الخروج من حسابك الحالي' : 'Sign out of your account'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.88}
        style={[styles.linkRow, { marginTop: 8 }]}
        onPress={handleDeleteAccount}
        disabled={isDeletingAccount}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            {isDeletingAccount ? (
              <ActivityIndicator size={18} color="#ef4444" />
            ) : (
              <UserX size={18} color="#ef4444" strokeWidth={2.2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.linkTitle, { color: '#ef4444' }]}>
              {isDeletingAccount ? (isRTL ? 'جاري حذف الحساب...' : 'Deleting...') : (isRTL ? 'حذف الحساب' : 'Delete account')}
            </Text>
            <Text style={styles.linkSub}>{isRTL ? 'حذف حسابك وجميع بياناتك نهائياً' : 'Permanently delete your account'}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          {isRTL ? 'صُنع بـ ❤️ لعشاق كرة القدم' : 'Made with ❤️ for football fans'}
        </Text>
        <Text style={styles.footerCopyright}>© 2024 90Plus. All rights reserved.</Text>
      </View>

      {/* Modals */}
      <LanguagePickerModal
        visible={languageModalVisible}
        onClose={() => setLanguageModalVisible(false)}
        onLanguageChange={handleLanguageChange}
      />
      <ImprovedAccountDeletionModal
        visible={deletionModalVisible}
        onClose={() => setDeletionModalVisible(false)}
        onConfirm={handleConfirmDeletion}
        isDeleting={isDeletingAccount}
      />
    </MainShell>
  );
}

// ── RowToggle ─────────────────────────────────────────────────────────────────

function RowToggle({
  label,
  sub,
  value,
  onValueChange,
}: {
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.toggleRow}>
      <View style={{ flex: 1, paddingRight: 12 }}>
        <Text style={styles.toggleTitle}>{label}</Text>
        <Text style={styles.toggleSub}>{sub}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onValueChange}
        trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(124,58,237,0.55)' }}
        thumbColor={value ? '#f4f4f5' : 'rgba(255,255,255,0.35)'}
        ios_backgroundColor="rgba(255,255,255,0.12)"
      />
    </View>
  );
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    backgroundColor: '#0A0612',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
  },
  loadingText: {
    color: TEXT_MUTED,
    fontSize: 14,
  },

  hero: {
    marginHorizontal: -SCREEN_PADDING_H,
    marginBottom: 20,
    paddingHorizontal: SCREEN_PADDING_H,
    paddingVertical: 16,
    borderRadius: RADIUS_LG,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
  },
  heroEyebrow: {
    color: TEXT_MUTED,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.3,
    textTransform: 'uppercase',
  },
  heroTitle: {
    marginTop: 8,
    fontSize: 18,
    fontWeight: '800',
    color: TEXT_PRIMARY,
    letterSpacing: -0.35,
  },

  sectionLabel: {
    fontSize: 13,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    marginBottom: 10,
    marginTop: 4,
  },

  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 12,
    marginBottom: 0,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', flex: 1 },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  linkTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  linkSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },

  switchCard: {
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.035)',
    paddingVertical: 4,
    marginBottom: 22,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  toggleSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_ARENA,
    marginLeft: 12,
    marginRight: 12,
  },

  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  infoLabel: { fontSize: 14, color: TEXT_MUTED },
  infoValue: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },

  footer: {
    alignItems: 'center',
    paddingVertical: 32,
    gap: 6,
  },
  footerText: {
    fontSize: 13,
    color: TEXT_MUTED,
    textAlign: 'center',
  },
  footerCopyright: {
    fontSize: 11,
    color: 'rgba(255,255,255,0.2)',
    textAlign: 'center',
  },
});
