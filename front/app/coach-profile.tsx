/**
 * Coach profile (365Scores `/web/athletes/?fullDetails=true`).
 */

import React, { useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from '@tanstack/react-query';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../constants/theme';
import { useTranslation } from '../src/i18n';
import ApiFootballService from '../services/apiFootball';
import CachedAthletePhoto from '../components/common/CachedAthletePhoto';
import ImageViewerModal from '../components/common/ImageViewerModal';
import { buildScores365CoachPhotoUrl, toFullscreenPhotoUrl } from '../utils/scores365AthletePhoto';

export default function CoachProfileScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { t } = useTranslation();
    const params = useLocalSearchParams() as {
        id?: string;
        name?: string;
        photo?: string;
        teamName?: string;
        teamId?: string;
    };
    const athleteId = parseInt(params.id ?? '0', 10);
    const cp = t.coachProfile;

    const q = useQuery({
        queryKey: ['365-athlete-profile', athleteId],
        queryFn: () => ApiFootballService.getAthlete365Profile(athleteId),
        enabled: athleteId > 0,
        staleTime: 30 * 60 * 1000,
        retry: 1,
        refetchOnWindowFocus: false,
    });

    const profile = q.data;
    const name = profile?.name || params.name || '—';
    const teamName = profile?.teamName || params.teamName || null;
    const teamId = profile?.teamId ?? (params.teamId ? parseInt(params.teamId, 10) : null);
    const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
    const photoUri = profile?.imageUrl || params.photo || undefined;
    const viewerUrl = useMemo(() => {
        return (
            toFullscreenPhotoUrl(photoUri) ||
            (athleteId > 0
                ? buildScores365CoachPhotoUrl(athleteId, 250, profile?.imageVersion)
                : undefined)
        );
    }, [photoUri, athleteId, profile?.imageVersion]);

    return (
        <View style={[styles.container, { paddingTop: insets.top }]}>
            <StatusBar barStyle="light-content" />
            <View style={styles.topBar}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
                    <Ionicons name="chevron-back" size={22} color={Colors.textPrimary} />
                </TouchableOpacity>
                <Text style={styles.topTitle}>{cp.title}</Text>
                <View style={styles.backBtn} />
            </View>

            {q.isLoading ? (
                <View style={styles.center}>
                    <ActivityIndicator color={Colors.purpleSoft} />
                    <Text style={styles.muted}>{cp.loading}</Text>
                </View>
            ) : q.isError && !profile ? (
                <View style={styles.center}>
                    <Text style={styles.title}>{cp.noData}</Text>
                </View>
            ) : (
                <ScrollView contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}>
                    <View style={styles.hero}>
                        <CachedAthletePhoto
                            uri={photoUri}
                            size={88}
                            recyclingKey={athleteId}
                            onPress={viewerUrl ? () => setPhotoViewerOpen(true) : undefined}
                        />
                        <Text style={styles.name}>{name}</Text>
                        {profile?.nationality || profile?.age ? (
                            <Text style={styles.meta}>
                                {[profile?.nationality, profile?.age != null ? String(profile.age) : null]
                                    .filter(Boolean)
                                    .join(' · ')}
                            </Text>
                        ) : null}
                    </View>

                    {teamName ? (
                        <TouchableOpacity
                            style={styles.card}
                            activeOpacity={teamId && teamId > 0 ? 0.8 : 1}
                            onPress={() => {
                                if (teamId && teamId > 0) {
                                    router.push({
                                        pathname: '/team-profile' as any,
                                        params: { id: String(teamId), name: teamName },
                                    } as any);
                                }
                            }}
                        >
                            <Text style={styles.label}>{cp.team}</Text>
                            <Text style={styles.value}>{teamName}</Text>
                        </TouchableOpacity>
                    ) : null}

                    {profile?.contractUntil ? (
                        <View style={styles.card}>
                            <Text style={styles.label}>{cp.contract}</Text>
                            <Text style={styles.value}>{profile.contractUntil}</Text>
                        </View>
                    ) : null}

                    {profile?.bio ? (
                        <View style={styles.card}>
                            <Text style={styles.bio}>{profile.bio}</Text>
                        </View>
                    ) : null}

                    {profile?.trophies && profile.trophies.length > 0 ? (
                        <View style={styles.card}>
                            <Text style={styles.label}>{cp.trophies}</Text>
                            {profile.trophies.map((trophy) => (
                                <Text
                                    key={`${trophy.competitionId}-${trophy.name}`}
                                    style={styles.trophy}
                                >
                                    {trophy.displayName || trophy.name}
                                    {trophy.count > 1 ? ` ×${trophy.count}` : ''}
                                </Text>
                            ))}
                        </View>
                    ) : null}
                </ScrollView>
            )}
            <ImageViewerModal
                visible={photoViewerOpen && !!viewerUrl}
                imageUrl={viewerUrl || ''}
                onClose={() => setPhotoViewerOpen(false)}
            />
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: Colors.bgBase },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: Spacing.base,
        paddingVertical: Spacing.sm,
    },
    backBtn: {
        width: 36,
        height: 36,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
        alignItems: 'center',
        justifyContent: 'center',
    },
    topTitle: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.bold,
    },
    center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: Spacing.sm },
    muted: { color: Colors.textMuted },
    title: { color: Colors.textPrimary, fontSize: FontSize['3xl'], fontWeight: FontWeight.bold },
    hero: { alignItems: 'center', paddingVertical: Spacing['3xl'], gap: Spacing.sm },
    name: {
        color: Colors.textPrimary,
        fontSize: FontSize['4xl'],
        fontWeight: FontWeight.extrabold,
        textAlign: 'center',
        paddingHorizontal: Spacing.lg,
    },
    meta: { color: Colors.textSecondary, fontSize: FontSize.lg },
    card: {
        marginHorizontal: Spacing.base,
        marginBottom: Spacing.md,
        backgroundColor: Colors.surfaceGlass,
        borderRadius: Radius.md,
        borderWidth: 1,
        borderColor: Colors.borderSubtle,
        padding: Spacing.base,
        gap: 6,
    },
    label: { color: Colors.textMuted, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
    value: { color: Colors.textPrimary, fontSize: FontSize.xl, fontWeight: FontWeight.semibold },
    bio: { color: Colors.textSecondary, fontSize: FontSize.lg, lineHeight: 22 },
    trophy: { color: Colors.textPrimary, fontSize: FontSize.lg },
});
