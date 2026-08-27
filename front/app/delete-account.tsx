/**
 * Delete Account Screen — profile-aligned purple glass UI
 */

import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../src/i18n';
import { logger } from '../services/logger';
import { getApiEndpoint } from '../config/api.config';
import { captureException } from '../services/sentry.service';
import { cacheService } from '../services/cacheService';
import { predictionsMapKey, predictionsTicketsKey } from '../services/predictionsCacheKeys';
import { ProfileTheme } from '../constants/ProfileTheme';
import {
  APP_BG,
  ACCENT,
  GlassWrapper,
  glassProps,
  SURFACE_BG,
} from '../constants/ui';

type ReasonId =
  | 'privacy'
  | 'not_useful'
  | 'too_many_notifications'
  | 'found_alternative'
  | 'temporary_break'
  | 'other';

const DELETE_ITEMS: Array<{ icon: keyof typeof Ionicons.glyphMap; key: 'profile' | 'videos' | 'achievements' | 'social' | 'interactions' }> = [
  { icon: 'person-outline', key: 'profile' },
  { icon: 'videocam-outline', key: 'videos' },
  { icon: 'trophy-outline', key: 'achievements' },
  { icon: 'people-outline', key: 'social' },
  { icon: 'chatbubbles-outline', key: 'interactions' },
];

