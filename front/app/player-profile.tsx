import { useState, useEffect, useRef, useMemo } from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
    ScrollView,
    ActivityIndicator,
    Animated,
    StatusBar,
    RefreshControl,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ApiFootballService, { type Player365Career } from '../services/apiFootball';
import { logger } from '../utils/logger';
import PlayerAvatar from '../components/common/PlayerAvatar';
import ImageViewerModal from '../components/common/ImageViewerModal';
import TeamBadge from '../components/common/TeamBadge';
import { useTranslation } from '../src/i18n';
import type { Language } from '../src/i18n';
import { localeWithLatinNumerals } from '../src/i18n/latinDigits';
import { getTeamDisplayName, getLeagueDisplayName, getLocalizedStatType } from '../utils/i18nHelpers';
import { Image as ExpoImage } from 'expo-image';
import LeagueIcon from '../components/common/LeagueIcon';
import {
  getFootballSeasonYear,
  getPlayerLeagueStats,
  playerPhotoCandidates,
  statNum,
  sumSeasonTotals,
  teamLogoUrl,
  type PlayerStatRow,
} from '../utils/playerStatsAggregate';
import { preferScores365AthletesPhotoUrl, toFullscreenPhotoUrl, with365ImageSize } from '../utils/scores365AthletePhoto';
import { getCountryFlagUri } from '../utils/countryFlagUri';
import { useAppFont } from '../utils/fontSetup';
import {
    PlayerProfileHeader,
    PlayerProfileStatus,
    SectionHeader,
} from '../components/PlayerProfile/PlayerProfileView';
import { PP_ICON, PP_STADIUM } from '../components/PlayerProfile/assets';
import { PP_COLORS as B, ratingTone } from '../components/PlayerProfile/theme';

// Cache key prefix for player data
const PLAYER_CACHE_PREFIX = 'player_cache_';
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours
const CACHE_TTL_FROM_MATCH_MS = 5 * 60 * 1000; // after a live match, refresh stats within 5m
const BACKGROUND_REFRESH_MS = 15 * 60 * 1000; // skip network if cache is fresher than 15m

const EMPTY_STAT_ROW: PlayerData['statistics'][0] = {
    team: { id: 0, name: '', logo: '' },
    league: { id: 0, name: '', country: '', logo: '', season: 0 },
    games: { appearences: null, lineups: null, minutes: null, position: null, rating: null, captain: null },
    goals: { total: null, assists: null, saves: null, conceded: null },
    cards: { yellow: null, red: null },
    passes: { total: null, key: null, accuracy: null },
    shots: { total: null, on: null },
    tackles: { total: null, blocks: null, interceptions: null },
    dribbles: { attempts: null, success: null },
};

function buildShellFromParams(params: PlayerParams, playerId: number, teamId?: number): PlayerData | null {
    if (!playerId || !params.name?.trim()) return null;
    const season = params.season ? parseInt(params.season, 10) : getFootballSeasonYear();
    const statRow = params.teamName
        ? {
            ...EMPTY_STAT_ROW,
            team: {
                id: teamId ?? 0,
                name: params.teamName,
                logo: params.teamLogo || '',
            },
            league: { ...EMPTY_STAT_ROW.league, season },
        }
        : null;
    return {
        player: {
            id: playerId,
            name: params.name,
            firstname: null,
            lastname: null,
            age: null,
            birth: { date: null, place: null, country: null },
            nationality: null,
            height: null,
            weight: null,
            injured: false,
            photo: params.photo || null,
            foot: null,
        },
        statistics: statRow ? [statRow] : [],
    };
}

function playerCacheKey(id: number, season: number): string {
    return `${PLAYER_CACHE_PREFIX}${id}_${season}`;
}

interface PlayerParams {
    id: string;
    name?: string;
    photo?: string;
    teamName?: string;
    teamLogo?: string;
    teamColor?: string;
    teamId?: string;
    season?: string;
    fresh?: string;
    fixtureId?: string;
    athleteId?: string;
    dataSource?: '365' | 'api' | string;
}

interface MatchReport365 {
    athleteId: number;
    gameId: number;
    name: string;
    shortName: string;
    jerseyNumber: number | null;
    position: string | null;
    formation: string | null;
    imageUrl: string | null;
    stats: unknown[];
    chartEvents: unknown[];
}

function format365StatEntry(
  raw: unknown,
  language: Language,
): { label: string; value: string } | null {
    if (!raw || typeof raw !== 'object') return null;
    const o = raw as Record<string, unknown>;
    const rawLabel =
        (typeof o.name === 'string' && o.name) ||
        (typeof o.shortName === 'string' && o.shortName) ||
        (typeof o.typeName === 'string' && o.typeName) ||
        (o.type != null ? `#${String(o.type)}` : null);
    const label = rawLabel ? getLocalizedStatType(rawLabel, language) || rawLabel : null;
    const rawValue = o.value ?? o.val ?? o.statValue;
    const value = rawValue != null ? String(rawValue) : null;
    if (!label && !value) return null;
    return { label: label ?? 'Stat', value: value ?? '—' };
}

function format365ChartEvent(raw: unknown): string | null {
    if (!raw || typeof raw !== 'object') return null;
    const e = raw as Record<string, unknown>;
    const minute = e.minute ?? e.gameTime ?? e.time;
    const type = e.typeName ?? e.eventTypeName ?? e.type ?? e.name;
    if (minute == null && type == null) return null;
    const minStr = minute != null ? `${minute}'` : '';
    const typeStr = type != null ? String(type) : 'Event';
    return minStr ? `${minStr} · ${typeStr}` : typeStr;
}

interface PlayerData {
    player: {
        id: number;
        name: string;
        firstname: string | null;
        lastname: string | null;
        age: number | null;
        birth: {
            date: string | null;
            place: string | null;
            country: string | null;
        };
        nationality: string | null;
        height: string | null;
        weight: string | null;
        injured: boolean;
        photo: string | null;
        foot?: string | null;
    };
    statistics: Array<{
        team: { id: number; name: string; logo: string };
        league: { id: number; name: string; country: string; logo: string; season: number };
        games: { 
            appearences: number | null; 
            lineups: number | null; 
            minutes: number | null; 
            position: string | null; 
            rating: string | null;
            captain: boolean | null;
        };
        goals: { 
            total: number | null; 
            assists: number | null; 
            saves: number | null;
            conceded: number | null;
        };
        cards: { yellow: number | null; red: number | null };
        passes: { total: number | null; key: number | null; accuracy: number | null };
        shots: { total: number | null; on: number | null };
        tackles: { total: number | null; blocks: number | null; interceptions: number | null };
        dribbles: { attempts: number | null; success: number | null };
        penalty?: {
            won: number | null;
            commited: number | null;
            scored: number | null;
            missed: number | null;
            saved: number | null;
        };
    }>;
}

