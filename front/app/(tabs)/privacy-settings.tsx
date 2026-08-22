/**
 * Privacy Settings Screen
 * 
 * GDPR compliance features with new purple-gradient design:
 * - Data export
 * - Account deletion
 * - Consent management
 * - Privacy policy & terms links
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Switch,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@clerk/clerk-expo';
import {
  Shield,
  Download,
  Trash2,
  ChevronRight,
  FileText,
  BarChart3,
  Bell,
  Mail,
  Share2,
  AlertTriangle,
  XCircle,
} from 'lucide-react-native';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../services/logger';
import { getApiEndpoint } from '../../config/api.config';
import { LEGAL_URLS, openLegalUrl } from '../../config/legal.config';
import { captureException } from '../../services/sentry.service';
import { router } from 'expo-router';
import { MainShell } from '../../components/shell/MainShell';
import {
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_SOFT,
  PURPLE_GLOW_SM,
  PURPLE_PRIMARY,
  SCREEN_PADDING_H,
  GRADIENT_HERO_PURPLE_BLUE,
  BORDER_ARENA,
  RADIUS_LG,
  GOLD_SOFT,
} from '../../constants/tokens';

interface ConsentState {
  analytics: boolean;
  pushNotifications: boolean;
  emailCommunications: boolean;
  dataSharing: boolean;
}

export default function PrivacySettingsScreen() {
  const { getToken } = useAuth();
  const { t } = useTranslation();
  
  const [loading, setLoading] = useState(true);
  const [consent, setConsent] = useState<ConsentState>({
    analytics: true,
    pushNotifications: true,
    emailCommunications: true,
    dataSharing: false,
  });
  const [exportLoading, setExportLoading] = useState(false);
  const [deletionStatus, setDeletionStatus] = useState<any>(null);

  useEffect(() => {
    loadConsentSettings();
    checkDeletionStatus();
  }, []);

  const loadConsentSettings = async () => {
    try {
      setLoading(true);
      const token = await getToken();
      if (!token) throw new Error('Authentication token not found');

      const response = await fetch(getApiEndpoint('gdpr/consent'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok) {
        setConsent(data.consent);
      }
    } catch (error: any) {
      logger.error('[PrivacySettings] Load consent error:', error);
      captureException(error, { tags: { screen: 'PrivacySettings' } });
    } finally {
      setLoading(false);
    }
  };

  const checkDeletionStatus = async () => {
    try {
      const token = await getToken();
      if (!token) return;

      const response = await fetch(getApiEndpoint('gdpr/deletion-status'), {
        headers: { 'Authorization': `Bearer ${token}` },
      });

      const data = await response.json();
      if (response.ok && data.hasDeletionRequest) {
        setDeletionStatus(data.deletionRequest);
      }
    } catch (error: any) {
      logger.error('[PrivacySettings] Check deletion status error:', error);
    }
  };

  const handleConsentChange = async (type: keyof ConsentState, value: boolean) => {
    try {
      setConsent(prev => ({ ...prev, [type]: value }));

      const token = await getToken();
      if (!token) throw new Error('Authentication token not found');

      const consentTypeMap: Record<keyof ConsentState, string> = {
        analytics: 'ANALYTICS',
        pushNotifications: 'PUSH_NOTIFICATIONS',
        emailCommunications: 'EMAIL_COMMUNICATIONS',
        dataSharing: 'DATA_SHARING',
      };

      const response = await fetch(getApiEndpoint('gdpr/consent'), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          consentType: consentTypeMap[type],
          granted: value,
        }),
      });

      if (!response.ok) throw new Error('CONSENT_UPDATE_FAILED');
      logger.info(`[PrivacySettings] Consent updated: ${type} = ${value}`);
    } catch (error: any) {
      setConsent(prev => ({ ...prev, [type]: !value }));
      logger.error('[PrivacySettings] Update consent error:', error);
      captureException(error, { tags: { screen: 'PrivacySettings' } });
      Alert.alert(
        t.common.error,
        t.privacySettings.consentUpdateError
      );
    }
  };

  const handleExportData = async () => {
    Alert.alert(
      t.privacySettings.exportDataTitle,
      t.privacySettings.exportDataMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.privacySettings.exportConfirm,
          onPress: async () => {
            try {
              setExportLoading(true);
              const token = await getToken();
              if (!token) throw new Error('NOT_AUTHENTICATED');

              const response = await fetch(getApiEndpoint('gdpr/export-data'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              const data = await response.json();
              if (!response.ok) throw new Error(data.message || 'EXPORT_REQUEST_FAILED');

              logger.info('[PrivacySettings] Data export requested');
              Alert.alert(
                t.common.success,
                t.privacySettings.exportSuccess
              );
            } catch (error: any) {
              logger.error('[PrivacySettings] Export data error:', error);
              captureException(error, { tags: { screen: 'PrivacySettings' } });
              Alert.alert(
                t.common.error,
                // Safe: only forward backend message if it's a string we showed
                // intentionally; otherwise use the localized fallback.
                t.privacySettings.exportError
              );
            } finally {
              setExportLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleDeleteAccount = () => {
    router.push('/delete-account');
  };

  const handleCancelDeletion = async () => {
    Alert.alert(
      t.privacySettings.cancelDeletionTitle,
      t.privacySettings.cancelDeletionMessage,
      [
        { text: t.common.cancel, style: 'cancel' },
        {
          text: t.privacySettings.cancelDeletionConfirm,
          onPress: async () => {
            try {
              const token = await getToken();
              if (!token) throw new Error('NOT_AUTHENTICATED');

              const response = await fetch(getApiEndpoint('gdpr/cancel-deletion'), {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${token}` },
              });

              if (!response.ok) throw new Error('CANCEL_DELETION_FAILED');

              logger.info('[PrivacySettings] Account deletion cancelled');
              Alert.alert(
                t.common.success,
                t.privacySettings.deletionCancelled
              );
              setDeletionStatus(null);
            } catch (error: any) {
              logger.error('[PrivacySettings] Cancel deletion error:', error);
              captureException(error, { tags: { screen: 'PrivacySettings' } });
              Alert.alert(
                t.common.error,
                t.privacySettings.cancelDeletionError
              );
            }
          },
        },
      ]
    );
  };

  const openPrivacyPolicy = () => {
    void openLegalUrl(LEGAL_URLS.privacy);
  };

  const openTerms = () => {
    void openLegalUrl(LEGAL_URLS.terms);
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={PURPLE_PRIMARY} />
        <Text style={styles.loadingText}>{t.common.loading}</Text>
      </View>
    );
  }

  return (
    <MainShell
      title={t.privacySettings.title}
      subtitle={t.privacySettings.subtitle}
      onBackPress={() => router.back()}
    >
      {/* Hero */}
      <View style={styles.hero}>
        <LinearGradient
          colors={[...GRADIENT_HERO_PURPLE_BLUE]}
          style={StyleSheet.absoluteFill}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
        />
        <Text style={styles.heroEyebrow} numberOfLines={1}>{t.privacySettings.heroEyebrow}</Text>
        <Text style={styles.heroTitle} numberOfLines={1}>{t.privacySettings.title}</Text>
      </View>

      {/* Deletion Warning */}
      {deletionStatus && deletionStatus.status === 'SCHEDULED' && (
        <View style={styles.warningCard}>
          <View style={styles.warningHeader}>
            <AlertTriangle size={20} color="#fbbf24" strokeWidth={2.2} />
            <Text style={styles.warningTitle}>{t.privacySettings.deletionScheduled}</Text>
          </View>
          <Text style={styles.warningText}>
            {t.privacySettings.deletionDate}{' '}
            {new Date(deletionStatus.scheduledAt).toLocaleDateString()}
          </Text>
          <TouchableOpacity style={styles.warningButton} onPress={handleCancelDeletion}>
            <XCircle size={16} color={TEXT_PRIMARY} strokeWidth={2.2} />
            <Text style={styles.warningButtonText}>{t.privacySettings.cancelDeletion}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* ── Consent Management ──────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{t.privacySettings.consentTitle}</Text>

      <View style={styles.switchCard}>
        <ConsentToggle
          icon={<BarChart3 size={18} color="#93c5fd" strokeWidth={2.2} />}
          iconBg="rgba(59,130,246,0.12)"
          label={t.privacySettings.analyticsLabel}
          sub={t.privacySettings.analyticsDescription}
          value={consent.analytics}
          onValueChange={(v) => handleConsentChange('analytics', v)}
        />
        <View style={styles.divider} />
        <ConsentToggle
          icon={<Bell size={18} color={PURPLE_SOFT} strokeWidth={2.2} />}
          iconBg={PURPLE_GLOW_SM}
          label={t.privacySettings.pushLabel}
          sub={t.privacySettings.pushDescription}
          value={consent.pushNotifications}
          onValueChange={(v) => handleConsentChange('pushNotifications', v)}
        />
        <View style={styles.divider} />
        <ConsentToggle
          icon={<Mail size={18} color="#93c5fd" strokeWidth={2.2} />}
          iconBg="rgba(59,130,246,0.12)"
          label={t.privacySettings.emailLabel}
          sub={t.privacySettings.emailDescription}
          value={consent.emailCommunications}
          onValueChange={(v) => handleConsentChange('emailCommunications', v)}
        />
        <View style={styles.divider} />
        <ConsentToggle
          icon={<Share2 size={18} color="#fcd34d" strokeWidth={2.2} />}
          iconBg={GOLD_SOFT}
          label={t.privacySettings.dataSharingLabel}
          sub={t.privacySettings.dataSharingDescription}
          value={consent.dataSharing}
          onValueChange={(v) => handleConsentChange('dataSharing', v)}
        />
      </View>

      {/* ── Data Export ─────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>{t.privacySettings.dataExportTitle}</Text>

      <TouchableOpacity
        activeOpacity={0.88}
        style={styles.linkRow}
        onPress={handleExportData}
        disabled={exportLoading}
      >
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: 'rgba(59,130,246,0.12)' }]}>
            {exportLoading ? (
              <ActivityIndicator size={18} color="#93c5fd" />
            ) : (
              <Download size={18} color="#93c5fd" strokeWidth={2.2} />
            )}
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{t.privacySettings.exportData}</Text>
            <Text style={styles.linkSub}>
              {t.privacySettings.exportDataDescription || t.privacySettings.exportDataDescriptionShort}
            </Text>
          </View>
        </View>
      </TouchableOpacity>

      {/* ── Danger Zone ────────────────────────────────────────────────── */}
      {!deletionStatus && (
        <>
          <Text style={styles.sectionLabel}>{t.privacySettings.dangerZone}</Text>

          <TouchableOpacity
            activeOpacity={0.88}
            style={styles.linkRow}
            onPress={handleDeleteAccount}
          >
            <View style={styles.linkLeft}>
              <View style={[styles.linkIcon, { backgroundColor: 'rgba(239,68,68,0.12)' }]}>
                <Trash2 size={18} color="#ef4444" strokeWidth={2.2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[styles.linkTitle, { color: '#fca5a5' }]}>
                  {t.privacySettings.deleteAccount}
                </Text>
                <Text style={styles.linkSub}>
                  {t.privacySettings.deleteAccountDescription || t.privacySettings.deleteAccountDescriptionShort}
                </Text>
              </View>
            </View>
            <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
          </TouchableOpacity>
        </>
      )}

      {/* ── Legal Links ────────────────────────────────────────────────── */}
      <Text style={styles.sectionLabel}>Legal</Text>

      <TouchableOpacity activeOpacity={0.88} style={styles.linkRow} onPress={openPrivacyPolicy}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <Shield size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{t.privacySettings.privacyPolicy}</Text>
            <Text style={styles.linkSub}>{t.privacySettings.privacyPolicySub}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>

      <TouchableOpacity activeOpacity={0.88} style={[styles.linkRow, { marginTop: 8 }]} onPress={openTerms}>
        <View style={styles.linkLeft}>
          <View style={[styles.linkIcon, { backgroundColor: PURPLE_GLOW_SM }]}>
            <FileText size={18} color={PURPLE_SOFT} strokeWidth={2.2} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.linkTitle}>{t.privacySettings.terms}</Text>
            <Text style={styles.linkSub}>{t.privacySettings.termsSub}</Text>
          </View>
        </View>
        <ChevronRight color={TEXT_MUTED} size={20} strokeWidth={2} />
      </TouchableOpacity>
    </MainShell>
  );
}

// ── ConsentToggle ─────────────────────────────────────────────────────────────

function ConsentToggle({
  icon,
  iconBg,
  label,
  sub,
  value,
  onValueChange,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  sub: string;
  value: boolean;
  onValueChange: (v: boolean) => void;
}) {
  return (
    <View style={styles.consentRow}>
      <View style={[styles.linkIcon, { backgroundColor: iconBg }]}>{icon}</View>
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
  consentRow: {
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
    marginHorizontal: 12,
  },

  warningCard: {
    borderRadius: RADIUS_LG,
    borderWidth: 1,
    borderColor: 'rgba(251,191,36,0.35)',
    backgroundColor: 'rgba(251,191,36,0.08)',
    padding: 16,
    marginBottom: 22,
  },
  warningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 8,
  },
  warningTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fbbf24',
  },
  warningText: {
    fontSize: 13,
    color: '#fcd34d',
    marginBottom: 12,
    lineHeight: 18,
  },
  warningButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(124,58,237,0.55)',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  warningButtonText: {
    fontSize: 13,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
});
