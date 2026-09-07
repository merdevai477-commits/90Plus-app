import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Switch,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../services/logger';
import { canMakeAuthenticatedRequests } from '../../utils/clerkAuthToken';
import {
  BG_BASE,
  TEXT_PRIMARY,
  TEXT_MUTED,
  PURPLE_SOFT,
  BORDER_ARENA,
  RADIUS_LG,
} from '../../constants/tokens';
import {
  DEFAULT_NOTIFICATION_PREFS,
  NOTIFICATION_PREFS_QUERY_KEY,
  fetchNotificationPreferences,
  updateNotificationPreferences,
  type NotificationPreferences,
} from './notificationPreferencesApi';

interface SwitchRowProps {
  label: string;
  subtitle: string;
  value: boolean;
  field: keyof NotificationPreferences;
  onToggle: (field: keyof NotificationPreferences, value: boolean) => void;
}

function SwitchRow({ label, subtitle, value, field, onToggle }: SwitchRowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowText}>
        <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={(v) => onToggle(field, v)}
        trackColor={{ false: 'rgba(255,255,255,0.12)', true: 'rgba(124,58,237,0.55)' }}
        thumbColor={value ? '#f4f4f5' : 'rgba(255,255,255,0.35)'}
        ios_backgroundColor="rgba(255,255,255,0.12)"
        accessibilityLabel={label}
      />
    </View>
  );
}

function SectionHeader({ title, icon }: { title: string; icon: keyof typeof Ionicons.glyphMap }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon} size={16} color={PURPLE_SOFT} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

