/**
 * Settings Screen - 90Plus
 *
 * Fully localized: every user-facing string comes from front/locales/*.ts
 * via the i18n hook. Layout stays LTR for all languages; only copy changes.
 */

import React, { useState, useEffect, useCallback, type ReactNode } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  StatusBar,
  Platform,
  Linking,
  ActivityIndicator,
  InteractionManager,
} from 'react-native';
import {
  Bell,
  Inbox,
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
import { useAuth } from '@clerk/clerk-expo';
import { useQueryClient } from '@tanstack/react-query';
import AsyncStorage from '@react-native-async-storage/async-storage';
import LanguagePickerModal from '../../components/common/LanguagePickerModal';
import { useTranslation, getLanguageInfo, Language } from '../../src/i18n';
import ImprovedAccountDeletionModal from '../../components/common/ImprovedAccountDeletionModal';
import { AccountDeletionService } from '../../services/accountDeletionService';
import { LEGAL_URLS, openLegalUrl } from '../../config/legal.config';
import { toastManager } from '../../services/toastManager';
import { useScreenFont } from '../../utils/fontSetup';
import { MainShell } from '../../components/shell/MainShell';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_SOFT,
  PURPLE_GLOW_SM,
  BORDER_ARENA,
  RADIUS_LG,
  PURPLE_PRIMARY,
  GOLD_SOFT,
} from '../../constants/tokens';
import { openAppStoreForRating } from '../../constants/shareLinks';
import { useAppShareReward } from '../../hooks/useAppShareReward';
import { getAppVersionLabel } from '../../services/appVersionService';
import { getOsNotificationPermissionStatus } from '../../services/pushTokenRegistration.service';
import { canMakeAuthenticatedRequests } from '../../utils/clerkAuthToken';
import {
  fetchNotificationPreferences,
  NOTIFICATION_PREFS_QUERY_KEY,
} from '../../components/notifications/notificationPreferencesApi';

const CACHE_SIZE_SCAN_LIMIT = 80;

