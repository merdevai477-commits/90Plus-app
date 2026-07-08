// @ts-nocheck
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
    View,
    StyleSheet,
    Text,
    TouchableOpacity,
    LayoutChangeEvent,
    useWindowDimensions,
    Image,
} from 'react-native';
import { Users } from 'lucide-react-native';
import { SectionHeader } from './SectionHeader';
import { FeatureInfoModal } from '../common/FeatureInfoModal';
import { useTranslation } from '../../src/i18n';
import { LinearGradient } from 'expo-linear-gradient';
import {
    PURPLE_PRIMARY,
    RADIUS_LG,
    RATING_GOLD,
    RATING_GREEN,
    RATING_TEAL,
} from '../../constants/tokens';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    withSpring,
    Easing,
} from 'react-native-reanimated';
import {
    FootballPitchSvg,
    FOOTBALL_PITCH_ASPECT,
    pitchPercentToContainer,
} from '../common/FootballPitchSvg';
import { resolvePublicFirstName } from '../../hooks/useProfileCache';

const AnimatedView = Animated.createAnimatedComponent(View);

const HORIZONTAL_PADDING = 16;
const AVATAR_SIZE = 34;
/** Anchor pitch coords to avatar center (name sits below). */
const NODE_OFFSET = AVATAR_SIZE / 2 + 2;

/** 4-3-3 — one player per role; GK left, attack right. */
const FORMATION_433: Array<{ x: number; y: number; role: string }> = [
    { x: 7, y: 50, role: 'GK' },
    { x: 27, y: 84, role: 'RB' },
    { x: 27, y: 61, role: 'CB' },
    { x: 27, y: 39, role: 'CB' },
    { x: 27, y: 16, role: 'LB' },
    { x: 48, y: 50, role: 'CDM' },
    { x: 58, y: 66, role: 'CM' },
    { x: 58, y: 34, role: 'CM' },
    { x: 79, y: 84, role: 'RW' },
    { x: 79, y: 50, role: 'ST' },
    { x: 79, y: 16, role: 'LW' },
];

/** Max players per role in a single lineup. */
const ROLE_BUDGET: Record<string, number> = {
    GK: 1,
    RB: 1,
    LB: 1,
    CB: 2,
    CDM: 1,
    CM: 2,
    RW: 1,
    LW: 1,
    ST: 1,
};

/** Broad line a role belongs to, used to keep players near their position. */
const ROLE_LINE: Record<string, 'GK' | 'DEF' | 'MID' | 'ATT'> = {
    GK: 'GK',
    RB: 'DEF',
    CB: 'DEF',
    LB: 'DEF',
    CDM: 'MID',
    CM: 'MID',
    RW: 'ATT',
    ST: 'ATT',
    LW: 'ATT',
};

function mapToFormationRole(pos?: string): string | null {
    const p = (pos || '').toUpperCase().trim();
    if (!p) return null;
    if (p === 'GK' || p === 'G') return 'GK';
    if (p === 'RB' || p === 'RWB') return 'RB';
    if (p === 'LB' || p === 'LWB') return 'LB';
    if (p === 'CB' || p === 'SW' || p === 'DEF') return 'CB';
    if (p === 'CDM' || p === 'DM' || p === 'DMC') return 'CDM';
    if (p === 'CM' || p === 'CAM' || p === 'AM' || p === 'MID' || p === 'RCM' || p === 'LCM') return 'CM';
    if (p === 'RW' || p === 'RM') return 'RW';
    if (p === 'LW' || p === 'LM') return 'LW';
    if (p === 'ST' || p === 'CF' || p === 'SS' || p === 'ATT') return 'ST';
    return null;
}

/** Line group of a player (defaults to attack, matching the default "ST"). */
function playerLine(player: PitchPlayerItem): 'GK' | 'DEF' | 'MID' | 'ATT' {
    const role = mapToFormationRole(player.position);
    return role ? ROLE_LINE[role] : 'ATT';
}

function displayLabel(player: PitchPlayerItem): string {
    const resolved =
        resolvePublicFirstName(player.name, player.username) ||
        player.name?.trim() ||
        '';
    if (resolved && !/^user_[a-z0-9]+$/i.test(resolved)) {
        const first = resolved.split(/\s+/)[0];
        return first.length > 9 ? `${first.slice(0, 8)}…` : first;
    }
    return player.short || '?';
}

