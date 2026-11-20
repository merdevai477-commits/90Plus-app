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
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName } from '../utils/i18nHelpers';
import { logger } from '../utils/logger';

const CARD_BG = '#1a0b33';
const CARD_BORDER = '#3b1d6e';
const CARD_SHADOW = {
    shadowColor: '#4b1fa3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 8,
} as const;

const fmt = (n: number | null | undefined): string => {
    if (n == null || !Number.isFinite(n)) return '0';
    if (Math.abs(n) >= 1000) return n.toLocaleString();
    return String(n);
};

const fmtRating = (n: number | null | undefined): string =>
    n != null && Number.isFinite(n) ? n.toFixed(1) : '—';

const parseRouteInt = (value: string | string[] | undefined): number => {
    const raw = Array.isArray(value) ? value[0] : value;
    const n = parseInt(raw || '0', 10);
    return Number.isFinite(n) ? n : 0;
};

export default function PlayerCareerScreen() {
    const router = useRouter();
    const { t, language } = useTranslation();
    const pc = t.playerCareer;
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
        ApiFootballService.get365PlayerSocials(athleteId).then((links) => {
            if (active) setSocials(links);
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
        return [buildScores365AthleteCutoutUrl(athleteId, 500, imageVersion), ...circular];
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
                        <View style={styles.sectionAccent} />
                        <Text style={styles.sectionLabel}>{pc.currentSeason}</Text>
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
                                    style={[styles.compTab, active && styles.compTabActive]}
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
                                        <Ionicons name="trophy-outline" size={16} color="#6b7387" />
                                    )}
                                    <Text
                                        style={[styles.compTabText, active && styles.compTabTextActive]}
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
                    <Text style={styles.heading}>{pc.goalsAssistsTrend}</Text>
                    <TrendChart career={career} labels={pc} />
                </>
            )}

            {selectedSeason && selectedSeason.competitions.length > 0 && (
                <>
                    <Text style={styles.heading}>{pc.perCompetition}</Text>
                    {selectedSeason.competitions.map((c, idx) => (
                        <View
                            key={`${c.competitionId ?? c.competitionName}-${idx}`}
                            style={[styles.compCard, CARD_SHADOW]}
                        >
                            <View style={styles.compHeader}>
                                {c.competitionLogo ? (
                                    <ExpoImage
                                        source={{ uri: c.competitionLogo }}
                                        style={styles.compLogo}
                                        contentFit="contain"
                                        cachePolicy="memory-disk"
                                        recyclingKey={c.competitionLogo}
                                        priority="low"
                                        transition={0}
                                    />
                                ) : (
                                    <View style={styles.compLogoFallback}>
                                        <Ionicons name="trophy-outline" size={14} color="#a78bfa" />
                                    </View>
                                )}
                                <Text style={styles.compName} numberOfLines={1}>
                                    {c.competitionName}
                                </Text>
                                {c.rating != null && (
                                    <View style={styles.ratingPill}>
                                        <Text style={styles.ratingPillText}>{fmtRating(c.rating)}</Text>
                                    </View>
                                )}
                            </View>
                            <View style={styles.compStatsRow}>
                                <CompStat value={fmt(c.appearances)} label={pc.appearances} />
                                <CompStat value={fmt(c.goals)} label={pc.goals} />
                                <CompStat value={fmt(c.assists)} label={pc.assists} />
                                {c.minutes != null && (
                                    <CompStat value={fmt(c.minutes)} label={pc.minutes} />
                                )}
                            </View>
                        </View>
                    ))}
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

function CompStat({ value, label }: { value: string; label: string }) {
    return (
        <View style={styles.compStat}>
            <Text style={styles.compStatValue}>{value}</Text>
            <Text style={styles.compStatLabel}>{label}</Text>
        </View>
    );
}

function TrendChart({
    career,
    labels,
}: {
    career: Player365Career;
    labels: { goals: string; assists: string; allSeasons: string };
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
        <View style={styles.chartCard}>
            <View style={styles.legendRow}>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#8b5cf6' }]} />
                    <Text style={styles.legendText}>{labels.goals}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: '#38bdf8' }]} />
                    <Text style={styles.legendText}>{labels.assists}</Text>
                </View>
                <Text style={styles.legendAll}>{labels.allSeasons}</Text>
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
                            stroke="rgba(255,255,255,0.08)"
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
                                fill="rgba(255,255,255,0.55)"
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
    sectionLabel: { color: '#6b7387', fontSize: 13, fontWeight: '600' },

    heading: {
        color: '#24104e',
        fontSize: 16,
        fontWeight: '800',
        marginTop: 20,
        marginBottom: 12,
        textAlign: 'right',
    },

    chartCard: {
        backgroundColor: CARD_BG,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        padding: 14,
        ...CARD_SHADOW,
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: 'rgba(255,255,255,0.7)', fontSize: 12 },
    legendAll: { marginLeft: 'auto', color: 'rgba(255,255,255,0.45)', fontSize: 11 },

    compCard: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        padding: 14,
        marginBottom: 10,
    },
    compHeader: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
    compLogo: { width: 24, height: 24 },
    compLogoFallback: {
        width: 24,
        height: 24,
        borderRadius: 6,
        backgroundColor: 'rgba(167,139,250,0.15)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    compName: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
    ratingPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: '#FDBE3D',
    },
    ratingPillText: { color: '#272727', fontSize: 12, fontWeight: '800' },
    compStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    compStat: { alignItems: 'center', flex: 1 },
    compStatValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
    compStatLabel: { color: 'rgba(255,255,255,0.55)', fontSize: 11, marginTop: 2 },

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
        borderColor: '#e8e0f5',
        backgroundColor: '#fff',
        maxWidth: 180,
        ...CARD_SHADOW,
        shadowOpacity: 0.12,
        elevation: 3,
    },
    compTabActive: {
        borderColor: '#6a2bd9',
        backgroundColor: '#f3edff',
    },
    compTabLogo: { width: 20, height: 20 },
    compTabText: { color: '#6b7387', fontSize: 12, fontWeight: '600', flexShrink: 1 },
    compTabTextActive: { color: '#24104e', fontWeight: '700' },
});
