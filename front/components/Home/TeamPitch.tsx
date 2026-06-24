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
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
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
const NODE_OFFSET = AVATAR_SIZE / 2 + 2;

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

/**
 * 4-3-3 on horizontal pitch — GK left, attack right.
 * Wider vertical spacing to avoid overlapping labels on mobile.
 */
const FORMATION_433: Array<{ x: number; y: number; label: string }> = [
    { x: 7, y: 50, label: 'GK' },
    { x: 27, y: 84, label: 'RB' },
    { x: 27, y: 61, label: 'CB' },
    { x: 27, y: 39, label: 'CB' },
    { x: 27, y: 16, label: 'LB' },
    { x: 53, y: 78, label: 'RCM' },
    { x: 53, y: 50, label: 'CM' },
    { x: 53, y: 22, label: 'LCM' },
    { x: 79, y: 84, label: 'RW' },
    { x: 79, y: 50, label: 'ST' },
    { x: 79, y: 16, label: 'LW' },
];

/** Preferred positions per slot (first match wins). */
const SLOT_POSITION_MAP: Record<string, string[]> = {
    GK: ['GK'],
    RB: ['RB', 'RWB'],
    CB: ['CB', 'SW', 'DEF'],
    LB: ['LB', 'LWB'],
    RCM: ['RM', 'RCM', 'CDM', 'CM', 'MID'],
    CM: ['CM', 'CAM', 'AM', 'CDM', 'DM', 'MID'],
    LCM: ['LM', 'LCM', 'CM', 'MID'],
    RW: ['RW', 'RM', 'ATT'],
    ST: ['ST', 'CF', 'SS', 'ATT'],
    LW: ['LW', 'LM', 'ATT'],
};

const FORMATION_LINE_FOR_POS: Record<string, number> = {
    GK: 0,
    RB: 1, RWB: 1, LB: 1, LWB: 1, CB: 1, SW: 1, DEF: 1,
    CM: 2, CDM: 2, CAM: 2, DM: 2, AM: 2, LM: 2, RM: 2, LCM: 2, RCM: 2, MID: 2,
    RW: 3, LW: 3, ST: 3, CF: 3, SS: 3, ATT: 3,
};

const LINE_SLOT_INDICES = [
    [0],
    [1, 2, 3, 4],
    [5, 6, 7],
    [8, 9, 10],
] as const;

function slotCoords(slotIndex: number): { x: number; y: number } {
    const slot = FORMATION_433[slotIndex];
    return { x: slot.x, y: slot.y };
}

function normalizePos(pos?: string): string {
    return (pos || 'CM').toUpperCase().trim();
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
        if (out.length >= FORMATION_433.length) break;
    }
    return out;
}

function buildPitchPositions(players: PitchPlayerItem[]): (PitchPlayerItem | null)[] {
    const roster = dedupePlayers(players);
    const slots = FORMATION_433;
    const result: (PitchPlayerItem | null)[] = new Array(slots.length).fill(null);
    const usedIndices = new Set<number>();
    const usedIdentities = new Set<string>();

    const tryPlace = (slotIndex: number, pi: number): boolean => {
        const player = roster[pi];
        const identity = playerIdentity(player);
        if (usedIdentities.has(identity)) return false;
        usedIdentities.add(identity);
        usedIndices.add(pi);
        const { x, y } = slotCoords(slotIndex);
        result[slotIndex] = { ...player, x, y };
        return true;
    };

    // Pass 1 — exact slot by position label
    for (let si = 0; si < slots.length; si++) {
        const accepted = SLOT_POSITION_MAP[slots[si].label] ?? [slots[si].label];
        for (let pi = 0; pi < roster.length; pi++) {
            if (usedIndices.has(pi)) continue;
            const pos = normalizePos(roster[pi].position);
            if (accepted.includes(pos) || pos === slots[si].label) {
                if (tryPlace(si, pi)) break;
            }
        }
    }

    // Pass 2 — fill empty slots by formation line (DEF/MID/ATT bucket)
    for (let line = 0; line < LINE_SLOT_INDICES.length; line++) {
        const emptySlots = LINE_SLOT_INDICES[line].filter((si) => !result[si]);
        if (emptySlots.length === 0) continue;

        const candidates: number[] = [];
        for (let pi = 0; pi < roster.length; pi++) {
            if (usedIndices.has(pi)) continue;
            const pos = normalizePos(roster[pi].position);
            if ((FORMATION_LINE_FOR_POS[pos] ?? 2) === line) candidates.push(pi);
        }

        for (const si of emptySlots) {
            const pi = candidates.shift();
            if (pi === undefined) break;
            tryPlace(si, pi);
        }
    }

    // Pass 3 — remaining players in rank order into empty slots
    let pi = 0;
    for (let si = 0; si < slots.length; si++) {
        if (result[si]) continue;
        while (pi < roster.length && usedIndices.has(pi)) pi++;
        if (pi >= roster.length) break;
        tryPlace(si, pi);
        pi++;
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
                            {showNameLabel ? (
                                <View style={styles.nameOverlay}>
                                    <Text style={styles.nameText} numberOfLines={1}>
                                        {label}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <View style={[styles.ratingBadge, { backgroundColor: ratingColor }]}>
                            <Text style={styles.ratingText}>{player.rating}</Text>
                        </View>
                    </View>
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
    onDetailsPress?: () => void;
}

export function TeamPitch({
    isLoading = false,
    players: playersProp,
    onPlayerPress,
    onDetailsPress,
}: TeamPitchProps) {
    const router = useRouter();
    const { t } = useTranslation();
    const { width: screenW } = useWindowDimensions();

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
                    onAction={() => (onDetailsPress ? onDetailsPress() : router.push('/rank'))}
                />
            </View>

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
        width: AVATAR_SIZE + 12,
        transform: [{ translateX: -(AVATAR_SIZE + 12) / 2 }, { translateY: -NODE_OFFSET }],
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
    nameOverlay: {
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(8,4,14,0.92)',
        paddingHorizontal: 2,
        paddingVertical: 1,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(167,139,250,0.35)',
    },
    nameText: {
        color: '#fff',
        fontSize: 6.5,
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
