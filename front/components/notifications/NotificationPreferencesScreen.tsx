import React, { useCallback, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    Switch,
    ActivityIndicator,
    Alert,
} from 'react-native';
import { Stack } from 'expo-router';
import { useAuth } from '@clerk/clerk-expo';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { COLORS } from '../reels/constants';
import { getApiUrl } from '../../config/api.config';
import { useTranslation } from '../../src/i18n';
import { logger } from '../../services/logger';

interface NotificationPreferences {
    matchGoals: boolean;
    matchStart: boolean;
    matchEnd: boolean;
    matchHalftime: boolean;
    leagueMatches: boolean;
    socialFollow: boolean;
    socialLike: boolean;
    socialComment: boolean;
    socialReply: boolean;
    socialMention: boolean;
    predictionResults: boolean;
    luckyWheel: boolean;
    gifts: boolean;
}

const DEFAULT_PREFS: NotificationPreferences = {
    matchGoals: true,
    matchStart: true,
    matchEnd: true,
    matchHalftime: true,
    leagueMatches: true,
    socialFollow: true,
    socialLike: true,
    socialComment: true,
    socialReply: true,
    socialMention: true,
    predictionResults: true,
    luckyWheel: true,
    gifts: true,
};

async function fetchPreferences(token: string): Promise<NotificationPreferences> {
    const res = await fetch(`${getApiUrl()}/notifications/preferences`, {
        headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error('NOTIF_PREFS_FETCH_FAILED');
    const data = await res.json();
    return data.data.preferences;
}

async function updatePreferences(token: string, updates: Partial<NotificationPreferences>): Promise<NotificationPreferences> {
    const res = await fetch(`${getApiUrl()}/notifications/preferences`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
    });
    if (!res.ok) throw new Error('NOTIF_PREFS_UPDATE_FAILED');
    const data = await res.json();
    return data.data.preferences;
}

interface SwitchRowProps {
    label: string;
    subtitle: string;
    value: boolean;
    field: keyof NotificationPreferences;
    onToggle: (field: keyof NotificationPreferences, value: boolean) => void;
    loading: boolean;
}

function SwitchRow({ label, subtitle, value, field, onToggle, loading }: SwitchRowProps) {
    return (
        <View style={styles.row}>
            <View style={styles.rowText}>
                <Text style={styles.rowLabel} numberOfLines={1}>{label}</Text>
                <Text style={styles.rowSubtitle} numberOfLines={2}>{subtitle}</Text>
            </View>
            {loading ? (
                <ActivityIndicator size="small" color={COLORS.neonGreen} />
            ) : (
                <Switch
                    value={value}
                    onValueChange={(v) => onToggle(field, v)}
                    trackColor={{ false: '#1a1a1a', true: `${COLORS.neonGreen}40` }}
                    thumbColor={value ? COLORS.neonGreen : '#666'}
                />
            )}
        </View>
    );
}

function SectionHeader({ title, icon }: { title: string; icon: string }) {
    return (
        <View style={styles.sectionHeader}>
            <Ionicons name={icon as any} size={18} color={COLORS.neonGreen} />
            <Text style={styles.sectionTitle}>{title}</Text>
        </View>
    );
}

export default function NotificationPreferencesScreen() {
    const { getToken } = useAuth();
    const { t } = useTranslation();
    const queryClient = useQueryClient();
    const [loadingField, setLoadingField] = useState<keyof NotificationPreferences | null>(null);

    const { data: prefs, isLoading } = useQuery({
        queryKey: ['notification-preferences'],
        queryFn: async () => {
            const token = await getToken();
            if (!token) throw new Error('NOT_AUTHENTICATED');
            return fetchPreferences(token);
        },
        placeholderData: DEFAULT_PREFS,
    });

    const mutation = useMutation({
        mutationFn: async (updates: Partial<NotificationPreferences>) => {
            const token = await getToken();
            if (!token) throw new Error('NOT_AUTHENTICATED');
            return updatePreferences(token, updates);
        },
        onMutate: async (updates) => {
            // Optimistic update
            await queryClient.cancelQueries({ queryKey: ['notification-preferences'] });
            const previous = queryClient.getQueryData<NotificationPreferences>(['notification-preferences']);
            queryClient.setQueryData<NotificationPreferences>(['notification-preferences'], (old) => ({
                ...(old || DEFAULT_PREFS),
                ...updates,
            }));
            return { previous };
        },
        onError: (err, _updates, context) => {
            // Rollback
            if (context?.previous) {
                queryClient.setQueryData(['notification-preferences'], context.previous);
            }
            logger.error('Failed to update notification preferences:', err);
            Alert.alert(t.common.error, t.notifications.prefUpdateError);
        },
        onSettled: () => {
            setLoadingField(null);
            queryClient.invalidateQueries({ queryKey: ['notification-preferences'] });
        },
    });

    const handleToggle = useCallback((field: keyof NotificationPreferences, value: boolean) => {
        setLoadingField(field);
        mutation.mutate({ [field]: value });
    }, [mutation]);

    const current = prefs || DEFAULT_PREFS;

    if (isLoading) {
        return (
            <View style={styles.container}>
                <LinearGradient colors={[COLORS.deepBlack, '#1a1a1a']} style={StyleSheet.absoluteFillObject} />
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color={COLORS.neonGreen} />
                </View>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <Stack.Screen
                options={{
                    headerShown: true,
                    title: t.notifications.preferencesTitle,
                    headerStyle: { backgroundColor: COLORS.deepBlack },
                    headerTintColor: COLORS.white,
                    headerTitleStyle: { fontWeight: 'bold' },
                }}
            />
            <LinearGradient colors={[COLORS.deepBlack, '#1a1a1a']} style={StyleSheet.absoluteFillObject} />

            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Match Section */}
                <View style={styles.section}>
                    <SectionHeader title={t.notifications.sectionMatch} icon="football-outline" />
                    <View style={styles.card}>
                        <SwitchRow label={t.notifications.prefMatchGoals} subtitle={t.notifications.prefMatchGoalsSub} value={current.matchGoals} field="matchGoals" onToggle={handleToggle} loading={loadingField === 'matchGoals'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefMatchStart} subtitle={t.notifications.prefMatchStartSub} value={current.matchStart} field="matchStart" onToggle={handleToggle} loading={loadingField === 'matchStart'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefMatchEnd} subtitle={t.notifications.prefMatchEndSub} value={current.matchEnd} field="matchEnd" onToggle={handleToggle} loading={loadingField === 'matchEnd'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefHalftime} subtitle={t.notifications.prefHalftimeSub} value={current.matchHalftime} field="matchHalftime" onToggle={handleToggle} loading={loadingField === 'matchHalftime'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefLeague} subtitle={t.notifications.prefLeagueSub} value={current.leagueMatches} field="leagueMatches" onToggle={handleToggle} loading={loadingField === 'leagueMatches'} />
                    </View>
                </View>

                {/* Social Section */}
                <View style={styles.section}>
                    <SectionHeader title={t.notifications.sectionSocial} icon="people-outline" />
                    <View style={styles.card}>
                        <SwitchRow label={t.notifications.prefFollow} subtitle={t.notifications.prefFollowSub} value={current.socialFollow} field="socialFollow" onToggle={handleToggle} loading={loadingField === 'socialFollow'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefLike} subtitle={t.notifications.prefLikeSub} value={current.socialLike} field="socialLike" onToggle={handleToggle} loading={loadingField === 'socialLike'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefComment} subtitle={t.notifications.prefCommentSub} value={current.socialComment} field="socialComment" onToggle={handleToggle} loading={loadingField === 'socialComment'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefReply} subtitle={t.notifications.prefReplySub} value={current.socialReply} field="socialReply" onToggle={handleToggle} loading={loadingField === 'socialReply'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefMention} subtitle={t.notifications.prefMentionSub} value={current.socialMention} field="socialMention" onToggle={handleToggle} loading={loadingField === 'socialMention'} />
                    </View>
                </View>

                {/* General Section */}
                <View style={styles.section}>
                    <SectionHeader title={t.notifications.sectionGeneral} icon="gift-outline" />
                    <View style={styles.card}>
                        <SwitchRow label={t.notifications.prefPrediction} subtitle={t.notifications.prefPredictionSub} value={current.predictionResults} field="predictionResults" onToggle={handleToggle} loading={loadingField === 'predictionResults'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefLuckyWheel} subtitle={t.notifications.prefLuckyWheelSub} value={current.luckyWheel} field="luckyWheel" onToggle={handleToggle} loading={loadingField === 'luckyWheel'} />
                        <View style={styles.divider} />
                        <SwitchRow label={t.notifications.prefGifts} subtitle={t.notifications.prefGiftsSub} value={current.gifts} field="gifts" onToggle={handleToggle} loading={loadingField === 'gifts'} />
                    </View>
                </View>

            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: COLORS.deepBlack },
    loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    content: { padding: 16, paddingBottom: 40 },
    section: { marginBottom: 24 },
    sectionHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 8 },
    sectionTitle: { fontSize: 15, fontWeight: '700', color: COLORS.white },
    card: { backgroundColor: '#111', borderRadius: 16, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
    row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
    rowText: { flex: 1, marginEnd: 12 },
    rowLabel: { fontSize: 15, fontWeight: '600', color: COLORS.white, marginBottom: 2 },
    rowSubtitle: { fontSize: 12, color: 'rgba(255,255,255,0.5)' },
    divider: { height: 1, backgroundColor: 'rgba(255,255,255,0.05)', marginHorizontal: 16 },
});
