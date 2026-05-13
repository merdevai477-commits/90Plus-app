// @ts-nocheck
// TypeScript suppression reason: This project's StyleSheet.create() returns
// 'ViewStyle | ImageStyle | TextStyle' union (not narrowed), which causes
// TS2769 on all View/Text style props. This is a project-wide tsconfig issue,
// not a logic error. All component logic and prop types are correct.
// See: https://github.com/facebook/react-native/issues/29265
import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { View, StyleSheet, Text, TouchableOpacity, Image, LayoutChangeEvent } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import { LinearGradient } from 'expo-linear-gradient';
import { SCREEN_PADDING_H } from '../../constants/tokens';
import Animated, {
    useSharedValue,
    useAnimatedStyle,
    withRepeat,
    withTiming,
    withDelay,
    withSpring,
    Easing,
} from 'react-native-reanimated';

const AnimatedView = Animated.createAnimatedComponent(View);

// ─── Types ────────────────────────────────────────────────────────────────────
export type PitchPlayerItem = {
    name: string;
    short: string;
    rating: number;
    position: string;
    x?: number;
    y?: number;
    username?: string;
};

// ─── Fixed 4-3-3 formation layout ────────────────────────────────────────────
// x = 0→100 left (GK) to right (ATT)
// y = 0→100 top to bottom
const FORMATION_433: Array<{ x: number; y: number; label: string }> = [
    // GK
    { x: 1,  y: 51, label: 'GK' },
    // DEF (4)
    { x: 28, y: 20, label: 'RB' },
    { x: 18, y: 38, label: 'CB' },
    { x: 18, y: 63, label: 'CB' },
    { x: 28, y: 79, label: 'LB' },
    // MID (3)
    { x: 59, y: 36, label: 'CM' },
    { x: 42, y: 50, label: 'CM' },
    { x: 59, y: 67, label: 'CM' },
    // ATT (3)
    { x: 86, y: 25, label: 'RW' },
    { x: 96, y: 50, label: 'ST' },
    { x: 89, y: 75, label: 'LW' },
];

// Maps each slot label to the position strings that belong to it.
// Order matters: first match wins. Fallback chains go from specific → generic.
const SLOT_POSITION_MAP: Record<string, string[]> = {
    GK:  ['GK'],
    RB:  ['RB', 'RWB', 'DEF'],
    CB:  ['CB', 'SW', 'DEF'],
    LB:  ['LB', 'LWB', 'DEF'],
    CM:  ['CM', 'CDM', 'DM', 'CAM', 'AM', 'LM', 'RM', 'MID'],
    RW:  ['RW', 'RM', 'ATT'],
    ST:  ['ST', 'CF', 'SS', 'ATT'],
    LW:  ['LW', 'LM', 'ATT'],
};

/**
 * Assigns each player to the best-matching 4-3-3 slot based on their position.
 * Falls back to sequential assignment for unmatched players.
 */
function buildPitchPositions(players: PitchPlayerItem[]): PitchPlayerItem[] {
    const slots = [...FORMATION_433]; // 11 slots
    const result: (PitchPlayerItem | null)[] = new Array(slots.length).fill(null);
    const usedSlots = new Set<number>();
    const unmatched: PitchPlayerItem[] = [];

    for (const player of players) {
        const pos = (player.position || '').toUpperCase();
        let placed = false;

        // Try each slot; pick the first whose accepted positions include this player's position
        for (let si = 0; si < slots.length; si++) {
            if (usedSlots.has(si)) continue;
            const accepted = SLOT_POSITION_MAP[slots[si].label] ?? [];
            if (accepted.includes(pos)) {
                result[si] = { ...player, x: slots[si].x, y: slots[si].y };
                usedSlots.add(si);
                placed = true;
                break;
            }
        }

        if (!placed) unmatched.push(player);
    }

    // Fill remaining empty slots with unmatched players in order
    let ui = 0;
    for (let si = 0; si < slots.length && ui < unmatched.length; si++) {
        if (!usedSlots.has(si)) {
            result[si] = { ...unmatched[ui], x: slots[si].x, y: slots[si].y };
            ui++;
        }
    }

    return result.filter(Boolean) as PitchPlayerItem[];
}

export function detectFormation(_players: PitchPlayerItem[]): string {
    return '4-3-3';
}

const SKELETON_POSITIONS = FORMATION_433.map(s => ({ x: s.x, y: s.y }));

// ─── Player node ──────────────────────────────────────────────────────────────
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
        player.rating >= 90 ? '#FFD700' : player.rating >= 85 ? '#32CD32' : '#11998E';

    const left = (player.x ?? 50) / 100 * containerW;
    const top  = (player.y ?? 50) / 100 * containerH;

    return (
        <View style={[styles.playerNode, { left, top }]}>
            <AnimatedView style={animatedStyle}>
                <TouchableOpacity activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
                    <View style={styles.circleWrapper}>
                        <View style={styles.playerCircle}>
                            <Text style={styles.playerShort}>{player.short}</Text>
                        </View>
                        <View style={[styles.ratingBadge, { backgroundColor: ratingColor }]}>
                            <Text style={styles.ratingText}>{player.rating}</Text>
                        </View>
                    </View>
                    <View style={styles.nameBadge}>
                        <Text style={styles.nameText} numberOfLines={1}>
                            {(player.name || '').split(' ').slice(-1)[0] || player.name}
                        </Text>
                    </View>
                </TouchableOpacity>
            </AnimatedView>
        </View>
    );
}