export default function SettingsScreen() {
  useScreenFont();

  const { clearVideos } = useVideos();
  const { clearCache } = useSettings();

  const router = useRouter();
  const queryClient = useQueryClient();
  const { signOut, getToken, isLoaded, isSignedIn } = useAuth();

  const { t, language, setLanguage } = useTranslation();
  const tSettings = t.settingsScreen;
  const tCommon = t.common;
  const appVersion = getAppVersionLabel();

  const [cacheSize, setCacheSize] = useState<string | null>(null);
  const [osPushGranted, setOsPushGranted] = useState<boolean | null>(null);
  const [languageModalVisible, setLanguageModalVisible] = useState(false);
  const [deletionModalVisible, setDeletionModalVisible] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const [isChangingLanguage, setIsChangingLanguage] = useState(false);
  const [isDeletingAccount, setIsDeletingAccount] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const task = InteractionManager.runAfterInteractions(() => {
      void (async () => {
        try {
          const keys = await AsyncStorage.getAllKeys();
          if (cancelled) return;
          if (keys.length > CACHE_SIZE_SCAN_LIMIT) {
            setCacheSize(null);
            return;
          }
          const values = await AsyncStorage.multiGet(keys);
          if (cancelled) return;
          let totalSize = 0;
          values.forEach(([, value]) => {
            if (value) totalSize += value.length * 2;
          });
          setCacheSize(`${(totalSize / (1024 * 1024)).toFixed(1)} MB`);
        } catch {
          if (!cancelled) setCacheSize('0 MB');
        }
      })();
    });
    return () => {
      cancelled = true;
      task.cancel();
    };
  }, []);

  useEffect(() => {
    const task = InteractionManager.runAfterInteractions(() => {
      void getOsNotificationPermissionStatus().then((status) => {
        if (status === 'unavailable') {
          setOsPushGranted(null);
          return;
        }
        setOsPushGranted(status === 'granted');
      });
    });
    return () => task.cancel();
  }, []);

  useEffect(() => {
    if (!canMakeAuthenticatedRequests(isLoaded, isSignedIn === true)) return;
    void queryClient.prefetchQuery({
      queryKey: NOTIFICATION_PREFS_QUERY_KEY,
      queryFn: () => fetchNotificationPreferences(getToken),
      staleTime: 60_000,
    });
  }, [queryClient, getToken, isLoaded, isSignedIn]);

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
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      const { websocketClient } = await import('../../services/websocketClient');
      const { performFastLogout } = await import('../../utils/logoutSession');

      await performFastLogout({
        signOut,
        clearVideos,
        disconnectWebSocket: () => websocketClient.disconnect(),
      });

      router.replace('/auth/login');
      toastManager.showSuccess(tSettings.logoutSuccess, tSettings.logoutSuccessDetail);
    } catch {
      router.replace('/auth/login');
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

      const { websocketClient } = await import('../../services/websocketClient');
      const { performFastLogout } = await import('../../utils/logoutSession');
      await performFastLogout({
        signOut,
        clearVideos,
        disconnectWebSocket: () => websocketClient.disconnect(),
      });

      router.replace('/auth/login');
      toastManager.showSuccess(tSettings.deleteAccountSuccess, tSettings.deleteAccountSuccessDetail);
    } catch {
      toastManager.showError(tSettings.deleteAccountFailed, tSettings.deleteAccountFailedDetail);
    } finally {
      setIsDeletingAccount(false);
      setDeletionModalVisible(false);
    }
  };

  const handleRateApp = async () => {
    const opened = await openAppStoreForRating();
    if (!opened) {
      toastManager.showInfo(tSettings.rateThanks, tSettings.rateThanksDetail);
    }
  };

  const { shareAppAndClaim } = useAppShareReward();

  const handleShareApp = async () => {
    await shareAppAndClaim(language === 'en' ? 'en' : 'ar');
  };

  const handleContactUs = () => {
    void openLegalUrl(LEGAL_URLS.support);
  };

  const handlePrivacyPolicy = () => {
    void openLegalUrl(LEGAL_URLS.privacy);
  };

  const handleTerms = () => {
    void openLegalUrl(LEGAL_URLS.terms);
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

  const goToProfile = useCallback(() => {
    router.replace('/(tabs)/profile');
  }, [router]);

  const cacheSizeLabel = cacheSize ?? tSettings.cacheSizePending ?? '…';

  return (
    <MainShell
      title={tSettings.title}
      subtitle={tSettings.subtitle}
      onBackPress={goToProfile}
      backLabel={tSettings.backToProfile ?? tCommon.back ?? tCommon.close}
      backTestID="settings-back"
    >
      <StatusBar barStyle="light-content" backgroundColor="#000" />

      {osPushGranted === false ? (
        <TouchableOpacity
          activeOpacity={0.88}
          style={styles.warnBanner}
          onPress={handleManagePermissions}
          accessibilityRole="button"
        >
          <Text style={styles.warnTitle}>{tSettings.osPushDenied}</Text>
          <Text style={styles.warnSub}>{tSettings.osPushDeniedSub}</Text>
          <Text style={styles.warnCta}>{tSettings.osPushOpenSettings}</Text>
        </TouchableOpacity>
      ) : null}

      <SettingsGroup label={tSettings.sectionNotifications}>
        <SettingsRow
          icon={<Bell size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          title={tSettings.notificationPreferences}
          sub={tSettings.notificationPreferencesSub}
          onPress={() => router.push('/notification-preferences')}
        />
        <SettingsRow
          icon={<Inbox size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          title={tSettings.notificationInbox}
          sub={tSettings.notificationInboxSub}
          onPress={() => router.push('/notifications')}
          last
        />
      </SettingsGroup>

      <SettingsGroup label={tSettings.sectionPreferences}>
        <SettingsRow
          icon={<Globe size={18} color="#93c5fd" strokeWidth={2.2} />}
          iconBg="rgba(59,130,246,0.12)"
          title={tSettings.language}
          sub={getLanguageName(language)}
          onPress={() => setLanguageModalVisible(true)}
          disabled={isChangingLanguage}
          last
        />
      </SettingsGroup>

      <SettingsGroup label={tSettings.sectionData}>
        <SettingsRow
          icon={<Trash2 size={18} color="#fca5a5" strokeWidth={2.2} />}
          iconBg="rgba(239,68,68,0.12)"
          title={tSettings.clearCache}
          sub={tSettings.currentSize.replace('{size}', cacheSizeLabel)}
          onPress={handleClearCache}
        />
        <SettingsRow
          icon={<Shield size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          title={tSettings.managePermissions}
          sub={tSettings.managePermissionsSub}
          onPress={handleManagePermissions}
        />
        <SettingsRow
          icon={<Ban size={18} color="#fcd34d" strokeWidth={2.2} />}
          iconBg="rgba(245,197,24,0.12)"
          title={tSettings.blockedUsers}
          sub={tSettings.blockedUsersSub}
          onPress={() => router.push('/settings/blocked-users' as any)}
          last
        />
      </SettingsGroup>

      <SettingsGroup label={tSettings.sectionSupport}>
        <SettingsRow
          icon={<Mail size={18} color="#93c5fd" strokeWidth={2.2} />}
          iconBg="rgba(59,130,246,0.12)"
          title={tSettings.contactUs}
          sub={tSettings.contactUsSub}
          onPress={handleContactUs}
        />
        <SettingsRow
          icon={<FileText size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          title={tSettings.privacyPolicy}
          sub={tSettings.privacyPolicySub}
          onPress={handlePrivacyPolicy}
        />
        <SettingsRow
          icon={<FileText size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          title={tSettings.termsConditions}
          sub={tSettings.termsConditionsSub}
          onPress={handleTerms}
          last
        />
      </SettingsGroup>

      <SettingsGroup label={tSettings.sectionAbout}>
        <SettingsRow
          icon={null}
          title={tSettings.version}
          trailing={<Text style={styles.infoValue}>{appVersion}</Text>}
          testID="settings-app-version"
        />
        <SettingsRow
          icon={<Share2 size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          title={tSettings.shareApp}
          sub={tSettings.shareAppSub}
          onPress={handleShareApp}
        />
        <SettingsRow
          icon={<Star size={18} color="#fcd34d" strokeWidth={2.2} />}
          iconBg={GOLD_SOFT}
          title={tSettings.rateApp}
          sub={tSettings.rateAppSub}
          onPress={handleRateApp}
          last
        />
      </SettingsGroup>

      <SettingsGroup label={tSettings.sectionAccount}>
        <SettingsRow
          icon={
            isLoggingOut ? (
              <ActivityIndicator size={18} color="#fca5a5" />
            ) : (
              <LogOut size={18} color="#fca5a5" strokeWidth={2.2} />
            )
          }
          iconBg="rgba(239,68,68,0.12)"
          title={isLoggingOut ? tSettings.loggingOut : tSettings.logout}
          sub={tSettings.logoutSub}
          titleColor="#fca5a5"
          onPress={handleLogout}
          disabled={isLoggingOut}
        />
        <SettingsRow
          icon={
            isDeletingAccount ? (
              <ActivityIndicator size={18} color="#ef4444" />
            ) : (
              <UserX size={18} color="#ef4444" strokeWidth={2.2} />
            )
          }
          iconBg="rgba(239,68,68,0.12)"
          title={isDeletingAccount ? tSettings.deleting : tSettings.deleteAccount}
          sub={tSettings.deleteAccountSub}
          titleColor="#ef4444"
          onPress={handleDeleteAccount}
          disabled={isDeletingAccount}
          last
        />
      </SettingsGroup>

      <View style={styles.footer}>
        <Text style={styles.footerText}>{tSettings.madeWith}</Text>
        <Text style={styles.footerCopyright}>{tSettings.copyright}</Text>
      </View>

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

function SettingsGroup({ label, children }: { label: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.card}>{children}</View>
    </View>
  );
}

function SettingsRow({
  icon,
  iconBg,
  title,
  sub,
  onPress,
  trailing,
  last,
  disabled,
  titleColor,
  testID,
}: {
  icon: ReactNode;
  iconBg?: string;
  title: string;
  sub?: string;
  onPress?: () => void;
  trailing?: ReactNode;
  last?: boolean;
  disabled?: boolean;
  titleColor?: string;
  testID?: string;
}) {
  const content = (
    <View style={[styles.row, !last && styles.rowDivider]}>
      <View style={styles.linkLeft}>
        {icon ? (
          <View style={[styles.linkIcon, { backgroundColor: iconBg ?? PURPLE_GLOW_SM }]}>
            {icon}
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[styles.linkTitle, titleColor ? { color: titleColor } : null]}>{title}</Text>
          {sub ? <Text style={styles.linkSub}>{sub}</Text> : null}
        </View>
      </View>
      {trailing ?? (onPress ? <ChevronRight color={TEXT_MUTED} size={18} strokeWidth={2} /> : null)}
    </View>
  );

  if (!onPress) {
    return (
      <View testID={testID} accessibilityLabel={title}>
        {content}
      </View>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onPress}
      disabled={disabled}
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={title}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  group: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 12,
    fontWeight: '800',
    color: TEXT_MUTED,
    letterSpacing: 0.7,
    textTransform: 'uppercase',
    marginBottom: 8,
    marginStart: 4,
  },
  card: {
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
    backgroundColor: 'rgba(255,255,255,0.045)',
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 12,
    minHeight: 56,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  linkLeft: { flexDirection: 'row', alignItems: 'center', flex: 1, paddingEnd: 8 },
  linkIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    marginEnd: 12,
  },
  linkTitle: { fontSize: 15, fontWeight: '700', color: TEXT_PRIMARY },
  linkSub: { marginTop: 2, fontSize: 12, color: TEXT_MUTED, lineHeight: 16 },
  infoValue: { fontSize: 14, fontWeight: '700', color: TEXT_PRIMARY },
  warnBanner: {
    marginBottom: 18,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: RADIUS_LG,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(239,68,68,0.35)',
    backgroundColor: 'rgba(239,68,68,0.1)',
  },
  warnTitle: { fontSize: 14, fontWeight: '800', color: TEXT_PRIMARY },
  warnSub: { marginTop: 4, fontSize: 12, color: TEXT_MUTED, lineHeight: 16 },
  warnCta: { marginTop: 8, fontSize: 13, fontWeight: '700', color: PURPLE_PRIMARY },
  footer: {
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 16,
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
