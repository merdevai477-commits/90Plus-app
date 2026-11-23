import { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import ApiFootballService, {
    type Player365Career,
    type Player365CareerHighlightCompetition,
    type Player365CareerSeason,
    type PlayerSocialLinks,
} from '../services/apiFootball';
import {
    buildScores365AthleteCutoutUrl,
    scores365AthleteImageVersionFromUrl,
    scores365AthletePhotoCandidates,
    with365ImageSize,
} from '../utils/scores365AthletePhoto';
import {
    PlayerSeasonStatsCard,
    parsePlayerStatNumber,
} from '../components/player/PlayerSeasonStatsCard';
import PlayerProfileView, { PlayerProfileStatus } from '../components/PlayerProfile/PlayerProfileView';
import type { PlayerProfileViewModel } from '../components/PlayerProfile/types';
import {
    ageFromDateOfBirth,
    careerAverageRating,
    careerCurrentSeason,
    careerDetailedStats,
    careerPer90,
    careerSeasonSummary,
    careerTransferRows,
} from '../components/PlayerProfile/viewModel';
import { useResolvedAppScheme } from '../hooks/useResolvedAppScheme';
import { getPPColors } from '../components/PlayerProfile/theme';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName } from '../utils/i18nHelpers';
import { logger } from '../utils/logger';

const CARD_SHADOW = {
    shadowColor: '#4b1fa3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.2,
    shadowRadius: 12,
    elevation: 8,
} as const;

const fmt = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return '0';
    if (Math.abs(n) >= 1000) return n.toLocaleString();
    return String(n);
};

const parseRouteInt = (value: string | string[] | undefined): number => {
    const raw = Array.isArray(value) ? value[0] : value;
    const n = parseInt(raw || '0', 10);
    return Number.isFinite(n) ? n : 0;
};