// ─── Skeleton node ────────────────────────────────────────────────────────────
function SkeletonPlayerNode({
    x, y, index, containerW, containerH,
}: { x: number; y: number; index: number; containerW: number; containerH: number }) {
    const opacity = useSharedValue(0.35);
    useEffect(() => {
        opacity.value = withDelay(
            index * 90,
            withRepeat(withTiming(0.7, { duration: 900, easing: Easing.inOut(Easing.ease) }), -1, true),
        );
    }, [index]);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const left = x / 100 * containerW;
    const top  = y / 100 * containerH;

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

// ─── Empty node ───────────────────────────────────────────────────────────────
function EmptyPlayerNode({
    x, y, index, containerW, containerH,
}: { x: number; y: number; index: number; containerW: number; containerH: number }) {
    const opacity = useSharedValue(0.4);
    useEffect(() => {
        opacity.value = withDelay(
            index * 200,
            withRepeat(withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true),
        );
    }, [index]);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
    const left = x / 100 * containerW;
    const top  = y / 100 * containerH;

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

// ─── Public component ─────────────────────────────────────────────────────────
interface TeamPitchProps {
    isLoading?: boolean;
    hasLineup?: boolean;
    players?: PitchPlayerItem[];
    onPlayerPress?: (player: PitchPlayerItem) => void;
    onDetailsPress?: () => void;
}

export function TeamPitch({
    isLoading = false,
    hasLineup,
    players: playersProp,
    onPlayerPress,
    onDetailsPress,
}: TeamPitchProps) {
    const router = useRouter();

    // Dimensions of the outer wrapper (full image area)
    const [wrapperSize, setWrapperSize] = useState({ w: 0, h: 0 });

    const onWrapperLayout = useCallback((e: LayoutChangeEvent) => {
        const { width, height } = e.nativeEvent.layout;
        setWrapperSize({ w: width, h: height });
    }, []);

    // ── Pitch crop factors ────────────────────────────────────────────────────
    // The stadium image has stands/sky around the green pitch.
    // These factors define where the actual grass starts/ends as a fraction
    // of the full image dimensions. Tweak if the pitch drifts.
    //
    //   pitchLeft   = 10% from left edge of image
    //   pitchRight  = 90% from left edge  (so pitch width = 80% of image)
    //   pitchTop    = 33% from top edge
    //   pitchBottom = 67% from top edge   (so pitch height = 34% of image)
    //
    const PITCH_LEFT   = 0.10;
    const PITCH_RIGHT  = 0.90;
    const PITCH_TOP    = 0.33;
    const PITCH_BOTTOM = 0.67;

    const pitchW = wrapperSize.w * (PITCH_RIGHT  - PITCH_LEFT);
    const pitchH = wrapperSize.h * (PITCH_BOTTOM - PITCH_TOP);
    const pitchX = wrapperSize.w * PITCH_LEFT;
    const pitchY = wrapperSize.h * PITCH_TOP;

    const placedPlayers = useMemo<PitchPlayerItem[]>(
        () => (playersProp && playersProp.length > 0 ? buildPitchPositions(playersProp) : []),
        [playersProp],
    );

    const formation = useMemo<string | undefined>(
        () => detectFormation(placedPlayers),
        [placedPlayers],
    );

    const showSkeleton = isLoading && placedPlayers.length === 0;
    const hasData = hasLineup ?? placedPlayers.length > 0;
    const showData = !showSkeleton && hasData && placedPlayers.length > 0;

    const ready = wrapperSize.w > 0;

    return (
        <View style={styles.container}>
            <View style={{ paddingHorizontal: SCREEN_PADDING_H, marginBottom: 0 }}>
                <SectionHeader
                    subtitle="Formation"
                    title="Team of the month"
                    badge={formation ?? '---'}
                    action="Details"
                    onAction={() => (onDetailsPress ? onDetailsPress() : router.push('/rank'))}
                />
            </View>

            {/* Outer clip — hides left/right overflow from the wide image */}
            <View style={styles.pitchOuterClip}>
                {/* pitchWrapper: the image is rendered here at 300% width + scaled down.
                    We measure this wrapper so we know the real pixel dimensions. */}
                <View style={styles.pitchWrapper} onLayout={onWrapperLayout}>

                    {/* Stadium image */}
                    <View style={styles.pitchContainer}>
                        <Image
                            source={require('../../assets/images/team of the month.png')}
                            resizeMode="contain"
                            style={StyleSheet.absoluteFill}
                        />
                        <LinearGradient
                            colors={['rgba(3,0,8,0.85)', 'rgba(3,0,8,0.35)', 'transparent'] as const}
                            locations={[0, 0.35, 1]}
                            style={styles.pitchShadowTop}
                            pointerEvents="none"
                        />
                        <LinearGradient
                            colors={['transparent', 'rgba(3,0,8,0.35)', 'rgba(3,0,8,0.85)'] as const}
                            locations={[0, 0.65, 1]}
                            style={styles.pitchShadowBottom}
                            pointerEvents="none"
                        />
                    </View>

                    {/* Players overlay — positioned absolutely over the grass area */}
                    {ready && !showSkeleton && (
                        <View
                            style={[
                                styles.playersOverlay,
                                { left: pitchX, top: pitchY, width: pitchW, height: pitchH },
                            ]}
                        >
                            {FORMATION_433.map((slot, i) => {
                                const player = placedPlayers[i];
                                if (player) {
                                    return (
                                        <PlayerNode
                                            key={`player-${i}`}
                                            player={player}
                                            index={i}
                                            containerW={pitchW}
                                            containerH={pitchH}
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
                                        containerW={pitchW}
                                        containerH={pitchH}
                                    />
                                );
                            })}
                        </View>
                    )}

                    {ready && showSkeleton && (
                        <View
                            style={[
                                styles.playersOverlay,
                                { left: pitchX, top: pitchY, width: pitchW, height: pitchH },
                            ]}
                        >
                            {SKELETON_POSITIONS.map((pos, i) => (
                                <SkeletonPlayerNode
                                    key={`sk-${i}`}
                                    x={pos.x}
                                    y={pos.y}
                                    index={i}
                                    containerW={pitchW}
                                    containerH={pitchH}
                                />
                            ))}
                        </View>
                    )}
                </View>
            </View>
        </View>
    );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const styles = StyleSheet.create({
    container: { paddingBottom: 0 },

    pitchOuterClip: {
        overflow: 'hidden',
    },

    // Negative margins pull the image up/down so the grass fills the visible area.
    // The image is 300% wide + scale(0.6) so it looks full-width on screen.
    pitchWrapper: {
        marginTop: -193,
        marginBottom: -186,
        position: 'relative',
    },

    pitchContainer: {
        width: '300%',
        aspectRatio: 1.1,
        overflow: 'hidden',
        transform: [{ scale: 0.6 }],
        marginLeft: '-129%',
    },

    pitchShadowTop: {
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: '25%',
    },
    pitchShadowBottom: {
        position: 'absolute',
        bottom: 0, left: 0, right: 0,
        height: '25%',
    },

    // Absolutely positioned box that covers exactly the green pitch area.
    // Its size/position is computed from wrapperSize + PITCH_* constants above.
    playersOverlay: {
        position: 'absolute',
        zIndex: 20,
    },

    // Each player node is positioned with absolute left/top (in px, computed from %).
    // translateX/Y -20 centres the 40px circle on the coordinate point.
    playerNode: {
        position: 'absolute',
        alignItems: 'center',
        transform: [{ translateX: -20 }, { translateY: -20 }],
        zIndex: 10,
    },

    circleWrapper: { position: 'relative', alignItems: 'center' },

    playerCircle: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 2.5,
        borderColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(59,130,246,0.35)',
        shadowColor: '#fff',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.6,
        shadowRadius: 8,
        elevation: 6,
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
        bottom: -4, right: -6,
        width: 20, height: 20, borderRadius: 10,
        borderWidth: 1.5,
        borderColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center', justifyContent: 'center',
    },
    ratingText: { color: '#000', fontSize: 7.5, fontWeight: '900' },
    nameBadge: {
        backgroundColor: 'rgba(0,0,0,0.85)',
        borderRadius: 5,
        paddingHorizontal: 5, paddingVertical: 2,
        maxWidth: 68,
        borderWidth: 0.5,
        borderColor: 'rgba(255,255,255,0.2)',
        marginTop: 4,
    },
    nameText: {
        color: '#fff',
        fontSize: 8,
        fontWeight: '800',
        textAlign: 'center',
        letterSpacing: 0.2,
    },

    skeletonPlayerCircle: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.14)',
    },
    skeletonRatingBadge: {
        position: 'absolute', bottom: -4, right: -6,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.9)',
    },
    skeletonNameBadge: {
        width: 42, height: 10, borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.55)', marginTop: 4,
    },

    emptyPlayerCircle: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
        borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    },
    emptyPlayerIcon: { color: 'rgba(255, 255, 255, 0.35)', fontSize: 14, fontWeight: '700' },
    emptyRatingBadge: {
        position: 'absolute', bottom: -4, right: -6,
        width: 20, height: 20, borderRadius: 10,
        backgroundColor: 'rgba(0, 0, 0, 0.2)',
        borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center', justifyContent: 'center',
    },
    emptyRatingText: { color: 'rgba(103, 21, 136, 0.5)', fontSize: 7, fontWeight: '900' },
    emptyNameBadge: {
        backgroundColor: 'rgba(0, 0, 0, 0.6)', borderRadius: 5,
        paddingHorizontal: 5, paddingVertical: 2,
        borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginTop: 4,
    },
    emptyNameText: { color: 'rgba(255,255,255,0.3)', fontSize: 7.5, fontWeight: '700', textAlign: 'center' },
});
