/**
 * Details tab: full club information, current coach, trophies (with winning
 * seasons), and current injuries. Every row is only rendered when the backing
 * field is present in the API response.
 */

import React, { useMemo } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Radius, FontSize, FontWeight } from '../../constants/theme';
import type { Language } from '../../src/i18n/types';
import type { TranslationKeys } from '../../src/i18n/utils';
import type { Coach, Injury, Trophy } from '../../services/apiFootball';
import type { TeamInfo } from '../../hooks/useTeamProfile';
import {
    getTeamDisplayName,
    getCountryDisplayName,
    getLeagueDisplayName,
} from '../../utils/i18nHelpers';
import { playerPhotoUrl } from '../../utils/playerStatsAggregate';
import { Card, SectionTitle, InfoRow, EmptyState } from './shared';
import { aggregateTrophies } from './utils';

interface DetailsTabProps {
    teamId: number;
    teamInfo: TeamInfo | null;
    coaches: Coach[] | undefined;
    trophies: Trophy[] | undefined;
    injuries: Injury[] | undefined;
    language: Language;
    t: TranslationKeys;
}

function ClubInformation({
    teamInfo,
    language,
    t,
}: {
    teamInfo: TeamInfo | null;
    language: Language;
    t: TranslationKeys;
}) {
    if (!teamInfo?.team) return null;
    const { team, venue } = teamInfo;

    const rows: { label: string; value: string | number }[] = [];
    if (team.name) rows.push({ label: t.teamProfile.fullName, value: getTeamDisplayName(team.name, language) });
    if (team.code) rows.push({ label: t.teamProfile.shortName, value: team.code });
    if (team.country) rows.push({ label: t.teamProfile.country, value: getCountryDisplayName(team.country, language) });
    if (venue?.city) rows.push({ label: t.teamProfile.city, value: venue.city });
    if (team.founded) rows.push({ label: t.teamProfile.founded, value: team.founded });
    if (venue?.name) rows.push({ label: t.teamProfile.stadium, value: venue.name });
    if (venue?.capacity) rows.push({ label: t.matchDetails.capacity, value: venue.capacity.toLocaleString() });
    if (venue?.address) rows.push({ label: t.teamProfile.address, value: venue.address });

    if (rows.length === 0) return null;

    return (
        <Card>
            <SectionTitle title={t.teamProfile.clubInformation} />
            {rows.map((r, i) => (
                <InfoRow key={r.label} label={r.label} value={r.value} />
            ))}
        </Card>
    );
}

function CoachInformation({
    teamId,
    coaches,
    language,
    t,
}: {
    teamId: number;
    coaches: Coach[] | undefined;
    language: Language;
    t: TranslationKeys;
}) {
    const coach = coaches && coaches.length > 0 ? coaches[0] : null;

    const joined = useMemo(() => {
        if (!coach?.career) return null;
        const current = coach.career.find((c) => c.team?.id === teamId && !c.end);
        return current?.start ?? null;
    }, [coach, teamId]);

    if (!coach) {
        return (
            <Card>
                <SectionTitle title={t.teamProfile.coachInformation} />
                <EmptyState text={t.teamProfile.noCoach} icon="person-outline" />
            </Card>
        );
    }

    return (
        <Card>
            <SectionTitle title={t.teamProfile.coachInformation} />
            <View style={styles.coachHeader}>
                <Image
                    source={{ uri: playerPhotoUrl(coach.id, coach.photo) }}
                    style={styles.coachPhoto}
                    contentFit="cover"
                    transition={150}
                />
                <View style={styles.coachHeaderInfo}>
                    <Text style={styles.coachName} numberOfLines={1}>
                        {coach.name}
                    </Text>
                    {coach.nationality ? (
                        <Text style={styles.coachSub} numberOfLines={1}>
                            {getCountryDisplayName(coach.nationality, language)}
                        </Text>
                    ) : null}
                </View>
            </View>
            {coach.age ? <InfoRow label={t.teamProfile.age} value={coach.age} /> : null}
            {coach.nationality ? (
                <InfoRow label={t.teamProfile.nationality} value={getCountryDisplayName(coach.nationality, language)} />
            ) : null}
            {joined ? <InfoRow label={t.teamProfile.joined} value={joined} /> : null}
        </Card>
    );
}