export default function PlayerCareerScreen() {
    const router = useRouter();
    const { t, language } = useTranslation();
    const pc = t.playerCareer;
    const { isDark } = useResolvedAppScheme();
    const C = useMemo(() => getPPColors(isDark), [isDark]);
    const surface = {
        bg: C.card,
        border: C.border,
        text: isDark ? '#FFFFFF' : C.ink,
        muted: C.muted,
        grid: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(36,16,78,0.08)',
        axis: isDark ? 'rgba(255,255,255,0.55)' : C.muted,
    };
    const params = useLocalSearchParams() as {
        athleteId?: string | string[];
        id?: string | string[];
        name?: string;
        photo?: string;
        teamName?: string;
        teamLogo?: string;
    };

    const routeAthleteId = parseRouteInt(params.athleteId ?? params.id);
    const routeName = Array.isArray(params.name) ? params.name[0] : params.name;
    const routeTeamName = Array.isArray(params.teamName) ? params.teamName[0] : params.teamName;

    const [resolvedAthleteId, setResolvedAthleteId] = useState(routeAthleteId);
    const athleteId = resolvedAthleteId || routeAthleteId;

    const [career, setCareer] = useState<Player365Career | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedSeasonKey, setSelectedSeasonKey] = useState<string | null>(null);
    const [highlightCompId, setHighlightCompId] = useState<number | null>(null);
    const [socials, setSocials] = useState<PlayerSocialLinks | null>(null);

    useEffect(() => {
        if (athleteId <= 0) return;
        let active = true;
        setSocials(null);
        ApiFootballService.get365PlayerSocials(athleteId)
            .then((links) => {
                if (!active) return;
                // Normalize so the hero can show only platforms that have a URL.
                setSocials(
                    links
                        ? {
                              athleteId: links.athleteId ?? athleteId,
                              facebookUrl: links.facebookUrl || null,
                              instagramUrl: links.instagramUrl || null,
                          }
                        : { athleteId, facebookUrl: null, instagramUrl: null },
                );
            })
            .catch(() => {
                if (active) setSocials({ athleteId, facebookUrl: null, instagramUrl: null });
            });
        return () => {
            active = false;
        };
    }, [athleteId]);

    useEffect(() => {
        let active = true;
        (async () => {
            if (!routeAthleteId) {
                setError(true);
                setLoading(false);
                return;
            }
            try {
                logger.debug(`Loading 365 career for athlete ${routeAthleteId}`);
                let data = await ApiFootballService.get365PlayerCareer(routeAthleteId, language);
                // Older cached lineups handed us a per-game roster id, which no 365
                // player endpoint accepts — recover the real athlete by name.
                if (!data?.seasons?.length && routeName) {
                    const recovered = await ApiFootballService.resolve365AthleteIdByName(
                        routeName,
                        routeTeamName,
                    );
                    if (recovered && recovered !== routeAthleteId) {
                        data = await ApiFootballService.get365PlayerCareer(recovered, language);
                        if (active && data?.seasons?.length) setResolvedAthleteId(recovered);
                    }
                }
                if (!active) return;
                if (!data?.seasons?.length) {
                    setError(true);
                } else {
                    setCareer(data);
                    setSelectedSeasonKey(data.seasons[0]?.seasonKey ?? null);
                    const firstHl = data.currentSeasonHighlights?.[0]?.competitionId;
                    if (firstHl != null) setHighlightCompId(firstHl);
                }
            } catch (err) {
                logger.warn('Failed to load 365 career:', err);
                if (active) setError(true);
            } finally {
                if (active) setLoading(false);
            }
        })();
        return () => {
            active = false;
        };
    }, [routeAthleteId, routeName, routeTeamName, language]);

    const selectedSeason: Player365CareerSeason | null = useMemo(() => {
        if (!career) return null;
        return (
            career.seasons.find((s) => s.seasonKey === selectedSeasonKey) ??
            career.seasons[0] ??
            null
        );
    }, [career, selectedSeasonKey]);

    const isCurrentSeason =
        !!career?.currentSeasonKey &&
        selectedSeason?.seasonKey === career.currentSeasonKey;

    const activeHighlight: Player365CareerHighlightCompetition | null = useMemo(() => {
        const list = career?.currentSeasonHighlights ?? [];
        if (!list.length) return null;
        return list.find((h) => h.competitionId === highlightCompId) ?? list[0];
    }, [career, highlightCompId]);

    const photoCandidates = useMemo(() => {
        const preferred =
            (typeof params.photo === 'string' && params.photo) ||
            career?.profile.imageUrl ||
            null;
        const circular = scores365AthletePhotoCandidates(athleteId, preferred, 250).map(
            (uri) => with365ImageSize(uri, 250) ?? uri,
        );
        if (athleteId <= 0) return circular;
        const imageVersion =
            scores365AthleteImageVersionFromUrl(career?.profile.imageUrl) ??
            scores365AthleteImageVersionFromUrl(preferred);
        return [buildScores365AthleteCutoutUrl(athleteId, 700, imageVersion), ...circular];
    }, [athleteId, career?.profile.imageUrl, params.photo]);

    const vm: PlayerProfileViewModel | null = useMemo(() => {
        if (!career) return null;
        const profile = career.profile;
        const routeTeamLogo = typeof params.teamLogo === 'string' ? params.teamLogo : undefined;
        const rawClub = profile.clubName || routeTeamName || null;
        const clubLogo =
            profile.clubLogo ||
            routeTeamLogo ||
            profile.transfers?.find((tr) => tr.active && tr.competitorLogo)?.competitorLogo ||
            profile.transfers?.find((tr) => tr.competitorLogo)?.competitorLogo ||
            null;
        // Figma shows height as "178 cm". 365 may send metres ("1.78") or cm ("178").
        const height = (() => {
            const raw = profile.height?.trim();
            if (!raw) return null;
            if (!/^\d+(\.\d+)?$/.test(raw)) return raw;
            const n = Number.parseFloat(raw);
            if (!Number.isFinite(n)) return raw;
            const cm = n > 0 && n < 3 ? Math.round(n * 100) : Math.round(n);
            return `${cm} cm`;
        })();
        const shown =
            career.seasons.find((s) => s.seasonKey === selectedSeasonKey) ?? careerCurrentSeason(career);
        return {
            name: profile.name,
            photoCandidates,
            photoKey: `career-${athleteId}`,
            jerseyNumber: profile.jerseyNumber ?? null,
            nationality: profile.nationality ?? null,
            clubName: rawClub ? getTeamDisplayName(rawClub, language) : null,
            clubLogo,
            position: profile.position ?? null,
            height,
            age: profile.age ?? ageFromDateOfBirth(profile.dateOfBirth),
            seasonLabel: shown?.label ?? null,
            seasons: career.seasons.map((s) => ({ key: s.seasonKey, label: s.label })),
            selectedSeasonKey: shown?.seasonKey ?? null,
            season: careerSeasonSummary(career, shown?.seasonKey),
            competitions: (shown?.competitions ?? []).map((c, idx) => ({
                key: `${c.competitionId ?? c.competitionName}-${idx}`,
                competitionName: c.competitionName,
                competitionLogo: c.competitionLogo,
                appearances: c.appearances,
                goals: c.goals,
                assists: c.assists,
                minutes: c.minutes,
                rating: c.rating,
            })),
            detailed: careerDetailedStats(career, shown?.seasonKey),
            averageRating: careerAverageRating(career, shown?.seasonKey),
            per90: careerPer90(career, shown?.seasonKey),
            lastMatches: (career.lastMatches ?? []).map((m) => ({
                ...m,
                opponentName: m.opponentName ? getTeamDisplayName(m.opponentName, language) : null,
            })),
            transfers: careerTransferRows(career).map((tr) => ({
                ...tr,
                clubName: getTeamDisplayName(tr.clubName, language),
            })),
        };
    }, [career, photoCandidates, athleteId, params.teamLogo, routeTeamName, language, selectedSeasonKey]);

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/matches' as never);
    };

    if (loading) {
        return <PlayerProfileStatus loading message={pc.loading} onBack={goBack} />;
    }

    if (error || !career || !career.seasons.length || !vm) {
        return <PlayerProfileStatus message={pc.noData} actionLabel={pc.goBack} onBack={goBack} />;
    }

    const statsContent = (
        <View style={styles.statsWrap}>
            {/* Current season — rich stats from 365 highlightStats */}
            {(career.currentSeasonHighlights?.length ?? 0) > 0 && activeHighlight && (
                <>
                    <View style={styles.sectionLabelRow}>
                        <View style={[styles.sectionAccent, { backgroundColor: C.primary }]} />
                        <Text style={[styles.sectionLabel, { color: C.muted }]}>{pc.currentSeason}</Text>
                    </View>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.compTabScroll}
                        contentContainerStyle={styles.compTabRow}
                    >
                        {career.currentSeasonHighlights!.map((h) => {
                            const active = h.competitionId === activeHighlight.competitionId;
                            return (
                                <TouchableOpacity
                                    key={h.competitionId}
                                    style={[
                                        styles.compTab,
                                        {
                                            backgroundColor: active ? C.pale : C.card,
                                            borderColor: active ? C.primary : C.border,
                                        },
                                    ]}
                                    onPress={() => setHighlightCompId(h.competitionId)}
                                    activeOpacity={0.85}
                                >
                                    {h.competitionLogo ? (
                                        <ExpoImage
                                            source={{ uri: h.competitionLogo }}
                                            style={styles.compTabLogo}
                                            contentFit="contain"
                                            cachePolicy="memory-disk"
                                            recyclingKey={h.competitionLogo}
                                            priority="low"
                                            transition={0}
                                        />
                                    ) : (
                                        <Ionicons name="trophy-outline" size={16} color={C.muted} />
                                    )}
                                    <Text
                                        style={[
                                            styles.compTabText,
                                            { color: active ? C.ink : C.muted },
                                            active && { fontWeight: '700' },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {h.competitionName}
                                    </Text>
                                </TouchableOpacity>
                            );
                        })}
                    </ScrollView>

                    <PlayerSeasonStatsCard
                        title={pc.statsComparison}
                        rings={activeHighlight.stats
                            .filter((s) => s.isTop)
                            .slice(0, 3)
                            .map((s) => ({
                                label: s.shortName || s.name,
                                value: parsePlayerStatNumber(s.value),
                                display: s.value,
                            }))}
                        bars={activeHighlight.stats
                            .filter((s) => !s.isTop)
                            .map((s) => ({
                                label: s.name,
                                value: parsePlayerStatNumber(s.value),
                                display: s.value,
                            }))}
                    />
                </>
            )}

            {/* Season totals for the selected season (season chosen beside تفاصيل الإحصائيات) */}
            {selectedSeason && (
                <PlayerSeasonStatsCard
                    title={pc.statsComparison}
                    rings={[
                        {
                            label: pc.appearances,
                            value: selectedSeason.appearances ?? 0,
                            display: fmt(selectedSeason.appearances),
                        },
                        {
                            label: pc.goals,
                            value: selectedSeason.goals ?? 0,
                            display: fmt(selectedSeason.goals),
                        },
                        {
                            label: pc.assists,
                            value: selectedSeason.assists ?? 0,
                            display: fmt(selectedSeason.assists),
                        },
                    ]}
                    bars={[
                        ...(isCurrentSeason && selectedSeason.minutes != null
                            ? [
                                  {
                                      label: pc.minutes,
                                      value: selectedSeason.minutes,
                                      display: fmt(selectedSeason.minutes),
                                      max: Math.max(
                                          selectedSeason.minutes,
                                          (selectedSeason.appearances || 1) * 90,
                                      ),
                                  },
                              ]
                            : []),
                        {
                            label: pc.yellowCards,
                            value: sumStat(selectedSeason, 'yellowCards'),
                            display: fmt(sumStat(selectedSeason, 'yellowCards')),
                            max: Math.max(
                                1,
                                sumStat(selectedSeason, 'yellowCards'),
                                sumStat(selectedSeason, 'redCards'),
                            ),
                        },
                        {
                            label: pc.redCards,
                            value: sumStat(selectedSeason, 'redCards'),
                            display: fmt(sumStat(selectedSeason, 'redCards')),
                            max: Math.max(
                                1,
                                sumStat(selectedSeason, 'yellowCards'),
                                sumStat(selectedSeason, 'redCards'),
                            ),
                        },
                    ]}
                />
            )}

            {career.trend.length > 1 && (
                <>
                    <Text style={[styles.heading, { color: C.ink }]}>{pc.goalsAssistsTrend}</Text>
                    <TrendChart career={career} labels={pc} surface={surface} />
                </>
            )}

        </View>
    );

    return (
        <PlayerProfileView
            vm={vm}
            statsContent={statsContent}
            onBack={goBack}
            onSelectSeason={setSelectedSeasonKey}
            socials={socials}
        />
    );
}