export type PitchPlayerItem = {
    id?: string;
    name: string;
    short: string;
    rating: number;
    position: string;
    photoUri?: string;
    x?: number;
    y?: number;
    username?: string;
};

function slotCoords(slotIndex: number): { x: number; y: number } {
    const slot = FORMATION_433[slotIndex];
    return { x: slot.x, y: slot.y };
}

function playerIdentity(player: PitchPlayerItem): string {
    const id = player.id?.trim();
    if (id) return `id:${id}`;
    const user = player.username?.trim().toLowerCase();
    if (user && !/^user_[a-z0-9]+$/i.test(user)) return `u:${user}`;
    const publicName =
        resolvePublicFirstName(player.name, player.username) || player.name?.trim();
    if (publicName && !/^user_[a-z0-9]+$/i.test(publicName)) {
        return `n:${publicName.toLowerCase()}`;
    }
    return `x:${user || publicName || ''}`;
}

/** One entry per user — max 11 for the formation. */
function dedupePlayers(players: PitchPlayerItem[]): PitchPlayerItem[] {
    const seen = new Set<string>();
    const out: PitchPlayerItem[] = [];
    for (const p of players) {
        const key = playerIdentity(p);
        if (!key || key === 'n:' || seen.has(key)) continue;
        seen.add(key);
        out.push(p);
    }
    return out;
}

function buildPitchPositions(players: PitchPlayerItem[]): (PitchPlayerItem | null)[] {
    const roster = [...dedupePlayers(players)].sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
    const result: (PitchPlayerItem | null)[] = new Array(FORMATION_433.length).fill(null);
    const usedIndices = new Set<number>();
    const usedIdentities = new Set<string>();
    const roleUsed: Record<string, number> = {};

    const roleRemaining = (role: string) =>
        (ROLE_BUDGET[role] ?? 0) - (roleUsed[role] ?? 0);

    const tryPlace = (slotIndex: number, pi: number): boolean => {
        const player = roster[pi];
        const identity = playerIdentity(player);
        if (usedIdentities.has(identity)) return false;

        const slotRole = FORMATION_433[slotIndex].role;
        const playerRole = mapToFormationRole(player.position);
        if (!playerRole || playerRole !== slotRole || roleRemaining(slotRole) <= 0) {
            return false;
        }

        usedIdentities.add(identity);
        usedIndices.add(pi);
        roleUsed[slotRole] = (roleUsed[slotRole] ?? 0) + 1;
        const { x, y } = slotCoords(slotIndex);
        result[slotIndex] = { ...player, x, y };
        return true;
    };

    // Pass 1 — fill each slot with the best-rated player for that exact role.
    for (let si = 0; si < FORMATION_433.length; si++) {
        for (let pi = 0; pi < roster.length; pi++) {
            if (usedIndices.has(pi)) continue;
            if (tryPlace(si, pi)) break;
        }
    }

    // The roster is the top players of the month, but most share the same
    // position (default "ST") while the 4-3-3 has only one ST slot. Without the
    // passes below the highest-XP players would be dropped just because their
    // role is already taken, leaving "?" slots.
    const placeInSlot = (slotIndex: number, sameLineOnly: boolean): boolean => {
        const slotLine = ROLE_LINE[FORMATION_433[slotIndex].role];
        for (let pi = 0; pi < roster.length; pi++) {
            if (usedIndices.has(pi)) continue;
            const player = roster[pi];
            const identity = playerIdentity(player);
            if (usedIdentities.has(identity)) continue;
            if (sameLineOnly && playerLine(player) !== slotLine) continue;
            usedIdentities.add(identity);
            usedIndices.add(pi);
            const { x, y } = slotCoords(slotIndex);
            result[slotIndex] = { ...player, x, y };
            return true;
        }
        return false;
    };

    // Pass 2 — fill empty slots with the best un-placed player from the SAME
    // line (keep a player in each position/line as much as possible).
    for (let si = 0; si < FORMATION_433.length; si++) {
        if (result[si]) continue;
        placeInSlot(si, true);
    }

    // Pass 3 — any slots still empty get the next best player regardless of
    // position, so the team always reflects the actual top players of the month.
    for (let si = 0; si < FORMATION_433.length; si++) {
        if (result[si]) continue;
        placeInSlot(si, false);
    }

    return result;
}

export function detectFormation(_players: PitchPlayerItem[]): string {
    return '4-3-3';
}

