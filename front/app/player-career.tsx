import { useEffect, useMemo, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    LayoutAnimation,
    Platform,
    UIManager,
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
import { ProfileTheme } from '../constants/ProfileTheme';
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
    careerCurrentSeason,
    careerSeasonSummary,
    careerTransferRows,
} from '../components/PlayerProfile/viewModel';
import { useTranslation } from '../src/i18n';
import { getTeamDisplayName } from '../utils/i18nHelpers';
import { logger } from '../utils/logger';

if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

const CARD_BG = '#0b0518';
const CARD_BORDER = '#281359';

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
    const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
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
        const height = profile.height
            ? /^\d+(\.\d+)?$/.test(profile.height.trim())
                ? `${profile.height.trim()} ${pc.heightUnit}`
                : profile.height
            : null;
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
            lastMatches: (career.lastMatches ?? []).map((m) => ({
                ...m,
                opponentName: m.opponentName ? getTeamDisplayName(m.opponentName, language) : null,
            })),
            transfers: careerTransferRows(career).map((tr) => ({
                ...tr,
                clubName: getTeamDisplayName(tr.clubName, language),
            })),
        };
    }, [career, photoCandidates, athleteId, params.teamLogo, routeTeamName, language, pc.heightUnit, selectedSeasonKey]);

    const animateSeasonLayout = () => {
        if (Platform.OS === 'ios') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        }
    };

    const togglePicker = () => {
        animateSeasonLayout();
        setSeasonPickerOpen((o) => !o);
    };

    const pickSeason = (key: string) => {
        animateSeasonLayout();
        setSelectedSeasonKey(key);
        setSeasonPickerOpen(false);
    };

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
                                        <Ionicons
                                            name="trophy-outline"
                                            size={16}
                                            color={ProfileTheme.colors.textTertiary}
                                        />
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

            {/* Season selector */}
            <View style={styles.sectionLabelRow}>
                <View style={styles.sectionAccent} />
                <Text style={styles.sectionLabel}>{pc.season}</Text>
            </View>
            <TouchableOpacity
                style={styles.selector}
                activeOpacity={0.85}
                onPress={togglePicker}
            >
                <View style={styles.selectorLeft}>
                    <Ionicons name="calendar-outline" size={18} color={ProfileTheme.colors.neonPurple} />
                    <View>
                        <Text style={styles.selectorHint}>{pc.selectedSeason}</Text>
                        <Text style={styles.selectorValue}>
                            {selectedSeason?.label ?? '—'}
                        </Text>
                    </View>
                </View>
                <Ionicons
                    name={seasonPickerOpen ? 'chevron-up' : 'chevron-down'}
                    size={20}
                    color={ProfileTheme.colors.textSecondary}
                />
            </TouchableOpacity>
            {seasonPickerOpen && (
                <View style={styles.dropdown}>
                    {career.seasons.map((s) => {
                        const selected = s.seasonKey === selectedSeason?.seasonKey;
                        return (
                            <TouchableOpacity
                                key={s.seasonKey}
                                style={[styles.dropdownItem, selected && styles.dropdownItemActive]}
                                onPress={() => pickSeason(s.seasonKey)}
                            >
                                <Text
                                    style={[
                                        styles.dropdownItemText,
                                        selected && styles.dropdownItemTextActive,
                                    ]}
                                >
                                    {s.label}
                                </Text>
                                {selected && (
                                    <Ionicons name="checkmark" size={16} color={ProfileTheme.colors.neonGreen} />
                                )}
                            </TouchableOpacity>
                        );
                    })}
                </View>
            )}

            {/* Season statistics */}
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

            {/* Trend chart */}
            {career.trend.length > 1 && (
                <>
                    <Text style={styles.heading}>{pc.goalsAssistsTrend}</Text>
                    <TrendChart career={career} labels={pc} />
                </>
            )}

            {/* Per competition */}
            {selectedSeason && selectedSeason.competitions.length > 0 && (
                <>
                    <Text style={styles.heading}>{pc.perCompetition}</Text>
                    {selectedSeason.competitions.map((c, idx) => (
                        <View key={`${c.competitionId ?? c.competitionName}-${idx}`} style={styles.compCard}>
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
                                        <Ionicons name="trophy-outline" size={14} color={ProfileTheme.colors.textTertiary} />
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
                    <View style={[styles.legendDot, { backgroundColor: ProfileTheme.colors.neonPurple }]} />
                    <Text style={styles.legendText}>{labels.goals}</Text>
                </View>
                <View style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: ProfileTheme.colors.neonBlue }]} />
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
                                fill={ProfileTheme.colors.neonPurple}
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
                                fill={ProfileTheme.colors.neonBlue}
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
        backgroundColor: ProfileTheme.colors.neonPurple,
    },
    sectionLabel: { color: ProfileTheme.colors.textSecondary, fontSize: 13, fontWeight: '600' },

    selector: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: CARD_BG,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    selectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    selectorHint: { color: ProfileTheme.colors.textTertiary, fontSize: 11 },
    selectorValue: { color: '#fff', fontSize: 17, fontWeight: '800' },
    dropdown: {
        marginTop: 6,
        backgroundColor: CARD_BG,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: CARD_BORDER,
    },
    dropdownItemActive: { backgroundColor: 'rgba(139,92,246,0.14)' },
    dropdownItemText: { color: ProfileTheme.colors.textSecondary, fontSize: 15 },
    dropdownItemTextActive: { color: '#fff', fontWeight: '700' },

    heading: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 12 },

    chartCard: {
        backgroundColor: CARD_BG,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        padding: 14,
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: ProfileTheme.colors.textSecondary, fontSize: 12 },
    legendAll: { marginLeft: 'auto', color: ProfileTheme.colors.textTertiary, fontSize: 11 },

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
        backgroundColor: ProfileTheme.colors.glassMedium,
        alignItems: 'center',
        justifyContent: 'center',
    },
    compName: { color: '#fff', fontSize: 14, fontWeight: '700', flex: 1 },
    ratingPill: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        backgroundColor: 'rgba(255,215,0,0.15)',
    },
    ratingPillText: { color: ProfileTheme.colors.gold, fontSize: 12, fontWeight: '800' },
    compStatsRow: { flexDirection: 'row', justifyContent: 'space-between' },
    compStat: { alignItems: 'center', flex: 1 },
    compStatValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
    compStatLabel: { color: ProfileTheme.colors.textTertiary, fontSize: 11, marginTop: 2 },

    compTabScroll: { marginBottom: 12, marginHorizontal: -4 },
    compTabRow: { flexDirection: 'row', gap: 8, paddingHorizontal: 4 },
    compTab: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: CARD_BORDER,
        backgroundColor: CARD_BG,
        maxWidth: 180,
    },
    compTabActive: {
        borderColor: ProfileTheme.colors.neonPurple,
        backgroundColor: 'rgba(139,92,246,0.18)',
    },
    compTabLogo: { width: 20, height: 20 },
    compTabText: { color: ProfileTheme.colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    compTabTextActive: { color: '#fff' },
});