export default function DeleteAccountScreen() {
  const { getToken, signOut, userId } = useAuth();
  const { t, isRTL } = useTranslation();
  const d = t.deleteAccount;

  const [selectedReason, setSelectedReason] = useState<ReasonId | null>(null);
  const [otherReason, setOtherReason] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [loading, setLoading] = useState(false);

  const reasons = useMemo(
    () =>
      [
        { id: 'privacy' as const, label: d.reasons.privacy },
        { id: 'not_useful' as const, label: d.reasons.notUseful },
        { id: 'too_many_notifications' as const, label: d.reasons.tooManyNotifications },
        { id: 'found_alternative' as const, label: d.reasons.foundAlternative },
        { id: 'temporary_break' as const, label: d.reasons.temporaryBreak },
        { id: 'other' as const, label: d.reasons.other },
      ] as const,
    [d.reasons],
  );

  const handleDeleteAccount = async () => {
    if (!agreed) {
      Alert.alert(t.common.warning || 'Warning', d.mustAgree);
      return;
    }

    Alert.alert(d.finalConfirmTitle, d.finalConfirmMessage, [
      { text: t.common.cancel, style: 'cancel' },
      {
        text: d.confirmDelete,
        style: 'destructive',
        onPress: async () => {
          try {
            setLoading(true);
            const token = await getToken();
            if (!token) throw new Error('Authentication token not found');

            const reason =
              selectedReason === 'other'
                ? otherReason.trim() || 'other'
                : selectedReason || 'unspecified';

            const response = await fetch(getApiEndpoint('gdpr/delete-account'), {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ reason }),
            });

            const data = await response.json();
            if (!response.ok) {
              throw new Error(data.message || 'Failed to delete account');
            }

            logger.info('[DeleteAccount] Account deletion requested');

            Alert.alert(t.common.success || 'Success', d.deletionScheduled, [
              {
                text: t.common.done || 'Done',
                onPress: async () => {
                  if (userId) {
                    await Promise.all([
                      cacheService.invalidate(predictionsMapKey(userId)),
                      cacheService.invalidate(predictionsTicketsKey(userId)),
                    ]).catch(() => {});
                  }
                  signOut();
                  router.replace('/');
                },
              },
            ]);
          } catch (error: any) {
            logger.error('[DeleteAccount] Deletion error:', error);
            captureException(error, { tags: { screen: 'DeleteAccount' } });
            Alert.alert(t.common.error || 'Error', error.message || d.deletionError);
          } finally {
            setLoading(false);
          }
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#12081F', APP_BG, '#05010D']}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={[styles.header, isRTL && styles.rowRtl]}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            accessibilityRole="button"
          >
            <Ionicons
              name={isRTL ? 'arrow-forward' : 'arrow-back'}
              size={22}
              color="#fff"
            />
          </TouchableOpacity>
          <Text style={[styles.headerTitle, isRTL && styles.textRtl]}>{d.title}</Text>
          <View style={styles.headerSpacer} />
        </View>

        <View style={styles.warningBox}>
          <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
          <View style={styles.warningIconWrap}>
            <Ionicons name="warning" size={28} color="#FF6B6B" />
          </View>
          <Text style={[styles.warningTitle, isRTL && styles.textRtl]}>{d.warningTitle}</Text>
          <Text style={[styles.warningText, isRTL && styles.textRtl]}>{d.warningMessage}</Text>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRtl]}>
            {d.whatWillBeDeleted}
          </Text>
          {DELETE_ITEMS.map((item) => (
            <View key={item.key} style={[styles.deleteItem, isRTL && styles.rowRtl]}>
              <View style={styles.deleteIconWrap}>
                <Ionicons name={item.icon} size={18} color="#FF6B6B" />
              </View>
              <Text style={[styles.deleteItemText, isRTL && styles.textRtl]}>
                {d[item.key]}
              </Text>
            </View>
          ))}
        </View>

        <View style={[styles.infoBox, isRTL && styles.rowRtl]}>
          <GlassWrapper {...(glassProps.card as any)} style={StyleSheet.absoluteFill} />
          <View style={styles.infoIconWrap}>
            <Ionicons name="time-outline" size={20} color={ProfileTheme.colors.avatarRing} />
          </View>
          <View style={styles.infoContent}>
            <Text style={[styles.infoTitle, isRTL && styles.textRtl]}>{d.gracePeriodTitle}</Text>
            <Text style={[styles.infoText, isRTL && styles.textRtl]}>{d.gracePeriodMessage}</Text>
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionTitle, isRTL && styles.textRtl]}>{d.reasonTitle}</Text>
          {reasons.map((reason) => {
            const selected = selectedReason === reason.id;
            return (
              <TouchableOpacity
                key={reason.id}
                style={[
                  styles.reasonButton,
                  isRTL && styles.rowRtl,
                  selected && styles.reasonButtonSelected,
                ]}
                onPress={() => setSelectedReason(reason.id)}
                activeOpacity={0.85}
              >
                <View style={[styles.radioButton, selected && styles.radioButtonSelected]}>
                  {selected ? <View style={styles.radioButtonInner} /> : null}
                </View>
                <Text style={[styles.reasonText, isRTL && styles.textRtl]}>{reason.label}</Text>
              </TouchableOpacity>
            );
          })}

          {selectedReason === 'other' ? (
            <TextInput
              style={[styles.otherReasonInput, isRTL && styles.textRtl]}
              placeholder={d.otherReasonPlaceholder}
              placeholderTextColor="rgba(255,255,255,0.35)"
              value={otherReason}
              onChangeText={setOtherReason}
              multiline
              numberOfLines={3}
            />
          ) : null}
        </View>

        <TouchableOpacity
          style={[styles.agreementContainer, isRTL && styles.rowRtl]}
          onPress={() => setAgreed(!agreed)}
          activeOpacity={0.85}
        >
          <View style={[styles.checkbox, agreed && styles.checkboxChecked]}>
            {agreed ? <Ionicons name="checkmark" size={14} color="#fff" /> : null}
          </View>
          <Text style={[styles.agreementText, isRTL && styles.textRtl]}>{d.agreement}</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.deleteButtonWrap, (!agreed || loading) && styles.deleteButtonDisabled]}
          onPress={handleDeleteAccount}
          disabled={!agreed || loading}
          activeOpacity={0.88}
        >
          <LinearGradient
            colors={agreed && !loading ? ['#EF4444', '#B91C1C'] : ['#2A2438', '#1A1524']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.deleteButton}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Ionicons name="trash-outline" size={20} color="#fff" />
                <Text style={styles.deleteButtonText}>{d.deleteButton}</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>

        <TouchableOpacity style={styles.cancelButton} onPress={() => router.back()}>
          <Text style={styles.cancelButtonText}>{t.common.cancel}</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: APP_BG,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 28,
    paddingTop: 8,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 12,
  },
  rowRtl: {
    flexDirection: 'row-reverse',
  },
  textRtl: {
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.3)',
  },
  headerTitle: {
    flex: 1,
    fontSize: 20,
    fontWeight: '800',
    color: '#fff',
  },
  headerSpacer: {
    width: 40,
  },
  warningBox: {
    borderRadius: 18,
    padding: 18,
    alignItems: 'center',
    marginBottom: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(239,68,68,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.28)',
  },
  warningIconWrap: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderWidth: 1,
    borderColor: 'rgba(239,68,68,0.35)',
    marginBottom: 12,
  },
  warningTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: '#FFB4B4',
    marginBottom: 6,
  },
  warningText: {
    fontSize: 13,
    color: 'rgba(255,180,180,0.9)',
    textAlign: 'center',
    lineHeight: 19,
  },
  section: {
    marginBottom: 22,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: ProfileTheme.colors.avatarRing,
    marginBottom: 10,
    letterSpacing: 0.3,
  },
  deleteItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(139,92,246,0.06)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
  },
  deleteIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(239,68,68,0.12)',
  },
  deleteItemText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
    fontWeight: '500',
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    borderRadius: 16,
    padding: 14,
    marginBottom: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(139,92,246,0.1)',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
  },
  infoIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(139,92,246,0.18)',
  },
  infoContent: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: ProfileTheme.colors.avatarRing,
    marginBottom: 4,
  },
  infoText: {
    fontSize: 13,
    color: 'rgba(216,174,255,0.85)',
    lineHeight: 19,
  },
  reasonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: 'rgba(44,39,55,0.35)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
  },
  reasonButtonSelected: {
    backgroundColor: 'rgba(139,92,246,0.14)',
    borderColor: 'rgba(168,85,247,0.55)',
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioButtonSelected: {
    borderColor: ACCENT,
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: ACCENT,
  },
  reasonText: {
    flex: 1,
    fontSize: 14,
    color: 'rgba(255,255,255,0.88)',
  },
  otherReasonInput: {
    backgroundColor: SURFACE_BG,
    borderRadius: 12,
    padding: 12,
    color: '#fff',
    fontSize: 14,
    marginTop: 4,
    minHeight: 84,
    textAlignVertical: 'top',
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.28)',
  },
  agreementContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 20,
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.06)',
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 1.5,
    borderColor: 'rgba(168,85,247,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 1,
    backgroundColor: 'rgba(8,2,21,0.4)',
  },
  checkboxChecked: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
  },
  agreementText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.78)',
    flex: 1,
    lineHeight: 19,
  },
  deleteButtonWrap: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 10,
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    height: 50,
    borderRadius: 14,
  },
  deleteButtonDisabled: {
    opacity: 0.55,
  },
  deleteButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#fff',
  },
  cancelButton: {
    alignItems: 'center',
    paddingVertical: 14,
  },
  cancelButtonText: {
    fontSize: 15,
    color: 'rgba(255,255,255,0.45)',
    fontWeight: '500',
  },
});