const SKELETON_POSITIONS = FORMATION_433.map((s) => ({ x: s.x, y: s.y }));

function pitchInitials(player: PitchPlayerItem): string {
    const label = displayLabel(player);
    if (label && label !== '?') {
        return label.slice(0, 2).toUpperCase();
    }
    return '•';
}

function PlayerAvatar({ player }: { player: PitchPlayerItem }) {
    const [failed, setFailed] = React.useState(false);
    const uri = player.photoUri?.trim();
    const initials = pitchInitials(player);

    if (uri && !failed) {
        return (
            <Image
                source={{ uri }}
                style={styles.playerAvatar}
                resizeMode="cover"
                onError={() => setFailed(true)}
            />
        );
    }

    return (
        <View style={styles.playerAvatarFallback}>
            <Text style={styles.playerShort}>{initials}</Text>
        </View>
    );
}

function PlayerNode({
    player,
    index,
    containerW,
    containerH,
    onPress,
}: {
    player: PitchPlayerItem;
    index: number;
    containerW: number;
    containerH: number;
    onPress?: () => void;
}) {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.5);
    const translateY = useSharedValue(-20);

    useEffect(() => {
        const delay = 100 + index * 70;
        opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
        scale.value = withDelay(delay, withSpring(1, { stiffness: 180, damping: 12 }));
        translateY.value = withDelay(delay, withSpring(0, { stiffness: 180, damping: 12 }));
    }, [index]);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }, { translateY: translateY.value }] as any,
    }));

    const ratingColor =
        player.rating >= 90 ? RATING_GOLD : player.rating >= 85 ? RATING_GREEN : RATING_TEAL;

    const { left, top } = pitchPercentToContainer(player.x ?? 50, player.y ?? 50, containerW, containerH);

    const label = displayLabel(player);
    const showNameLabel = label !== '?' && !/^user_/i.test(label);

    return (
        <View style={[styles.playerNode, { left, top }]}>
            <AnimatedView style={animatedStyle}>
                <TouchableOpacity activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
                    <View style={styles.circleWrapper}>
                        <View style={styles.playerCircle}>
                            <PlayerAvatar player={player} />
                        </View>
                        <View style={[styles.ratingBadge, { backgroundColor: ratingColor }]}>
                            <Text style={styles.ratingText}>{player.rating}</Text>
                        </View>
                    </View>
                    {showNameLabel ? (
                        <View style={styles.nameBadge}>
                            <Text style={styles.nameText} numberOfLines={1}>
                                {label}
                            </Text>
                        </View>
                    ) : null}
                </TouchableOpacity>
            </AnimatedView>
        </View>
    );
}

function SkeletonPlayerNode({
    x,
    y,
    index,
    containerW,
    containerH,
}: {
    x: number;
    y: number;
    index: number;
    containerW: number;
    containerH: number;
}) {
    const opacity = useSharedValue(0.35);
    useEffect(() => {
        opacity.value = withDelay(
            index * 90,
            withRepeat(withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true),
        );
    }, [index]);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const { left, top } = pitchPercentToContainer(x, y, containerW, containerH);

    return (
        <View style={[styles.playerNode, { left, top }]}>
            <AnimatedView style={animatedStyle}>
                <View style={styles.circleWrapper}>
                    <View style={styles.skeletonPlayerCircle} />
                    <View style={styles.skeletonRatingBadge} />
                </View>
                <View style={styles.skeletonNameBadge} />
            </AnimatedView>
        </View>
    );
}

function EmptyPlayerNode({
    x,
    y,
    index,
    containerW,
    containerH,
}: {
    x: number;
    y: number;
    index: number;
    containerW: number;
    containerH: number;
}) {
    const opacity = useSharedValue(0.4);
    useEffect(() => {
        opacity.value = withDelay(
            index * 200,
            withRepeat(withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true),
        );
    }, [index]);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const { left, top } = pitchPercentToContainer(x, y, containerW, containerH);

    return (
        <View style={[styles.playerNode, { left, top }]}>
            <AnimatedView style={animatedStyle}>
                <View style={styles.circleWrapper}>
                    <View style={styles.emptyPlayerCircle}>
                        <Text style={styles.emptyPlayerIcon}>?</Text>
                    </View>
                    <View style={styles.emptyRatingBadge}>
                        <Text style={styles.emptyRatingText}>?</Text>
                    </View>
                </View>
                <View style={styles.emptyNameBadge}>
                    <Text style={styles.emptyNameText}>---</Text>
                </View>
            </AnimatedView>
        </View>
    );
}

