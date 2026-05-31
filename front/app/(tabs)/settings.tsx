/**
 * Settings Screen - 90Plus
 *
 * Fully localized: every user-facing string comes from front/locales/*.ts
 * via the i18n hook. Layout stays LTR for all languages; only copy changes.
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  StatusBar,
  Platform,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import {
  Bell,
  Shield,
  ChevronRight,
  Globe,
  Trash2,
  Star,
  FileText,
  LogOut,
  UserX,
  Share2,
  Ban,
  Mail,
} from 'lucide-react-native';
import { useSettings } from '../../contexts/SettingsContext';
import { useVideos } from '../../contexts/VideosContext';
import { useRouter } from 'expo-router';
import { globalState } from '../../globalState';
import { useAuth } from '@clerk/clerk-expo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguagePickerModal from '../../components/common/LanguagePickerModal';
import { useTranslation, getLanguageInfo, Language } from '../../src/i18n';
import ImprovedAccountDeletionModal from '../../components/common/ImprovedAccountDeletionModal';
import { AccountDeletionService } from '../../services/accountDeletionService';
import { LEGAL_URLS } from '../../config/legal.config';
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
  GOLD_SOFT,
} from '../../constants/tokens';
import {
  getStoreReviewUrl,
  getStoreUrl,
} from '../../constants/shareLinks';
import { useAppShareReward } from '../../hooks/useAppShareReward';

const APP_VERSION = '1.0.0';

export default function SettingsScreen() {
  useScreenFont();

  const { clearVideos } = useVideos();
  const {
    loading: contextLoading,
    clearCache,
  } = useSettings();

  const router = useRouter();
  const { signOut, getToken } = useAuth();

  const { t, language, setLanguage } = useTranslation();
  const tSettings = t.settingsScreen;
  const tCommon = t.common;

  const [cacheSize, setCacheSize] = useState('12.5 MB');
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
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

  const handleClearCache = async () => {
    try {
      await clearCache();
      setCacheSize('0 MB');
      toastManager.showSuccess(tSettings.cacheCleared, tSettings.cacheClearedDetail);
    } catch {
      toastManager.showError(tCommon.error, tSettings.cacheClearFailed);
    }
  };

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      toastManager.showInfo(tSettings.loggingOutTitle, tSettings.loggingOutDetail);
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
      await AsyncStorage.removeItem('@90plus_age_verified');
      await signOut();
      router.replace('/auth');
      toastManager.showSuccess(tSettings.logoutSuccess, tSettings.logoutSuccessDetail);
    } catch {
      toastManager.showError(tSettings.logoutFailed, tSettings.logoutFailedDetail);
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
      toastManager.showInfo(tSettings.deletingAccount, tSettings.deletingAccountDetail);
      const token = await getToken();
      if (!token) throw new Error('Not authenticated');
      await AccountDeletionService.deleteAccount(token);
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
      toastManager.showSuccess(tSettings.deleteAccountSuccess, tSettings.deleteAccountSuccessDetail);
    } catch {
      toastManager.showError(tSettings.deleteAccountFailed, tSettings.deleteAccountFailedDetail);
    } finally {
      setIsDeletingAccount(false);
      setDeletionModalVisible(false);
    }
  };

  const handleRateApp = () => {
    const storeUrl = getStoreReviewUrl();
    Linking.openURL(storeUrl).catch(() => {
      Linking.openURL(getStoreUrl()).catch(() => {
        toastManager.showInfo(tSettings.rateThanks, tSettings.rateThanksDetail);
      });
    });
  };

  const { shareAppAndClaim } = useAppShareReward();

  const handleShareApp = async () => {
    await shareAppAndClaim(language === 'en' ? 'en' : 'ar');
  };

  const handleContactUs = () => {
    Linking.openURL(LEGAL_URLS.support);
  };

  const handlePrivacyPolicy = () => {
    Linking.openURL(LEGAL_URLS.privacy);
  };

  const handleTerms = () => {
    Linking.openURL(LEGAL_URLS.terms);
  };

  const handleManagePermissions = () => {
    if (Platform.OS === 'ios') {
      Linking.openURL('app-settings:');
    } else {
      Linking.openSettings();
    }
  };

  const handleLanguageChange = async (lang: Language) => {
    setIsChangingLanguage(true);
    try {
      toastManager.showInfo(tSettings.languageChanging, tSettings.languageChangingDetail);
      await setLanguage(lang);
      toastManager.showLanguageChangeSuccess(getLanguageName(lang));
      setLanguageModalVisible(false);
    } catch {
      toastManager.showError(tCommon.error, tSettings.languageChangeFailed);
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
        <Text style={styles.loadingText}>{tSettings.loading}</Text>
      </View>
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <MainShell title={tSettings.title} subtitle={tSettings.subtitle}>
      {/* Hero banner */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[...GRADIENT_HERO_PURPLE_BLUE]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.heroEyebrow}>{tSettings.heroEyebrow}</Text>
        <Text style={styles.heroTitle}>{tSettings.heroTitle}</Text>
      </View>

      {/* ── Notifications ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{tSettings.sectionNotifications}</Text>

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
            <Text style={styles.linkTitle}>{tSettings.notificationPreferences}</Text>
            <Text style={styles.linkSub}>{tSettings.notificationPreferencesSub}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity
        activeOpacity={0.88}
        style={[styles.linkRow, { marginTop: 8 }]}
        onPress={() => router.push('/notifications')}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <Bell size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tSettings.notificationInbox}</Text>
            <Text style={styles.linkSub}>{tSettings.notificationInboxSub}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Preferences ───────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{tSettings.sectionPreferences}</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={() => setLanguageModalVisible(true)}
        disabled={isChangingLanguage}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Globe size={18} color="#93c5fd" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tSettings.language}</Text>
            <Text style={styles.linkSub}>{getLanguageName(language)}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Data & Storage ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{tSettings.sectionData}</Text>

      <TouchableOpacity activeOpacity={0.88} style={styles.linkRow} onPress={handleClearCache}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
            <Trash2 size={18} color="#fca5a5" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tSettings.clearCache}</Text>
            <Text style={styles.linkSub}>
              {tSettings.currentSize.replace('{size}', cacheSize)}
            </Text>
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
            <Text style={styles.linkTitle}>{tSettings.managePermissions}</Text>
            <Text style={styles.linkSub}>{tSettings.managePermissionsSub}</Text>
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
            <Text style={styles.linkTitle}>{tSettings.blockedUsers}</Text>
            <Text style={styles.linkSub}>{tSettings.blockedUsersSub}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── Support & Legal ───────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{tSettings.sectionSupport}</Text>

      <TouchableOpacity activeOpacity={0.88} style={styles.linkRow} onPress={handleContactUs}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            <Mail size={18} color="#93c5fd" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tSettings.contactUs}</Text>
            <Text style={styles.linkSub}>{tSettings.contactUsSub}</Text>
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
            <Text style={styles.linkTitle}>{tSettings.privacyPolicy}</Text>
            <Text style={styles.linkSub}>{tSettings.privacyPolicySub}</Text>
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
            <Text style={styles.linkTitle}>{tSettings.termsConditions}</Text>
            <Text style={styles.linkSub}>{tSettings.termsConditionsSub}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      {/* ── About ─────────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{tSettings.sectionAbout}</Text>

      <View style={styles.switchCard}>
        <View style={styles.infoRow}>
          <Text style={styles.infoLabel}>{tSettings.version}</Text>
          <Text style={styles.infoValue}>{APP_VERSION}</Text>
        </View>
      </View>

      <TouchableOpacity activeOpacity={0.88} style={styles.linkRow} onPress={handleShareApp}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <Share2 size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tSettings.shareApp}</Text>
            <Text style={styles.linkSub}>{tSettings.shareAppSub}</Text>
          </View>
        </View>
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={handleRateApp}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: GOLD_SOFT }]}>
            <Star size={18} color="#fcd34d" strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{tSettings.rateApp}</Text>
            <Text style={styles.linkSub}>{tSettings.rateAppSub}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Account ───────────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{tSettings.sectionAccount}</Text>

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
              {isLoggingOut ? tSettings.loggingOut : tSettings.logout}
            </Text>
            <Text style={styles.linkSub}>{tSettings.logoutSub}</Text>
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
              {isDeletingAccount ? tSettings.deleting : tSettings.deleteAccount}
            </Text>
            <Text style={styles.linkSub}>{tSettings.deleteAccountSub}</Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* Footer */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>{tSettings.madeWith}</Text>
        <Text style={styles.footerCopyright}>{tSettings.copyright}</Text>
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
      <View style={{ flex: 1, paddingHorizontal: 0 }}>
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
    marginEnd: 12,
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
    gap: 12,
  },
  toggleTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  toggleSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: BORDER_ARENA,
    marginHorizontal: 12,
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