function sumStat(season: Player365CareerSeason, key: 'yellowCards' | 'redCards'): number {
    return season.competitions.reduce((acc, c) => acc + (c[key] ?? 0), 0);
}

function TrendChart({
    career,
    labels,
    surface,
}: {
    career: Player365Career;
    labels: { goals: string; assists: string; allSeasons: string };
    surface: { bg: string; border: string; text: string; muted: string; grid: string; axis: string };
}) {
    const points = career.trend;
    const barGroupWidth = 46;
    const chartWidth = Math.max(points.length * barGroupWidth + 24, 280);
    const chartHeight = 160;
    const topPad = 12;
    const bottomPad = 28;
    const usableH = chartHeight - topPad - bottomPad;
    const maxVal = Math.max(1, ...points.map((p) => Math.max(p.goals, p.assists)));
    const barW = 12;

    return (
        <View
            style={[
                styles.chartCard,
                CARD_SHADOW,
                { backgroundColor: surface.bg, borderColor: surface.border },
            ]}
        >
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                    <Text style={[styles.legendText, { color: surface.muted }]}>{labels.goals}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#38bdf8' }]} />
                    <Text style={[styles.legendText, { color: surface.muted }]}>{labels.assists}</Text>
                </View>
                <Text style={[styles.legendAll, { color: surface.muted }]}>{labels.allSeasons}</Text>
            </View>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <Svg width={chartWidth} height={chartHeight}>
                    {[0, 0.5, 1].map((g, i) => (
                        <Line
                            key={i}
                            x1={0}
                            y1={topPad + usableH * (1 - g)}
                            x2={chartWidth}
                            y2={topPad + usableH * (1 - g)}
                            stroke={surface.grid}
                            strokeWidth={1}
                        />
                    ))}
                    {points.map((p, i) => {
                        const cx = 16 + i * barGroupWidth;
                        const gH = (p.goals / maxVal) * usableH;
                        return (
                            <Rect
                                key={`g-${i}`}
                                x={cx}
                                y={topPad + (usableH - gH)}
                                width={barW}
                                height={Math.max(gH, 1)}
                                rx={3}
                                fill="#8b5cf6"
                            />
                        );
                    })}
                    {points.map((p, i) => {
                        const cx = 16 + i * barGroupWidth + barW + 3;
                        const aH = (p.assists / maxVal) * usableH;
                        return (
                            <Rect
                                key={`a-${i}`}
                                x={cx}
                                y={topPad + (usableH - aH)}
                                width={barW}
                                height={Math.max(aH, 1)}
                                rx={3}
                                fill="#38bdf8"
                            />
                        );
                    })}
                    {points.map((p, i) => {
                        const cx = 16 + i * barGroupWidth + barW;
                        return (
                            <SvgText
                                key={`t-${i}`}
                                x={cx}
                                y={chartHeight - 8}
                                fill={surface.axis}
                                fontSize={9}
                                textAnchor="middle"
                            >
                                {p.label}
                            </SvgText>
                        );
                    })}
                </Svg>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    statsWrap: { paddingTop: 18 },

    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8, marginTop: 4 },
    sectionAccent: {
        width: 3,
        height: 14,
        borderRadius: 2,
        backgroundColor: '#6a2bd9',
    },
    sectionLabel: { fontSize: 13, fontWeight: '600' },

    heading: {
        fontSize: 16,
        fontWeight: '800',
        marginTop: 20,
        marginBottom: 12,
        textAlign: 'right',
    },

    chartCard: {
        borderRadius: 18,
        borderWidth: 1,
        padding: 14,
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { fontSize: 12 },
    legendAll: { marginLeft: 'auto', fontSize: 11 },

    compTabScroll: { marginBottom: 12, marginHorizontal: -4 },
    compTabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
    compTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 14,
        borderWidth: 1,
        maxWidth: 180,
        ...CARD_SHADOW,
        shadowOpacity: 0.12,
        elevation: 3,
    },
    compTabLogo: { width: 20, height: 20 },
    compTabText: { fontSize: 12, fontWeight: '600', flexShrink: 1 },
});