interface TeamPitchProps {
    isLoading?: boolean;
    hasLineup?: boolean;
    players?: PitchPlayerItem[];
    onPlayerPress?: (player: PitchPlayerItem) => void;
}

export function TeamPitch({
    isLoading = false,
    players: playersProp,
    onPlayerPress,
}: TeamPitchProps) {
    const { t } = useTranslation();
    const { width: screenW } = useWindowDimensions();

    const [showTeamInfo, setShowTeamInfo] = useState(false);
    const openTeamInfo = useCallback(() => setShowTeamInfo(true), []);
    const closeTeamInfo = useCallback(() => setShowTeamInfo(false), []);

    const [pitchSize, setPitchSize] = useState({ w: 0, h: 0 });

    const pitchLayoutWidth = screenW - HORIZONTAL_PADDING * 2;

    const onPitchLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setPitchSize({ w: width, h: height });
    }, []);

    const placedPlayers = useMemo<(PitchPlayerItem | null)[]>(
        () => (playersProp && playersProp.length > 0 ? buildPitchPositions(playersProp) : []),
        [playersProp],
    );

    const filledPlayers = useMemo(
        () => placedPlayers.filter((p): p is PitchPlayerItem => p != null),
        [placedPlayers],
    );

    const formation = useMemo<string | undefined>(
        () => detectFormation(filledPlayers),
        [filledPlayers],
    );

    const showSkeleton = isLoading && filledPlayers.length === 0;
    const ready = pitchSize.w > 0 && pitchSize.h > 0;

    return (
        <View style={styles.container}>
            <View style={styles.sectionHeaderWrap}>
                <SectionHeader
                    subtitle={t.home.sectionTeamSub}
                    title={t.home.teamOfMonth}
                    badge={formation ?? '---'}
                    action={t.home.details}
                    onTitlePress={openTeamInfo}
                    onAction={openTeamInfo}
                />
            </View>

            <FeatureInfoModal
                visible={showTeamInfo}
                onClose={closeTeamInfo}
                icon={<Users size={30} color="#d8b4fe" />}
                title={t.teamOfMonthInfo.title}
                bullets={[
                    t.teamOfMonthInfo.rule1,
                    t.teamOfMonthInfo.rule2,
                    t.teamOfMonthInfo.rule3,
                    t.teamOfMonthInfo.rule4,
                ]}
                hype={t.teamOfMonthInfo.hype}
                gotItLabel={t.teamOfMonthInfo.gotIt}
            />

            <View style={styles.pitchOuter}>
                <LinearGradient
                    colors={['rgba(124,58,237,0.22)', 'rgba(88,28,135,0.08)', 'transparent']}
                    start={{ x: 0.5, y: 0 }}
                    end={{ x: 0.5, y: 1 }}
                    style={[styles.pitchAmbient, { width: pitchLayoutWidth + 24 }]}
                    pointerEvents="none"
                />
                <LinearGradient
                    colors={['rgba(167,139,250,0.35)', 'rgba(88,28,135,0.15)', 'rgba(4,6,10,0.9)']}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={[styles.pitchCardBorder, { width: pitchLayoutWidth + 4 }]}
                >
                <View
                    style={[styles.pitchFrame, { width: pitchLayoutWidth }]}
                    onLayout={onPitchLayout}
                >
                    <View style={styles.pitchSvgFill}>
                        <FootballPitchSvg
                            variant="stadium"
                            width={pitchSize.w > 0 ? pitchSize.w : pitchLayoutWidth}
                            height={
                                pitchSize.h > 0
                                    ? pitchSize.h
                                    : pitchLayoutWidth / FOOTBALL_PITCH_ASPECT
                            }
                        />
                    </View>

                    <LinearGradient
                        colors={['transparent', 'rgba(0,0,0,0.35)']}
                        style={styles.pitchVignette}
                        pointerEvents="none"
                    />

                    {ready && !showSkeleton && (
                        <View style={styles.playersOverlay}>
                            {FORMATION_433.map((slot, i) => {
                                const player = placedPlayers[i];
                                if (player) {
                                    return (
                                        <PlayerNode
                                            key={`player-${player.username || player.id || i}`}
                                            player={player}
                                            index={i}
                                            containerW={pitchSize.w}
                                            containerH={pitchSize.h}
                                            onPress={onPlayerPress ? () => onPlayerPress(player) : undefined}
                                        />
                                    );
                                }
                                return (
                                    <EmptyPlayerNode
                                        key={`empty-${i}`}
                                        x={slot.x}
                                        y={slot.y}
                                        index={i}
                                        containerW={pitchSize.w}
                                        containerH={pitchSize.h}
                                    />
                                );
                            })}
                        </View>
                    )}

                    {ready && showSkeleton && (
                        <View style={styles.playersOverlay}>
                            {SKELETON_POSITIONS.map((pos, i) => (
                                <SkeletonPlayerNode
                                    key={`sk-${i}`}
                                    x={pos.x}
                                    y={pos.y}
                                    index={i}
                                    containerW={pitchSize.w}
                                    containerH={pitchSize.h}
                                />
                            ))}
                        </View>
                    )}
                </View>
                </LinearGradient>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingBottom: 8,
    },
    sectionHeaderWrap: {
        zIndex: 20,
        position: 'relative',
        paddingHorizontal: HORIZONTAL_PADDING,
    },
    pitchOuter: {
        paddingHorizontal: HORIZONTAL_PADDING,
        marginTop: 8,
        alignItems: 'center',
    },
    pitchAmbient: {
        position: 'absolute',
        top: '8%',
        height: '84%',
        borderRadius: RADIUS_LG + 12,
        opacity: 0.85,
    },
    pitchCardBorder: {
        borderRadius: RADIUS_LG + 2,
        padding: 2,
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.35,
        shadowRadius: 18,
        elevation: 12,
    },
    pitchFrame: {
        aspectRatio: FOOTBALL_PITCH_ASPECT,
        borderRadius: RADIUS_LG,
        overflow: 'hidden',
        borderWidth: 1,
        borderColor: 'rgba(167,139,250,0.25)',
        backgroundColor: '#04060A',
        minHeight: 228,
    },
    pitchSvgFill: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#143D2E',
    },
    pitchVignette: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 10,
    },
    playersOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 20,
    },
    playerNode: {
        position: 'absolute',
        alignItems: 'center',
        minWidth: 52,
        maxWidth: 64,
        transform: [{ translateX: -26 }, { translateY: -NODE_OFFSET }],
        zIndex: 10,
    },
    circleWrapper: { position: 'relative', alignItems: 'center', width: AVATAR_SIZE + 8 },
    playerCircle: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        borderWidth: 2,
        borderColor: 'rgba(167,139,250,0.75)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(124,58,237,0.32)',
        overflow: 'hidden',
        shadowColor: PURPLE_PRIMARY,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.55,
        shadowRadius: 10,
        elevation: 8,
    },
    playerAvatar: {
        width: '100%',
        height: '100%',
    },
    playerAvatarFallback: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(124,58,237,0.45)',
    },
    playerShort: {
        color: '#fff',
        fontSize: 10,
        fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    ratingBadge: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    ratingText: { color: '#000', fontSize: 7, fontWeight: '900' },
    nameBadge: {
        backgroundColor: 'rgba(8,4,14,0.92)',
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(167,139,250,0.35)',
        marginTop: 4,
        maxWidth: 64,
    },
    nameText: {
        color: '#fff',
        fontSize: 7.5,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0.1,
    },
    skeletonPlayerCircle: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.14)',
    },
    skeletonRatingBadge: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.9)',
    },
    skeletonNameBadge: {
        width: 42,
        height: 10,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.55)',
        marginTop: 4,
    },
    emptyPlayerCircle: {
        width: AVATAR_SIZE,
        height: AVATAR_SIZE,
        borderRadius: AVATAR_SIZE / 2,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.25)',
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyPlayerIcon: { color: 'rgba(255, 255, 255, 0.35)', fontSize: 14, fontWeight: '700' },
    emptyRatingBadge: {
        position: 'absolute',
        bottom: -2,
        right: -4,
        width: 18,
        height: 18,
        borderRadius: 9,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    emptyRatingText: { color: 'rgba(103, 21, 136, 0.5)', fontSize: 7, fontWeight: '900' },
    emptyNameBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)',
        borderRadius: 5,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.06)',
        marginTop: 4,
    },
    emptyNameText: {
        color: 'rgba(255,255,255,0.3)',
        fontSize: 7.5,
        fontWeight: '700',
        textAlign: 'center',
    },
});