function TrophiesSection({
    trophies,
    language,
    t,
}: {
    trophies: Trophy[] | undefined;
    language: Language;
    t: TranslationKeys;
}) {
    const aggregated = useMemo(() => aggregateTrophies(trophies), [trophies]);

    return (
        <Card>
            <SectionTitle title={t.teamProfile.trophies} />
            {aggregated.length > 0 ? (
                aggregated.map((tr) => (
                    <View key={`${tr.leagueId}-${tr.name}`} style={styles.trophyItem}>
                        <View style={styles.trophyTop}>
                            <Text style={styles.trophyName} numberOfLines={1}>
                                {getLeagueDisplayName(tr.name, language, tr.leagueId, tr.country)}
                            </Text>
                            <View style={styles.trophyCount}>
                                <Ionicons name="trophy" size={13} color={Colors.gold} />
                                <Text style={styles.trophyCountText}>
                                    {tr.titles} {t.teamProfile.titles}
                                </Text>
                            </View>
                        </View>
                        {tr.seasons.length > 0 ? (
                            <Text style={styles.trophySeasons} numberOfLines={2}>
                                {tr.seasons.join('  •  ')}
                            </Text>
                        ) : null}
                    </View>
                ))
            ) : (
                <EmptyState text={t.teamProfile.noTrophies} icon="trophy-outline" />
            )}
        </Card>
    );
}

function InjuriesSection({
    injuries,
    t,
}: {
    injuries: Injury[] | undefined;
    t: TranslationKeys;
}) {
    const list = injuries ?? [];

    return (
        <Card>
            <SectionTitle title={t.teamProfile.injuries} />
            {list.length > 0 ? (
                list.map((inj, idx) => (
                    <View key={`${inj.player?.id}-${idx}`} style={styles.injuryRow}>
                        <Image
                            source={{ uri: playerPhotoUrl(inj.player?.id ?? 0, inj.player?.photo) }}
                            style={styles.injuryPhoto}
                            contentFit="cover"
                            transition={150}
                        />
                        <View style={styles.injuryInfo}>
                            <Text style={styles.injuryName} numberOfLines={1}>
                                {inj.player?.name}
                            </Text>
                            {inj.type || inj.reason ? (
                                <Text style={styles.injuryType} numberOfLines={1}>
                                    {inj.reason || inj.type}
                                </Text>
                            ) : null}
                        </View>
                    </View>
                ))
            ) : (
                <EmptyState text={t.teamProfile.noInjuries} icon="medkit-outline" />
            )}
        </Card>
    );
}

export default function DetailsTab({
    teamId,
    teamInfo,
    coaches,
    trophies,
    injuries,
    language,
    t,
}: DetailsTabProps) {
    return (
        <View style={styles.container}>
            <ClubInformation teamInfo={teamInfo} language={language} t={t} />
            <CoachInformation teamId={teamId} coaches={coaches} language={language} t={t} />
            <TrophiesSection trophies={trophies} language={language} t={t} />
            <InjuriesSection injuries={injuries} t={t} />
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: Spacing.base,
        paddingTop: Spacing.base,
        gap: Spacing.lg,
    },
    coachHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        marginBottom: Spacing.sm,
    },
    coachPhoto: {
        width: 56,
        height: 56,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
    },
    coachHeaderInfo: {
        flex: 1,
    },
    coachName: {
        color: Colors.textPrimary,
        fontSize: FontSize['2xl'],
        fontWeight: FontWeight.bold,
    },
    coachSub: {
        color: Colors.textSecondary,
        fontSize: FontSize.lg,
        marginTop: 2,
    },
    trophyItem: {
        paddingVertical: Spacing.md,
        borderBottomWidth: 1,
        borderBottomColor: Colors.borderSubtle,
        gap: Spacing.xs,
    },
    trophyTop: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: Spacing.sm,
    },
    trophyName: {
        flex: 1,
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    trophyCount: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: Spacing.sm,
        paddingVertical: 3,
        borderRadius: Radius.badge,
        backgroundColor: Colors.white06,
    },
    trophyCountText: {
        color: Colors.gold,
        fontSize: FontSize.base,
        fontWeight: FontWeight.bold,
    },
    trophySeasons: {
        color: Colors.textSecondary,
        fontSize: FontSize.base,
    },
    injuryRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: Spacing.md,
        paddingVertical: Spacing.sm,
    },
    injuryPhoto: {
        width: 40,
        height: 40,
        borderRadius: Radius.full,
        backgroundColor: Colors.white08,
    },
    injuryInfo: {
        flex: 1,
    },
    injuryName: {
        color: Colors.textPrimary,
        fontSize: FontSize.lg,
        fontWeight: FontWeight.semibold,
    },
    injuryType: {
        color: Colors.error,
        fontSize: FontSize.base,
        marginTop: 2,
    },
});
