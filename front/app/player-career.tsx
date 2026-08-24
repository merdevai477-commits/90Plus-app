import { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Animated,
    StatusBar,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import Svg, { Rect, Line, Text as SvgText } from 'react-native-svg';
import ApiFootballService, {
    type Player365Career,
    type Player365CareerHighlightCompetition,
    type Player365CareerSeason,
} from '../services/apiFootball';
import { ProfileTheme } from '../constants/ProfileTheme';
import { scores365AthletePhotoCandidates, toFullscreenPhotoUrl, with365ImageSize } from '../utils/scores365AthletePhoto';
import ImageViewerModal from '../components/common/ImageViewerModal';
import { fetch365PlayerCareerClient } from '../utils/scores365PlayerCareerClient';
import {
    PlayerSeasonStatsCard,
    parsePlayerStatNumber,
} from '../components/player/PlayerSeasonStatsCard';
import { useTranslation } from '../src/i18n';
import { logger } from '../utils/logger';

if (
    Platform.OS === 'android' &&
    UIManager.setLayoutAnimationEnabledExperimental
) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

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
    const insets = useSafeAreaInsets();
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

    const athleteId = parseRouteInt(params.athleteId ?? params.id);

    const [career, setCareer] = useState<Player365Career | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const [selectedSeasonKey, setSelectedSeasonKey] = useState<string | null>(null);
    const [seasonPickerOpen, setSeasonPickerOpen] = useState(false);
    const [highlightCompId, setHighlightCompId] = useState<number | null>(null);
    const [photoViewerOpen, setPhotoViewerOpen] = useState(false);
    const [photoCandidateIndex, setPhotoCandidateIndex] = useState(0);

    const fadeAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        let active = true;
        (async () => {
            if (!athleteId) {
                setError(true);
                setLoading(false);
                return;
            }
            try {
                logger.debug(`Loading 365 career for athlete ${athleteId}`);
                let data = await ApiFootballService.get365PlayerCareer(athleteId, language);
                if (!data?.seasons?.length) {
                    logger.warn('Backend career empty — using 365 direct fallback');
                    data = await fetch365PlayerCareerClient(athleteId, language);
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
    }, [athleteId, language]);

    useEffect(() => {
        if (!loading) {
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 400,
                useNativeDriver: true,
            }).start();
        }
    }, [loading, fadeAnim]);

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
        return scores365AthletePhotoCandidates(athleteId, preferred, 80);
    }, [athleteId, career?.profile.imageUrl, params.photo]);

    useEffect(() => {
        setPhotoCandidateIndex(0);
    }, [athleteId, photoCandidates.join('|')]);

    const photoUri = photoCandidates[photoCandidateIndex];
    const avatarUri = photoUri ? with365ImageSize(photoUri, 80) ?? photoUri : undefined;
    const photoFailed = photoCandidateIndex >= photoCandidates.length;

    useEffect(() => {
        if (avatarUri) {
            ExpoImage.prefetch(avatarUri).catch(() => undefined);
        }
    }, [avatarUri]);

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

    if (loading) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="light-content" />
                <ActivityIndicator size="large" color={ProfileTheme.colors.neonGreen} />
                <Text style={styles.loadingText}>{pc.loading}</Text>
            </View>
        );
    }

    if (error || !career || !career.seasons.length) {
        return (
            <View style={styles.center}>
                <StatusBar barStyle="light-content" />
                <Ionicons name="cloud-offline-outline" size={48} color={ProfileTheme.colors.textTertiary} />
                <Text style={styles.loadingText}>{pc.noData}</Text>
                <TouchableOpacity style={styles.backPill} onPress={() => router.back()}>
                    <Text style={styles.backPillText}>{pc.goBack}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const profile = career.profile;

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
            >
                {/* Hero */}
                <LinearGradient
                    colors={['#241b3a', '#140e24', ProfileTheme.colors.deepBlack]}
                    style={[styles.hero, { paddingTop: insets.top + 12 }]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                >
                    <View style={styles.heroTopRow}>
                        <TouchableOpacity
                            style={styles.iconBtn}
                            onPress={() => router.back()}
                            activeOpacity={0.7}
                        >
                            <Ionicons name="chevron-back" size={22} color="#fff" />
                        </TouchableOpacity>
                        {profile.jerseyNumber != null && (
                            <View style={styles.jerseyBadge}>
                                <Text style={styles.jerseyText}>#{profile.jerseyNumber}</Text>
                            </View>
                        )}
                    </View>

                    <Animated.View style={[styles.heroBody, { opacity: fadeAnim }]}>
                        <LinearGradient
                            colors={[ProfileTheme.colors.neonPurple, ProfileTheme.colors.neonBlue]}
                            style={styles.avatarRing}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.avatarInner}>
                                {avatarUri && !photoFailed ? (
                                    <TouchableOpacity
                                        onPress={() => setPhotoViewerOpen(true)}
                                        activeOpacity={0.85}
                                        accessibilityRole="imagebutton"
                                    >
                                        <ExpoImage
                                            source={{ uri: avatarUri }}
                                            style={styles.avatar}
                                            contentFit="cover"
                                            cachePolicy="memory-disk"
                                            recyclingKey={`career-${athleteId}-${photoCandidateIndex}`}
                                            priority="high"
                                            transition={0}
                                            onError={() => {
                                                setPhotoCandidateIndex((i) =>
                                                    i + 1 < photoCandidates.length
                                                        ? i + 1
                                                        : photoCandidates.length,
                                                );
                                            }}
                                        />
                                    </TouchableOpacity>
                                ) : (
                                    <Ionicons name="person" size={40} color={ProfileTheme.colors.textTertiary} />
                                )}
                            </View>
                        </LinearGradient>

                        <Text style={styles.heroName} numberOfLines={2}>
                            {profile.name}
                        </Text>
                        {!!profile.shortName && profile.shortName !== profile.name && (
                            <Text style={styles.heroSub}>{profile.shortName}</Text>
                        )}
                    </Animated.View>
                </LinearGradient>

                <View style={styles.body}>
                    {/* Identity cards */}
                    <View style={styles.identityRow}>
                        <IdentityCard
                            icon="football-outline"
                            label={pc.club}
                            value={profile.clubName || params.teamName || '—'}
                        />
                        <View style={styles.identityDivider} />
                        <IdentityCard
                            icon="flag-outline"
                            label={pc.country}
                            value={profile.nationality || '—'}
                        />
                        <View style={styles.identityDivider} />
                        <IdentityCard
                            icon="locate-outline"
                            label={pc.position}
                            value={profile.position || '—'}
                        />
                    </View>

                    {(profile.dateOfBirth || profile.height || (profile.transfers?.length ?? 0) > 0) ? (
                        <>
                            <View style={styles.sectionLabelRow}>
                                <View style={styles.sectionAccent} />
                                <Text style={styles.sectionLabel}>{pc.personalInfo}</Text>
                            </View>
                            <View style={styles.identityRow}>
                                {profile.dateOfBirth ? (
                                    <IdentityCard
                                        icon="calendar-outline"
                                        label={pc.dateOfBirth}
                                        value={profile.dateOfBirth}
                                    />
                                ) : null}
                                {profile.height ? (
                                    <>
                                        {profile.dateOfBirth ? <View style={styles.identityDivider} /> : null}
                                        <IdentityCard
                                            icon="resize-outline"
                                            label={pc.height}
                                            value={profile.height}
                                        />
                                    </>
                                ) : null}
                            </View>
                            {(profile.transfers?.length ?? 0) > 0 ? (
                                <View style={styles.transferList}>
                                    <Text style={styles.sectionLabel}>{pc.transfers}</Text>
                                    {profile.transfers!.slice(0, 8).map((tr, idx) => (
                                        <View key={`${tr.competitorId}-${tr.date}-${idx}`} style={styles.transferRow}>
                                            <Text style={styles.transferClub} numberOfLines={1}>
                                                {tr.competitorName || '—'}
                                            </Text>
                                            <Text style={styles.transferMeta} numberOfLines={1}>
                                                {[tr.date?.slice(0, 10), tr.transferTitle, tr.price]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </Text>
                                        </View>
                                    ))}
                                </View>
                            ) : null}
                        </>
                    ) : null}

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
            </ScrollView>
            <ImageViewerModal
                visible={photoViewerOpen && !!photoUri && !photoFailed}
                imageUrl={toFullscreenPhotoUrl(photoUri) || photoUri || ''}
                onClose={() => setPhotoViewerOpen(false)}
            />
        </View>
    );
}

function sumStat(season: Player365CareerSeason, key: 'yellowCards' | 'redCards'): number {
    return season.competitions.reduce((acc, c) => acc + (c[key] ?? 0), 0);
}

function IdentityCard({ icon, label, value }: { icon: any; label: string; value: string }) {
    return (
        <View style={styles.identityCard}>
            <Ionicons name={icon} size={18} color={ProfileTheme.colors.neonBlue} />
            <Text style={styles.identityValue} numberOfLines={1}>{value}</Text>
            <Text style={styles.identityLabel}>{label}</Text>
        </View>
    );
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
    container: { flex: 1, backgroundColor: ProfileTheme.colors.deepBlack },
    center: {
        flex: 1,
        backgroundColor: ProfileTheme.colors.deepBlack,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        padding: 24,
    },
    loadingText: { color: ProfileTheme.colors.textSecondary, fontSize: 14 },
    backPill: {
        marginTop: 8,
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 999,
        backgroundColor: ProfileTheme.colors.glassMedium,
    },
    backPillText: { color: '#fff', fontWeight: '700' },

    hero: { paddingHorizontal: 20, paddingBottom: 24 },
    heroTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    iconBtn: {
        width: 38,
        height: 38,
        borderRadius: 19,
        backgroundColor: 'rgba(0,0,0,0.35)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    jerseyBadge: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(142,84,233,0.6)',
        backgroundColor: 'rgba(142,84,233,0.18)',
    },
    jerseyText: { color: '#fff', fontWeight: '800', fontSize: 13 },
    heroBody: { alignItems: 'center', marginTop: 8 },
    avatarRing: {
        width: 104,
        height: 104,
        borderRadius: 52,
        padding: 3,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: ProfileTheme.colors.neonPurple,
        shadowOpacity: 0.8,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
    },
    avatarInner: {
        width: '100%',
        height: '100%',
        borderRadius: 50,
        backgroundColor: ProfileTheme.colors.surfaceElevated,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
    },
    avatar: { width: '100%', height: '100%' },
    heroName: {
        color: '#fff',
        fontSize: 26,
        fontWeight: '800',
        marginTop: 14,
        textAlign: 'center',
    },
    heroSub: { color: ProfileTheme.colors.textSecondary, fontSize: 13, marginTop: 2 },

    body: { paddingHorizontal: 16, marginTop: -8 },

    identityRow: {
        flexDirection: 'row',
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        paddingVertical: 16,
        marginBottom: 20,
    },
    identityCard: { flex: 1, alignItems: 'center', gap: 4, paddingHorizontal: 4 },
    identityDivider: { width: 1, backgroundColor: ProfileTheme.colors.borderSoft },
    identityValue: { color: '#fff', fontSize: 13, fontWeight: '700', textAlign: 'center' },
    identityLabel: { color: ProfileTheme.colors.textTertiary, fontSize: 11 },

    sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
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
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    selectorLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    selectorHint: { color: ProfileTheme.colors.textTertiary, fontSize: 11 },
    selectorValue: { color: '#fff', fontSize: 17, fontWeight: '800' },
    dropdown: {
        marginTop: 6,
        backgroundColor: ProfileTheme.colors.surfaceElevated,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        overflow: 'hidden',
    },
    dropdownItem: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: ProfileTheme.colors.borderSoft,
    },
    dropdownItemActive: { backgroundColor: 'rgba(142,84,233,0.12)' },
    dropdownItemText: { color: ProfileTheme.colors.textSecondary, fontSize: 15 },
    dropdownItemTextActive: { color: '#fff', fontWeight: '700' },

    heading: { color: '#fff', fontSize: 18, fontWeight: '800', marginTop: 24, marginBottom: 12 },

    chartCard: {
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        padding: 14,
    },
    legendRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: ProfileTheme.colors.textSecondary, fontSize: 12 },
    legendAll: { marginLeft: 'auto', color: ProfileTheme.colors.textTertiary, fontSize: 11 },

    compCard: {
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
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
        borderColor: ProfileTheme.colors.borderSoft,
        backgroundColor: ProfileTheme.colors.glass,
        maxWidth: 180,
    },
    compTabActive: {
        borderColor: ProfileTheme.colors.neonPurple,
        backgroundColor: 'rgba(142,84,233,0.18)',
    },
    compTabLogo: { width: 20, height: 20 },
    compTabText: { color: ProfileTheme.colors.textSecondary, fontSize: 12, fontWeight: '600', flexShrink: 1 },
    compTabTextActive: { color: '#fff' },

    highlightTopRow: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
        marginBottom: 4,
    },
    highlightTopCard: {
        width: '31%',
        minWidth: 96,
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        paddingVertical: 12,
        paddingHorizontal: 8,
        alignItems: 'center',
    },
    highlightTopValue: { color: '#fff', fontSize: 18, fontWeight: '900' },
    highlightTopLabel: {
        color: ProfileTheme.colors.textTertiary,
        fontSize: 10,
        marginTop: 4,
        textAlign: 'center',
    },

    detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    detailCell: {
        width: '48%',
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        paddingVertical: 10,
        paddingHorizontal: 10,
    },
    detailValue: { color: '#fff', fontSize: 16, fontWeight: '800' },
    detailLabel: { color: ProfileTheme.colors.textTertiary, fontSize: 11, marginTop: 4 },
    transferList: { marginTop: 12, gap: 8 },
    transferRow: {
        backgroundColor: ProfileTheme.colors.glass,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: ProfileTheme.colors.borderSoft,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    transferClub: { color: '#fff', fontSize: 14, fontWeight: '700' },
    transferMeta: { color: ProfileTheme.colors.textTertiary, fontSize: 12, marginTop: 2 },
});