export default function NotificationPreferencesScreen() {
  const { getToken, isLoaded, isSignedIn } = useAuth();
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const [pendingField, setPendingField] = useState<keyof NotificationPreferences | null>(null);

  const authed = canMakeAuthenticatedRequests(isLoaded, isSignedIn === true);

  const { data: prefs } = useQuery({
    queryKey: NOTIFICATION_PREFS_QUERY_KEY,
    queryFn: () => fetchNotificationPreferences(getToken),
    enabled: authed,
    placeholderData: DEFAULT_NOTIFICATION_PREFS,
    staleTime: 60_000,
  });

  const mutation = useMutation({
    mutationFn: (updates: Partial<NotificationPreferences>) =>
      updateNotificationPreferences(getToken, updates),
    onMutate: async (updates) => {
      await queryClient.cancelQueries({ queryKey: NOTIFICATION_PREFS_QUERY_KEY });
      const previous = queryClient.getQueryData<NotificationPreferences>(NOTIFICATION_PREFS_QUERY_KEY);
      queryClient.setQueryData<NotificationPreferences>(NOTIFICATION_PREFS_QUERY_KEY, (old) => ({
        ...(old || DEFAULT_NOTIFICATION_PREFS),
        ...updates,
      }));
      return { previous };
    },
    onError: (err, _updates, context) => {
      if (context?.previous) {
        queryClient.setQueryData(NOTIFICATION_PREFS_QUERY_KEY, context.previous);
      }
      logger.error('Failed to update notification preferences:', err);
      Alert.alert(t.common.error, t.notifications.prefUpdateError);
    },
    onSettled: () => {
      setPendingField(null);
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_PREFS_QUERY_KEY });
    },
  });

  const handleToggle = useCallback((field: keyof NotificationPreferences, value: boolean) => {
    if (pendingField) return;
    setPendingField(field);
    mutation.mutate({ [field]: value });
  }, [mutation, pendingField]);

  const goBack = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(tabs)/settings');
  }, [router]);

  const current = prefs || DEFAULT_NOTIFICATION_PREFS;
  const tn = t.notifications;

  return (
    <View style={styles.container}>
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 12) }]}>
        <TouchableOpacity
          onPress={goBack}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={tn.a11yBack}
          testID="notif-prefs-back"
          style={styles.backBtn}
        >
          <Ionicons name="chevron-back" size={24} color={TEXT_PRIMARY} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{tn.preferencesTitle}</Text>
        <View style={styles.headerSpacer} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.hint}>{tn.prefScreenHint}</Text>

        <View style={styles.section}>
          <SectionHeader title={tn.sectionMatch} icon="football-outline" />
          <View style={styles.card}>
            <SwitchRow label={tn.prefMatchStart} subtitle={tn.prefMatchStartSub} value={current.matchStart} field="matchStart" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMatchGoals} subtitle={tn.prefMatchGoalsSub} value={current.matchGoals} field="matchGoals" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefHalftime} subtitle={tn.prefHalftimeSub} value={current.matchHalftime} field="matchHalftime" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMatchCards} subtitle={tn.prefMatchCardsSub} value={current.matchCards} field="matchCards" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMatchVar} subtitle={tn.prefMatchVarSub} value={current.matchVar} field="matchVar" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMatchSubs} subtitle={tn.prefMatchSubsSub} value={current.matchSubs} field="matchSubs" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMatchLineups} subtitle={tn.prefMatchLineupsSub} value={current.matchLineups} field="matchLineups" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMatchEnd} subtitle={tn.prefMatchEndSub} value={current.matchEnd} field="matchEnd" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefLeague} subtitle={tn.prefLeagueSub} value={current.leagueMatches} field="leagueMatches" onToggle={handleToggle} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={tn.sectionSocial} icon="people-outline" />
          <View style={styles.card}>
            <SwitchRow label={tn.prefFollow} subtitle={tn.prefFollowSub} value={current.socialFollow} field="socialFollow" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefLike} subtitle={tn.prefLikeSub} value={current.socialLike} field="socialLike" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefComment} subtitle={tn.prefCommentSub} value={current.socialComment} field="socialComment" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefReply} subtitle={tn.prefReplySub} value={current.socialReply} field="socialReply" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefMention} subtitle={tn.prefMentionSub} value={current.socialMention} field="socialMention" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefShare} subtitle={tn.prefShareSub} value={current.socialShare} field="socialShare" onToggle={handleToggle} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={tn.sectionGeneral} icon="gift-outline" />
          <View style={styles.card}>
            <SwitchRow label={tn.prefPrediction} subtitle={tn.prefPredictionSub} value={current.predictionResults} field="predictionResults" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefLuckyWheel} subtitle={tn.prefLuckyWheelSub} value={current.luckyWheel} field="luckyWheel" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefGifts} subtitle={tn.prefGiftsSub} value={current.gifts} field="gifts" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefDailyQuiz} subtitle={tn.prefDailyQuizSub} value={current.dailyQuiz} field="dailyQuiz" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefCooldown} subtitle={tn.prefCooldownSub} value={current.cooldown} field="cooldown" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefLevelUp} subtitle={tn.prefLevelUpSub} value={current.levelUp} field="levelUp" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefLeaderboard} subtitle={tn.prefLeaderboardSub} value={current.leaderboard} field="leaderboard" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefReportUpdates} subtitle={tn.prefReportUpdatesSub} value={current.reportUpdates} field="reportUpdates" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefAvatarUpload} subtitle={tn.prefAvatarUploadSub} value={current.avatarUpload} field="avatarUpload" onToggle={handleToggle} />
            <View style={styles.divider} />
            <SwitchRow label={tn.prefVideoProcessed} subtitle={tn.prefVideoProcessedSub} value={current.videoProcessed} field="videoProcessed" onToggle={handleToggle} />
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeader title={tn.sectionAi} icon="sparkles-outline" />
          <View style={styles.card}>
            <SwitchRow label={tn.prefAiCoach} subtitle={tn.prefAiCoachSub} value={current.aiCoach} field="aiCoach" onToggle={handleToggle} />
          </View>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: BG_BASE },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: BORDER_ARENA,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerTitle: {
    flex: 1,
    textAlign: 'center',
    fontSize: 17,
    fontWeight: '700',
    color: TEXT_PRIMARY,
  },
  headerSpacer: { width: 44 },
  content: { padding: 16, paddingBottom: 48 },
  hint: {
    fontSize: 13,
    color: TEXT_MUTED,
    lineHeight: 18,
    marginBottom: 20,
  },
  section: { marginBottom: 22 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 8, marginStart: 4 },
  sectionTitle: { fontSize: 13, fontWeight: '800', color: PURPLE_SOFT, letterSpacing: 0.4 },
  card: {
    backgroundColor: 'rgba(255,255,255,0.045)',
    borderRadius: RADIUS_LG,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: BORDER_ARENA,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 58,
  },
  rowText: { flex: 1, marginEnd: 12 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: TEXT_PRIMARY, marginBottom: 2 },
  rowSubtitle: { fontSize: 12, color: TEXT_MUTED, lineHeight: 16 },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(255,255,255,0.06)', marginHorizontal: 14 },
});