// Team colors mapping (common teams) - using app theme colors
const TEAM_COLORS: { [key: string]: readonly [string, string, ...string[]] } = {
    'Liverpool': ['#C8102E', '#8B0000'],
    'Manchester City': ['#6CABDD', '#1C2C5B'],
    'Manchester United': ['#DA291C', '#8B0000'],
    'Chelsea': ['#034694', '#001489'],
    'Arsenal': ['#EF0107', '#9C824A'],
    'Barcelona': ['#A50044', '#004D98'],
    'Real Madrid': ['#FEBE10', '#00529F'],
    'Bayern Munich': ['#DC052D', '#8B0000'],
    'Paris Saint-Germain': ['#004170', '#DA291C'],
    'Juventus': ['#000000', '#FFFFFF'],
    'Al Ahly': ['#C8102E', '#8B0000'],
    'Zamalek': ['#FFFFFF', '#000000'],
    'default': [B.primary, B.primaryDeep],
};

const getTeamColors = (teamName: string): readonly [string, string, ...string[]] => {
    for (const [team, colors] of Object.entries(TEAM_COLORS)) {
        if (teamName.toLowerCase().includes(team.toLowerCase())) {
            return colors;
        }
    }
    return TEAM_COLORS.default;
};

// Helper to format date
const formatDate = (dateString: string | null, language: Language): string => {
    if (!dateString) return 'N/A';
    try {
        const date = new Date(dateString);
        const locale = localeWithLatinNumerals(language);
        return date.toLocaleDateString(locale, { year: 'numeric', month: 'long', day: 'numeric' });
    } catch {
        return dateString;
    }
};

function formatPreferredFoot(
    statistics: PlayerData['statistics'],
    labels: Record<string, string>,
    profileFoot?: string | null,
): string | null {
    if (profileFoot) {
        const f = profileFoot.toLowerCase();
        if (f.includes('left')) return labels.footLeft;
        if (f.includes('right')) return labels.footRight;
        if (f.includes('both')) return labels.footBoth;
    }

    if (!statistics || statistics.length === 0) return null;

    const stats = statistics[0];
    const goals = stats.goals as { by?: { right?: number; left?: number } };

    if (goals?.by?.right != null && goals?.by?.left != null) {
        const right = goals.by.right || 0;
        const left = goals.by.left || 0;
        if (right > left) return labels.footRight;
        if (left > right) return labels.footLeft;
        return labels.footBoth;
    }

    return null;
}

function PlayerHeroPhoto({
    playerId,
    photo,
    name,
    position,
    colors,
    photoSource,
}: {
    playerId: number;
    photo?: string | null;
    name: string;
    position: string | null;
    colors: readonly [string, string, ...string[]];
    photoSource?: '365' | 'api';
}) {
    const candidates = useMemo(
        () => playerPhotoCandidates(playerId, photo, photoSource ? { source: photoSource } : undefined),
        [playerId, photo, photoSource],
    );
    const [uriIndex, setUriIndex] = useState(0);

    useEffect(() => {
        setUriIndex(0);
    }, [playerId, photo]);

    const uri = candidates[uriIndex] ?? '';
    const displayUri = with365ImageSize(uri, 160) ?? uri;
    const [viewerOpen, setViewerOpen] = useState(false);
    const viewerUrl = toFullscreenPhotoUrl(uri) ?? uri;
    const hasPhoto = !!uri && uriIndex < candidates.length;

    return (
        <>
            <LinearGradient
                colors={[B.primarySoft, B.primary, B.primaryDeep]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={heroPhotoStyles.ring}
            >
                {hasPhoto ? (
                    <TouchableOpacity
                        style={heroPhotoStyles.circle}
                        onPress={() => setViewerOpen(true)}
                        activeOpacity={0.85}
                        accessibilityRole="imagebutton"
                    >
                        <ExpoImage
                            source={{ uri: displayUri }}
                            style={heroPhotoStyles.image}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            recyclingKey={`player-${playerId}-${uriIndex}`}
                            priority="high"
                            transition={0}
                            onError={() => {
                                if (uriIndex + 1 < candidates.length) {
                                    setUriIndex((i) => i + 1);
                                } else {
                                    setUriIndex(candidates.length);
                                }
                            }}
                        />
                    </TouchableOpacity>
                ) : (
                    <View style={heroPhotoStyles.circle}>
                        <PlayerAvatar name={name} position={position} size={98} colors={colors} />
                    </View>
                )}
            </LinearGradient>
            {hasPhoto ? (
                <ImageViewerModal
                    visible={viewerOpen}
                    imageUrl={viewerUrl}
                    onClose={() => setViewerOpen(false)}
                />
            ) : null}
        </>
    );
}

const heroPhotoStyles = StyleSheet.create({
    ring: {
        width: 106,
        height: 106,
        borderRadius: 53,
        padding: 3,
        shadowColor: B.primary,
        shadowOpacity: 0.7,
        shadowRadius: 16,
        shadowOffset: { width: 0, height: 0 },
        elevation: 10,
    },
    circle: {
        flex: 1,
        borderRadius: 50,
        overflow: 'hidden',
        backgroundColor: B.card,
        alignItems: 'center',
        justifyContent: 'center',
    },
    image: {
        width: '100%',
        height: '100%',
    },
});

function MiniStat({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
    const fontBold = useAppFont(700);
    const fontReg = useAppFont(400);
    return (
        <View style={miniStatStyles.box}>
            <Text style={[miniStatStyles.value, { fontFamily: fontBold }, tone ? { color: tone } : null]}>
                {value}
            </Text>
            <Text style={[miniStatStyles.label, { fontFamily: fontReg }]} numberOfLines={1}>
                {label}
            </Text>
        </View>
    );
}

function LeagueStatCard({
    stat,
    language,
    labels,
    teamColor,
    rtl,
}: {
    stat: PlayerStatRow;
    language: Language;
    labels: Record<string, string>;
    teamColor: string;
    rtl: boolean;
}) {
    const fontBold = useAppFont(700);
    const fontReg = useAppFont(400);
    const row = rtl ? 'row-reverse' : 'row';
    const textAlign = rtl ? 'right' : 'left';
    const leagueName = getLeagueDisplayName(
        stat.league.name,
        language,
        stat.league.id,
        stat.league.country,
    );
    const seasonLabel = stat.league.season
        ? `${stat.league.season}/${stat.league.season + 1}`
        : '';
    const ratingNum = stat.games.rating ? parseFloat(stat.games.rating) : NaN;
    const rating = Number.isFinite(ratingNum) ? ratingNum.toFixed(1) : '—';
    const details: { icon: keyof typeof Ionicons.glyphMap; text: string }[] = [
        { icon: 'time-outline', text: `${statNum(stat.games.minutes).toLocaleString('en-US')} ${labels.minutesPlayed}` },
    ];
    if (stat.games.lineups != null) {
        details.push({ icon: 'shirt-outline', text: `${statNum(stat.games.lineups)} ${labels.lineups}` });
    }
    if (stat.games.position) details.push({ icon: 'locate-outline', text: stat.games.position });
    if (stat.passes?.accuracy != null) {
        details.push({ icon: 'git-network-outline', text: `${labels.passAccuracy}: ${stat.passes.accuracy}%` });
    }
    if (statNum(stat.shots?.on) > 0) {
        details.push({ icon: 'radio-button-on-outline', text: `${labels.shotsOnTarget}: ${statNum(stat.shots?.on)}` });
    }
    if (statNum(stat.tackles?.total) > 0) {
        details.push({ icon: 'shield-outline', text: `${labels.tackles}: ${statNum(stat.tackles?.total)}` });
    }
    if (statNum(stat.dribbles?.success) > 0) {
        details.push({ icon: 'flash-outline', text: `${labels.successfulDribbles}: ${statNum(stat.dribbles?.success)}` });
    }

    return (
        <View style={leagueCardStyles.card}>
            <View style={[leagueCardStyles.header, { flexDirection: row }]}>
                <LeagueIcon
                    name={stat.league.name}
                    logo={stat.league.logo}
                    leagueId={stat.league.id}
                    size={40}
                    color={teamColor}
                />
                <View style={leagueCardStyles.headerText}>
                    <Text style={[leagueCardStyles.leagueName, { fontFamily: fontBold, textAlign }]} numberOfLines={2}>
                        {leagueName}
                    </Text>
                    <Text style={[leagueCardStyles.leagueMeta, { fontFamily: fontReg, textAlign }]} numberOfLines={1}>
                        {stat.league.country}{seasonLabel ? ` • ${seasonLabel}` : ''}
                    </Text>
                </View>
                <View style={leagueCardStyles.teamChip}>
                    <TeamBadge
                        name={stat.team.name}
                        color={teamColor}
                        size={28}
                        logo={stat.team.logo}
                    />
                    <Text style={[leagueCardStyles.teamName, { fontFamily: fontReg }]} numberOfLines={1}>
                        {getTeamDisplayName(stat.team.name, language)}
                    </Text>
                </View>
            </View>

            <View style={[leagueCardStyles.statsRow, { flexDirection: row }]}>
                <MiniStat label={labels.matches} value={statNum(stat.games.appearences)} />
                <View style={leagueCardStyles.statsDivider} />
                <MiniStat label={labels.goals} value={statNum(stat.goals.total)} />
                <View style={leagueCardStyles.statsDivider} />
                <MiniStat label={labels.assists} value={statNum(stat.goals.assists)} />
                <View style={leagueCardStyles.statsDivider} />
                <MiniStat
                    label={labels.rating}
                    value={rating}
                    tone={Number.isFinite(ratingNum) ? ratingTone(ratingNum) : undefined}
                />
            </View>

            <View style={[leagueCardStyles.detailsRow, { flexDirection: row }]}>
                {details.map((d) => (
                    <View key={d.text} style={[leagueCardStyles.detailChip, { flexDirection: row }]}>
                        <Ionicons name={d.icon} size={13} color={B.primarySoft} />
                        <Text style={[leagueCardStyles.detailText, { fontFamily: fontReg }]}>{d.text}</Text>
                    </View>
                ))}
                {statNum(stat.cards.yellow) > 0 && (
                    <View style={[leagueCardStyles.detailChip, { flexDirection: row }]}>
                        <View style={[leagueCardStyles.cardDot, { backgroundColor: '#FACC15' }]} />
                        <Text style={[leagueCardStyles.detailText, { fontFamily: fontReg }]}>
                            {statNum(stat.cards.yellow)} {labels.yellowCards}
                        </Text>
                    </View>
                )}
                {statNum(stat.cards.red) > 0 && (
                    <View style={[leagueCardStyles.detailChip, { flexDirection: row }]}>
                        <View style={[leagueCardStyles.cardDot, { backgroundColor: '#EF4444' }]} />
                        <Text style={[leagueCardStyles.detailText, { fontFamily: fontReg }]}>
                            {statNum(stat.cards.red)} {labels.redCards}
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}

const miniStatStyles = StyleSheet.create({
    box: { flex: 1, alignItems: 'center', paddingVertical: 12, paddingHorizontal: 2 },
    value: { fontSize: 22, color: '#fff' },
    label: { fontSize: 11, color: B.muted, marginTop: 4, textAlign: 'center' },
});

const leagueCardStyles = StyleSheet.create({
    card: {
        backgroundColor: B.card,
        borderRadius: 16,
        padding: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: B.border,
    },
    header: { alignItems: 'center', marginBottom: 12, gap: 12 },
    headerText: { flex: 1 },
    leagueName: { fontSize: 15, color: '#fff' },
    leagueMeta: { fontSize: 12, color: B.muted, marginTop: 2 },
    teamChip: { alignItems: 'center', maxWidth: 72, gap: 4 },
    teamName: { fontSize: 10, color: B.muted, textAlign: 'center' },
    statsRow: {
        backgroundColor: 'rgba(139,92,246,0.06)',
        borderRadius: 12,
        borderWidth: 1,
        borderColor: B.divider,
    },
    statsDivider: { width: 1, backgroundColor: B.divider, marginVertical: 10 },
    detailsRow: { flexWrap: 'wrap', gap: 8, marginTop: 12 },
    detailChip: {
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 999,
        backgroundColor: 'rgba(139,92,246,0.08)',
        borderWidth: 1,
        borderColor: B.divider,
    },
    detailText: { fontSize: 11, color: B.soft },
    cardDot: { width: 7, height: 10, borderRadius: 1.5 },
});

export default function PlayerProfileScreen() {
    const router = useRouter();
    const params = useLocalSearchParams() as unknown as PlayerParams;
    const insets = useSafeAreaInsets();
    const { t, language } = useTranslation();

    const playerId = parseInt(params.id || '0');
    const contextAthleteId = parseInt(params.athleteId || params.id || '0', 10);
    const contextTeamId = params.teamId ? parseInt(params.teamId, 10) : undefined;
    const contextSeason = params.season ? parseInt(params.season, 10) : undefined;
    const contextFixtureId = params.fixtureId ? parseInt(params.fixtureId, 10) : undefined;
    const is365Source = params.dataSource === '365';
    const seasonYear = contextSeason ?? getFootballSeasonYear();
    const forceFreshStats = params.fresh === '1' || params.fresh === 'true';
    const routeShell = useMemo(
        () => buildShellFromParams(params, playerId, contextTeamId),
        [
            playerId,
            contextTeamId,
            params.id,
            params.name,
            params.photo,
            params.teamName,
            params.teamLogo,
            params.season,
            params.dataSource,
            params.fixtureId,
            params.athleteId,
        ],
    );

    const [player, setPlayer] = useState<PlayerData | null>(routeShell);
    const [loading, setLoading] = useState(!routeShell);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [matchReport365, setMatchReport365] = useState<MatchReport365 | null>(null);
    const [career365, setCareer365] = useState<Player365Career | null>(null);
    const [athleteId365, setAthleteId365] = useState(contextAthleteId);

    const fadeAnim = useRef(new Animated.Value(0)).current;
    const slideAnim = useRef(new Animated.Value(50)).current;

    useEffect(() => {
        setPlayer(routeShell);
        setLoading(!routeShell);
        setError(null);
        setAthleteId365(contextAthleteId);
    }, [playerId, routeShell, contextAthleteId]);

    useEffect(() => {
        loadPlayerData();

        // Entrance animations
        Animated.parallel([
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 600,
                useNativeDriver: true,
            }),
            Animated.spring(slideAnim, {
                toValue: 0,
                tension: 50,
                friction: 8,
                useNativeDriver: true,
            }),
        ]).start();
    }, [playerId, contextSeason, contextTeamId, seasonYear, forceFreshStats, is365Source, contextFixtureId]);

    /** Match report, bio and career in one round trip instead of three chained ones. */
    const fetch365PlayerBundle = async (athleteId: number) => {
        const [report, info, career] = await Promise.all([
            contextFixtureId
                ? ApiFootballService.get365PlayerMatchReport(contextFixtureId, athleteId)
                : Promise.resolve(null),
            ApiFootballService.get365PlayerInfo(athleteId),
            ApiFootballService.get365PlayerCareer(athleteId, language),
        ]);
        return { report, info, career };
    };

    const load365PlayerData = async () => {
        if (!contextAthleteId) {
            setError(t.playerProfile.playerNotFound);
            setLoading(false);
            return;
        }

        try {
            setLoading(true);
            setError(null);

            let athleteId = contextAthleteId;
            let { report, info, career } = await fetch365PlayerBundle(athleteId);

            // Older cached lineups handed us a per-game roster id, which no 365
            // player endpoint accepts — recover the real athlete by name.
            if (!report && !info && !career && params.name) {
                const recovered = await ApiFootballService.resolve365AthleteIdByName(
                    params.name,
                    params.teamName,
                );
                if (recovered && recovered !== athleteId) {
                    athleteId = recovered;
                    ({ report, info, career } = await fetch365PlayerBundle(athleteId));
                }
            }
            setAthleteId365(athleteId);

            // Arabic match reports are occasionally published without stat rows.
            if (
                contextFixtureId &&
                (!report || (report.stats?.length ?? 0) === 0) &&
                language === 'ar'
            ) {
                const english = await ApiFootballService.get365PlayerMatchReport(
                    contextFixtureId,
                    athleteId,
                    'en',
                );
                if (english && (english.stats?.length ?? 0) > 0) report = english;
            }

            setMatchReport365(report);
            setCareer365(career);

            const base =
                (report &&
                    buildShellFromParams(
                        { ...params, id: String(report.athleteId), name: report.name },
                        report.athleteId,
                        contextTeamId,
                    )) ||
                player ||
                buildShellFromParams(params, athleteId, contextTeamId);

            if (!base) {
                if (!player) setError(t.playerProfile.playerNotFound);
                return;
            }

            const infoPhoto =
                (typeof info?.photo === 'string' && preferScores365AthletesPhotoUrl(info.photo)) ||
                (typeof info?.imageUrl === 'string' &&
                    preferScores365AthletesPhotoUrl(info.imageUrl)) ||
                undefined;
            const reportPhoto = report
                ? preferScores365AthletesPhotoUrl(
                      report.imageUrl ?? params.photo ?? base.player.photo,
                  ) ??
                  report.imageUrl ??
                  params.photo
                : undefined;
            const position =
                report?.position ||
                (typeof info?.position === 'string' ? info.position : undefined);

            setPlayer({
                ...base,
                player: {
                    ...base.player,
                    name: report?.name || base.player.name,
                    photo:
                        reportPhoto ||
                        infoPhoto ||
                        preferScores365AthletesPhotoUrl(career?.profile.imageUrl) ||
                        base.player.photo,
                    birth: {
                        ...base.player.birth,
                        date: career?.profile.dateOfBirth || base.player.birth?.date,
                    },
                    height: career?.profile.height || base.player.height,
                    nationality:
                        career?.profile.nationality ||
                        (typeof info?.nationality === 'string' ? info.nationality : null) ||
                        base.player.nationality,
                },
                statistics: base.statistics.map((s) => ({
                    ...s,
                    team: {
                        ...s.team,
                        name: (typeof info?.club === 'string' && info.club) || s.team.name,
                    },
                    games: { ...s.games, position: position || s.games.position },
                })),
            });
        } catch (err: unknown) {
            logger.error('Failed to load 365 player report:', err);
            if (!player) {
                setError((err as Error)?.message || t.playerProfile.loadFailed);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const loadPlayerData = async (forceRefresh = false) => {
        if (is365Source) {
            await load365PlayerData();
            return;
        }

        if (!playerId) {
            setError(t.playerProfile.invalidPlayerId ?? 'Invalid player ID');
            setLoading(false);
            return;
        }

        try {
            if (!forceRefresh && !player) {
                setLoading(true);
            }
            setError(null);

            const skipLocalCache = forceRefresh || forceFreshStats;
            const localCacheMaxAge = forceFreshStats ? CACHE_TTL_FROM_MATCH_MS : BACKGROUND_REFRESH_MS;

            if (!skipLocalCache) {
                const cached = await getCachedPlayer(playerId, seasonYear);
                if (cached) {
                    setPlayer(cached);
                    setLoading(false);
                    await addToRecentlyViewed(cached.player);
                    const cacheAge = Date.now() - (await getCachedTimestamp(playerId, seasonYear) || 0);
                    if (cacheAge < localCacheMaxAge) {
                        return;
                    }
                    loadPlayerData(true).catch((err) => {
                        logger.warn('Background refresh failed:', err);
                    });
                    return;
                }
            }

            const seasonToFetch = seasonYear;
            logger.debug(`📡 Fetching player from API (season ${seasonToFetch}):`, playerId);
            const data = await ApiFootballService.getPlayerById(playerId, seasonToFetch, {
                fresh: skipLocalCache,
            });

            if (data && data.length > 0) {
                let playerData = data[0];

                if (!playerData.statistics || playerData.statistics.length === 0) {
                    logger.warn('⚠️ Player data has no statistics, trying previous season');
                    const previousSeasonData = await ApiFootballService.getPlayerById(
                        playerId,
                        seasonToFetch - 1,
                    );
                    if (previousSeasonData && previousSeasonData.length > 0) {
                        playerData = previousSeasonData[0];
                    }
                }

                setPlayer(playerData);
                await cachePlayer(playerId, seasonYear, playerData);
                await addToRecentlyViewed(playerData.player);
            } else if (!player) {
                setError(t.playerProfile.playerNotFound);
            }
        } catch (err: any) {
            logger.error('Failed to load player:', err);
            if (!player) {
                setError(err?.message || t.playerProfile.loadFailed);
            }
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    const onRefresh = async () => {
        setRefreshing(true);
        await loadPlayerData(true);
        setRefreshing(false);
    };

    const addToRecentlyViewed = async (player: any) => {
        try {
            const recentKey = 'recently_viewed_players';
            const existing = await AsyncStorage.getItem(recentKey);
            let players = existing ? JSON.parse(existing) : [];

            // Remove if already exists to move to top
            players = players.filter((p: any) => p.id !== player.id);

            // Add to top
            players.unshift({
                id: player.id,
                name: player.name,
                photo: player.photo,
                nationality: player.nationality
            });

            // Keep only last 10
            players = players.slice(0, 10);

            await AsyncStorage.setItem(recentKey, JSON.stringify(players));
        } catch (err) {
            logger.warn('Failed to update recently viewed:', err);
        }
    };

    const getCachedPlayer = async (id: number, season: number): Promise<PlayerData | null> => {
        try {
            const cached = await AsyncStorage.getItem(playerCacheKey(id, season));
            if (cached) {
                const { data, timestamp } = JSON.parse(cached);
                if (Date.now() - timestamp < CACHE_TTL) {
                    return data;
                }
            }
            // Legacy key without season — migrate once
            const legacy = await AsyncStorage.getItem(`${PLAYER_CACHE_PREFIX}${id}`);
            if (legacy) {
                const { data, timestamp } = JSON.parse(legacy);
                if (Date.now() - timestamp < CACHE_TTL) {
                    return data;
                }
            }
        } catch (err) {
            logger.warn('Cache read error:', err);
        }
        return null;
    };

    const getCachedTimestamp = async (id: number, season: number): Promise<number | null> => {
        try {
            const cached = await AsyncStorage.getItem(playerCacheKey(id, season));
            if (cached) {
                const { timestamp } = JSON.parse(cached);
                return timestamp;
            }
        } catch (err) {
            logger.warn('Cache timestamp read error:', err);
        }
        return null;
    };

    const cachePlayer = async (id: number, season: number, data: PlayerData): Promise<void> => {
        try {
            const { offlineDataService } = await import('../services/offlineDataService');
            await offlineDataService.storePlayerData(id, data);

            await AsyncStorage.setItem(
                playerCacheKey(id, season),
                JSON.stringify({ data, timestamp: Date.now() }),
            );
            logger.debug('✅ Cached player:', id, season);
        } catch (err) {
            logger.warn('Cache write error:', err);
        }
    };

    const displayPlayer = player ?? routeShell;
    const leagueStats = useMemo(
        () =>
            displayPlayer
                ? getPlayerLeagueStats(displayPlayer.statistics as PlayerStatRow[], {
                      season: seasonYear,
                      teamId: contextTeamId,
                  })
                : [],
        [displayPlayer, seasonYear, contextTeamId],
    );
    const seasonTotals = useMemo(() => sumSeasonTotals(leagueStats), [leagueStats]);
    const primaryPosition = matchReport365?.position ?? leagueStats[0]?.games?.position ?? null;
    const primaryTeam = leagueStats[0]?.team ?? (params.teamName ? { id: contextTeamId ?? 0, name: params.teamName, logo: params.teamLogo || '' } : null);
    const teamColors = useMemo(
        () => getTeamColors(primaryTeam?.name || params.teamName || ''),
        [primaryTeam?.name, params.teamName],
    );
    const preferredFoot = displayPlayer
        ? formatPreferredFoot(displayPlayer.statistics, t.playerProfile, displayPlayer.player.foot)
        : null;
    const pp = t.playerProfile;
    const rtl = language === 'ar';
    const fontBold = useAppFont(700);
    const fontSemi = useAppFont(600);
    const fontReg = useAppFont(400);

    const matchStats = useMemo(() => {
        type Row = { key: string; label: string; value: string; isTop: boolean; isRating: boolean };
        const rows: Row[] = [];
        (matchReport365?.stats ?? []).forEach((raw, idx) => {
            const formatted = format365StatEntry(raw, language);
            if (!formatted) return;
            const o = raw as Record<string, unknown>;
            const names = `${o.name ?? ''} ${o.shortName ?? ''} ${formatted.label}`.toLowerCase();
            rows.push({
                ...formatted,
                key: `${idx}-${formatted.label}`,
                isTop: o.isTop === true,
                isRating: /rating|تقييم/.test(names),
            });
        });
        const rating = rows.find((r) => r.isRating) ?? null;
        const rest = rows.filter((r) => r !== rating);
        const tops = rest.filter((r) => r.isTop);
        const featured = (tops.length >= 2 ? tops : rest).slice(0, 4);
        const list = rest.filter((r) => !featured.includes(r));
        const ratingNum = rating ? Number.parseFloat(rating.value) : NaN;
        return { rating: Number.isFinite(ratingNum) ? ratingNum : null, featured, list, total: rows.length };
    }, [matchReport365, language]);

    const matchEvents = useMemo(
        () =>
            (matchReport365?.chartEvents ?? [])
                .map(format365ChartEvent)
                .filter((line): line is string => !!line),
        [matchReport365],
    );

    const goBack = () => {
        if (router.canGoBack()) router.back();
        else router.replace('/(tabs)/matches' as never);
    };

    if (loading && !displayPlayer) {
        return <PlayerProfileStatus loading message={pp.loadingPlayer} onBack={goBack} />;
    }

    if (error && !displayPlayer && !loading) {
        return (
            <PlayerProfileStatus
                message={error || pp.playerNotFound}
                actionLabel={pp.goBack}
                onBack={goBack}
            />
        );
    }

    if (!displayPlayer) return null;

    const heroPlayer = displayPlayer.player;
    const nationalityFlagUri = heroPlayer.nationality
        ? getCountryFlagUri(heroPlayer.nationality, null, 80)
        : null;
    const row = rtl ? 'row-reverse' : 'row';
    const textAlign = rtl ? 'right' : 'left';
    const alignStart = rtl ? 'flex-end' : 'flex-start';
    const jerseyNumber = matchReport365?.jerseyNumber ?? career365?.profile.jerseyNumber ?? null;

    const openCareer = () =>
        router.push({
            pathname: '/player-career' as any,
            params: {
                athleteId: String(athleteId365),
                id: String(athleteId365),
                name: heroPlayer.name,
                photo: heroPlayer.photo ?? params.photo ?? '',
                teamName: params.teamName ?? '',
                teamLogo: params.teamLogo ?? '',
                teamId: params.teamId ?? '',
                dataSource: '365',
            },
        } as any);

    const chips: { key: string; icon?: number; text: string }[] = [];
    if (primaryPosition) chips.push({ key: 'pos', icon: PP_ICON.position, text: primaryPosition });
    if (is365Source && matchReport365?.formation) chips.push({ key: 'formation', icon: PP_ICON.court, text: matchReport365.formation });
    if (heroPlayer.age != null && heroPlayer.age > 0) chips.push({ key: 'age', icon: PP_ICON.cake, text: `${heroPlayer.age} ${pp.years}` });
    if (!is365Source) chips.push({ key: 'season', icon: PP_ICON.seasonStats, text: `${seasonYear}/${seasonYear + 1}` });

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <PlayerProfileHeader onBack={goBack} onBell={() => router.push('/notifications' as never)} />

            <ScrollView
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={onRefresh}
                        tintColor={B.primary}
                        colors={[B.primary]}
                    />
                }
                contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}
            >
                {/* Hero */}
                <View style={styles.hero}>
                    <ExpoImage source={PP_STADIUM} style={StyleSheet.absoluteFill} contentFit="cover" />
                    <LinearGradient
                        colors={['rgba(12,5,26,0.55)', 'rgba(12,5,26,0.88)', B.bg]}
                        locations={[0, 0.65, 1]}
                        style={StyleSheet.absoluteFill}
                    />
                    {jerseyNumber != null ? (
                        <Text
                            style={[styles.heroJersey, { fontFamily: fontBold }, rtl ? { left: 14 } : { right: 14 }]}
                            allowFontScaling={false}
                        >
                            {`#${jerseyNumber}`}
                        </Text>
                    ) : null}

                    <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
                        <View style={[styles.heroRow, { flexDirection: row }]}>
                            <View style={styles.photoWrap}>
                                <PlayerHeroPhoto
                                    key={playerId}
                                    playerId={playerId}
                                    photo={heroPlayer.photo ?? params.photo}
                                    name={heroPlayer.name}
                                    position={primaryPosition}
                                    colors={teamColors}
                                    photoSource={is365Source ? '365' : 'api'}
                                />
                                {matchStats.rating != null ? (
                                    <View style={[styles.ratingMedal, { backgroundColor: ratingTone(matchStats.rating) }]}>
                                        <Text style={[styles.ratingMedalText, { fontFamily: fontBold }]}>
                                            {matchStats.rating.toFixed(1)}
                                        </Text>
                                    </View>
                                ) : null}
                            </View>

                            <View style={[styles.heroInfo, { alignItems: alignStart }]}>
                                {heroPlayer.nationality ? (
                                    <View style={[styles.inlineRow, { flexDirection: row }]}>
                                        {nationalityFlagUri ? (
                                            <ExpoImage
                                                source={{ uri: nationalityFlagUri }}
                                                style={styles.flag}
                                                contentFit="cover"
                                                cachePolicy="memory-disk"
                                                transition={0}
                                            />
                                        ) : null}
                                        <Text style={[styles.heroMeta, { fontFamily: fontSemi }]} numberOfLines={1}>
                                            {heroPlayer.nationality}
                                        </Text>
                                    </View>
                                ) : null}
                                <View style={[styles.inlineRow, { flexDirection: row, marginTop: 4 }]}>
                                    <Text
                                        style={[styles.playerName, { fontFamily: fontBold, textAlign }]}
                                        numberOfLines={2}
                                    >
                                        {heroPlayer.name}
                                    </Text>
                                    <ExpoImage source={PP_ICON.verified} style={styles.verified} contentFit="contain" />
                                </View>
                                {heroPlayer.injured && (
                                    <View style={[styles.injuredBadge, { flexDirection: row }]}>
                                        <Ionicons name="medkit-outline" size={12} color="#fca5a5" />
                                        <Text style={[styles.injuredText, { fontFamily: fontBold }]}>{pp.injured}</Text>
                                    </View>
                                )}
                                {primaryTeam && (
                                    <View style={[styles.inlineRow, { flexDirection: row, marginTop: 6 }]}>
                                        <TeamBadge
                                            name={primaryTeam.name}
                                            color={teamColors[0]}
                                            size={24}
                                            logo={teamLogoUrl(primaryTeam.id, primaryTeam.logo)}
                                        />
                                        <Text style={[styles.heroTeamName, { fontFamily: fontSemi }]} numberOfLines={1}>
                                            {getTeamDisplayName(primaryTeam.name, language)}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </View>

                        {chips.length > 0 ? (
                            <View style={[styles.chipsRow, { flexDirection: row }]}>
                                {chips.map((c) => (
                                    <View key={c.key} style={[styles.chip, { flexDirection: row }]}>
                                        {c.icon != null ? (
                                            <ExpoImage source={c.icon} style={styles.chipIcon} contentFit="contain" />
                                        ) : null}
                                        <Text style={[styles.chipText, { fontFamily: fontSemi }]} numberOfLines={1}>
                                            {c.text}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        ) : null}

                        {is365Source && athleteId365 > 0 && (
                            <TouchableOpacity activeOpacity={0.85} style={styles.careerButtonWrap} onPress={openCareer}>
                                <LinearGradient
                                    colors={[B.primary, B.primaryDeep]}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 1 }}
                                    style={[styles.careerButton, { flexDirection: row }]}
                                >
                                    <ExpoImage source={PP_ICON.seasonStats} style={styles.chipIcon} contentFit="contain" />
                                    <Text style={[styles.careerButtonText, { fontFamily: fontBold }]}>{pp.viewFullCareer}</Text>
                                    <Ionicons name={rtl ? 'chevron-back' : 'chevron-forward'} size={16} color="#fff" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}
                    </Animated.View>
                </View>

                <Animated.View style={[styles.body, { opacity: fadeAnim }]}>
                    {is365Source && (
                        <>
                            <SectionHeader icon={PP_ICON.seasonStats} title={pp.matchStats} rtl={rtl} />
                            {loading && !matchReport365 ? (
                                <View style={[styles.card, styles.loadingCard]}>
                                    <ActivityIndicator size="small" color={B.primary} />
                                </View>
                            ) : matchStats.total > 0 ? (
                                <>
                                    {matchStats.featured.length > 0 && (
                                        <View style={[styles.featuredGrid, { flexDirection: row }]}>
                                            {matchStats.featured.map((s) => (
                                                <View key={s.key} style={[styles.featuredTile, { alignItems: alignStart }]}>
                                                    <LinearGradient
                                                        colors={[B.primary, 'rgba(139,92,246,0)']}
                                                        start={{ x: rtl ? 1 : 0, y: 0 }}
                                                        end={{ x: rtl ? 0 : 1, y: 0 }}
                                                        style={styles.featuredAccent}
                                                    />
                                                    <Text style={[styles.featuredValue, { fontFamily: fontBold }]} numberOfLines={1}>
                                                        {s.value}
                                                    </Text>
                                                    <Text
                                                        style={[styles.featuredLabel, { fontFamily: fontReg, textAlign }]}
                                                        numberOfLines={2}
                                                    >
                                                        {s.label}
                                                    </Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                    {matchStats.list.length > 0 && (
                                        <View style={[styles.card, styles.listCard]}>
                                            {matchStats.list.map((s, idx) => (
                                                <View
                                                    key={s.key}
                                                    style={[
                                                        styles.statRow,
                                                        { flexDirection: row },
                                                        idx < matchStats.list.length - 1 && styles.statRowDivider,
                                                    ]}
                                                >
                                                    <Text
                                                        style={[styles.statLabel, { fontFamily: fontReg, textAlign }]}
                                                        numberOfLines={2}
                                                    >
                                                        {s.label}
                                                    </Text>
                                                    <Text style={[styles.statValue, { fontFamily: fontBold }]}>{s.value}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <View style={[styles.card, styles.emptyCard]}>
                                    <Ionicons name="stats-chart-outline" size={30} color={B.primary} />
                                    <Text style={[styles.emptyText, { fontFamily: fontReg }]}>{pp.noCompetitionStats}</Text>
                                </View>
                            )}

                            {matchEvents.length > 0 && (
                                <>
                                    <SectionHeader icon={PP_ICON.time} title={pp.eventsSection} rtl={rtl} />
                                    <View style={[styles.eventsWrap, { flexDirection: row }]}>
                                        {matchEvents.map((line, idx) => (
                                            <View key={`${line}-${idx}`} style={styles.eventChip}>
                                                <Text style={[styles.eventText, { fontFamily: fontSemi }]}>{line}</Text>
                                            </View>
                                        ))}
                                    </View>
                                </>
                            )}
                        </>
                    )}

                    {/* Season total summary — API-Football career profile only */}
                    {!is365Source && leagueStats.length > 0 && (
                        <>
                            <SectionHeader
                                icon={PP_ICON.seasonStats}
                                title={pp.seasonTotal}
                                trailing={`${seasonYear}/${seasonYear + 1}`}
                                rtl={rtl}
                            />
                            <View style={[styles.card, styles.totalRow, { flexDirection: row }]}>
                                <MiniStat label={pp.matches} value={seasonTotals.appearences} />
                                <View style={styles.vDivider} />
                                <MiniStat label={pp.goals} value={seasonTotals.goals} />
                                <View style={styles.vDivider} />
                                <MiniStat label={pp.assists} value={seasonTotals.assists} />
                                <View style={styles.vDivider} />
                                <MiniStat
                                    label={pp.rating}
                                    value={seasonTotals.rating ? parseFloat(seasonTotals.rating).toFixed(1) : '—'}
                                    tone={seasonTotals.rating ? ratingTone(parseFloat(seasonTotals.rating)) : undefined}
                                />
                            </View>
                        </>
                    )}

                    {/* Per-league stats */}
                    {!is365Source && (
                        <>
                            <SectionHeader icon={PP_ICON.court} title={pp.competitions} rtl={rtl} />
                            {leagueStats.length === 0 ? (
                                <View style={[styles.card, styles.emptyCard]}>
                                    <Ionicons name="stats-chart-outline" size={30} color={B.primary} />
                                    <Text style={[styles.emptyText, { fontFamily: fontReg }]}>{pp.noCompetitionStats}</Text>
                                </View>
                            ) : (
                                leagueStats.map((stat) => (
                                    <LeagueStatCard
                                        key={`${stat.league.id}-${stat.league.season}-${stat.team.id}`}
                                        stat={stat}
                                        language={language}
                                        labels={pp}
                                        teamColor={teamColors[0]}
                                        rtl={rtl}
                                    />
                                ))
                            )}
                        </>
                    )}

                    {/* Personal info — API-Football only (365 has no DOB/height in match context) */}
                    {!is365Source && (
                        <>
                            <SectionHeader icon={PP_ICON.position} title={pp.personalInfo} rtl={rtl} />
                            <View style={[styles.card, styles.infoCard]}>
                                <View style={[styles.infoGrid, { flexDirection: row }]}>
                                    <InfoTile icon="calendar-outline" label={pp.dateOfBirth} value={heroPlayer.birth?.date ? formatDate(heroPlayer.birth.date, language) : 'N/A'} />
                                    <View style={styles.vDivider} />
                                    <InfoTile icon="location-outline" label={pp.birthPlace} value={heroPlayer.birth?.place || 'N/A'} />
                                </View>
                                <View style={styles.hDivider} />
                                <View style={[styles.infoGrid, { flexDirection: row }]}>
                                    <InfoTile icon="resize-outline" label={pp.height} value={heroPlayer.height || 'N/A'} />
                                    <View style={styles.vDivider} />
                                    <InfoTile icon="barbell-outline" label={pp.weight} value={heroPlayer.weight || 'N/A'} />
                                </View>
                                {(preferredFoot || leagueStats.some((s) => s.games.captain)) && (
                                    <>
                                        <View style={styles.hDivider} />
                                        <View style={[styles.infoGrid, { flexDirection: row }]}>
                                            {preferredFoot && (
                                                <InfoTile icon="footsteps-outline" label={pp.preferredFoot} value={preferredFoot} />
                                            )}
                                            {leagueStats.some((s) => s.games.captain) && (
                                                <>
                                                    {preferredFoot && <View style={styles.vDivider} />}
                                                    <InfoTile icon="star" label={pp.captain} value={pp.yes} tone="#FACC15" />
                                                </>
                                            )}
                                        </View>
                                    </>
                                )}
                            </View>
                        </>
                    )}
                </Animated.View>
            </ScrollView>
        </View>
    );
}

function InfoTile({
    icon,
    label,
    value,
    tone,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string;
    tone?: string;
}) {
    const fontBold = useAppFont(700);
    const fontReg = useAppFont(400);
    return (
        <View style={styles.infoTile}>
            <Ionicons name={icon} size={18} color={tone ?? B.primarySoft} />
            <Text style={[styles.infoLabel, { fontFamily: fontReg }]}>{label}</Text>
            <Text style={[styles.infoValue, { fontFamily: fontBold }, tone ? { color: tone } : null]} numberOfLines={2}>
                {value}
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: B.bg },

    hero: { paddingHorizontal: 18, paddingTop: 22, paddingBottom: 20, overflow: 'hidden' },
    heroJersey: {
        position: 'absolute',
        top: -6,
        fontSize: 110,
        color: B.jersey,
        opacity: 0.85,
    },
    heroRow: { alignItems: 'center', gap: 16 },
    photoWrap: { alignItems: 'center' },
    ratingMedal: {
        position: 'absolute',
        bottom: -8,
        minWidth: 44,
        paddingHorizontal: 8,
        height: 24,
        borderRadius: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: B.bg,
    },
    ratingMedalText: { color: '#0b0518', fontSize: 13 },
    heroInfo: { flex: 1 },
    inlineRow: { alignItems: 'center', gap: 6 },
    flag: { width: 18, height: 12, borderRadius: 2 },
    heroMeta: { color: B.soft, fontSize: 13, flexShrink: 1 },
    playerName: { color: '#fff', fontSize: 22, flexShrink: 1 },
    verified: { width: 20, height: 20 },
    injuredBadge: {
        alignItems: 'center',
        gap: 4,
        backgroundColor: 'rgba(239,68,68,0.2)',
        borderRadius: 8,
        paddingHorizontal: 8,
        paddingVertical: 3,
        marginTop: 6,
        borderWidth: 1,
        borderColor: 'rgba(239,68,68,0.45)',
    },
    injuredText: { fontSize: 11, color: '#fca5a5' },
    heroTeamName: { color: B.soft, fontSize: 14, flexShrink: 1 },

    chipsRow: { flexWrap: 'wrap', gap: 8, marginTop: 18 },
    chip: {
        alignItems: 'center',
        gap: 6,
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: 'rgba(11,5,24,0.85)',
        borderWidth: 1,
        borderColor: B.border,
    },
    chipIcon: { width: 14, height: 14 },
    chipText: { color: '#fff', fontSize: 12 },

    careerButtonWrap: {
        marginTop: 14,
        borderRadius: 12,
        shadowColor: B.primary,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 12,
        elevation: 8,
    },
    careerButton: {
        height: 44,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.35)',
    },
    careerButtonText: { color: '#fff', fontSize: 14 },

    body: { paddingHorizontal: 18 },

    card: {
        backgroundColor: B.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: B.border,
    },
    loadingCard: { paddingVertical: 28, alignItems: 'center' },
    emptyCard: { alignItems: 'center', paddingVertical: 28, paddingHorizontal: 16, gap: 10 },
    emptyText: { fontSize: 14, color: B.soft, textAlign: 'center' },

    featuredGrid: { flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 10, marginBottom: 10 },
    featuredTile: {
        width: '48.5%',
        backgroundColor: B.card,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: B.border,
        paddingHorizontal: 14,
        paddingTop: 16,
        paddingBottom: 14,
        overflow: 'hidden',
    },
    featuredAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
    featuredValue: { color: '#fff', fontSize: 26 },
    featuredLabel: { color: B.muted, fontSize: 12, marginTop: 4 },

    listCard: { paddingHorizontal: 14 },
    statRow: { alignItems: 'center', justifyContent: 'space-between', gap: 12, paddingVertical: 13 },
    statRowDivider: { borderBottomWidth: 1, borderBottomColor: B.divider },
    statLabel: { flex: 1, color: B.soft, fontSize: 14 },
    statValue: { color: '#fff', fontSize: 15 },

    eventsWrap: { flexWrap: 'wrap', gap: 8 },
    eventChip: {
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 999,
        backgroundColor: 'rgba(139,92,246,0.1)',
        borderWidth: 1,
        borderColor: B.border,
    },
    eventText: { color: '#fff', fontSize: 12 },

    totalRow: { overflow: 'hidden' },
    vDivider: { width: 1, backgroundColor: B.divider, marginVertical: 10 },
    hDivider: { height: 1, backgroundColor: B.divider, marginVertical: 14 },

    infoCard: { padding: 16 },
    infoGrid: { alignItems: 'stretch' },
    infoTile: { flex: 1, alignItems: 'center', gap: 6, paddingHorizontal: 4 },
    infoLabel: { fontSize: 11, color: B.muted, textAlign: 'center' },
    infoValue: { fontSize: 14, color: '#fff', textAlign: 'center' },

});
