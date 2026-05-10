// @ts-nocheck
import React, { useEffect } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Trophy } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { SectionHeader } from './SectionHeader';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Rect, Line, Circle, Path } from 'react-native-svg';
import Animated, {
    useSharedValue, useAnimatedStyle, withRepeat, withTiming, withDelay, withSpring, Easing,
} from 'react-native-reanimated';
import { PURPLE_PRIMARY, SCREEN_PADDING_H } from '../../constants/tokens';

export type PitchPlayerItem = {
    name: string;
    short: string;
    rating: number;
    position: string;
    x: number;
    y: number;
    username?: string;
};

const DEFAULT_POSITIONS = [
    { x: -1, y: 40 }, { x: 24, y: 1 }, { x: 14, y: 23 }, { x: 14, y: 56 },
    { x: 25, y: 75 }, { x: 40, y: 46 }, { x: 54, y: 23 }, { x: 54, y: 64 },
    { x: 82, y: 10 }, { x: 88, y: 45 }, { x: 82, y: 80 },
];

const DEFAULT_PLAYERS: PitchPlayerItem[] = [
    { name: 'Ederson', short: 'EDR', rating: 87, position: 'GK', x: -1, y: 40 },
    { name: 'Alexander-Arnold', short: 'TAA', rating: 86, position: 'RB', x: 24, y: 1 },
    { name: 'Ruben Dias', short: 'DIA', rating: 88, position: 'CB', x: 14, y: 23 },
    { name: 'Gabriel', short: 'GAB', rating: 86, position: 'CB', x: 14, y: 56 },
    { name: 'Alphonso Davies', short: 'DAV', rating: 85, position: 'LB', x: 25, y: 75 },
    { name: 'Rodri', short: 'ROD', rating: 91, position: 'DM', x: 40, y: 46 },
    { name: 'De Bruyne', short: 'KDB', rating: 91, position: 'CM', x: 54, y: 23 },
    { name: 'Pedri', short: 'PED', rating: 88, position: 'CM', x: 54, y: 64 },
    { name: 'Saka', short: 'SAK', rating: 87, position: 'RW', x: 82, y: 10 },
    { name: 'Haaland', short: 'HAL', rating: 93, position: 'ST', x: 88, y: 45 },
    { name: 'Vinicius', short: 'VIN', rating: 92, position: 'LW', x: 82, y: 80 },
];

function PitchSVG() {
    return (
        <View style={StyleSheet.absoluteFill}>
            <Svg viewBox="0 0 160 100" width="100%" height="100%" preserveAspectRatio="none">
                <Rect x="2" y="3" width="156" height="96" stroke="rgba(255,255,255,0.5)" strokeWidth="0.6" fill="none" rx="0.5" />
                <Line x1="80" y1="2" x2="80" y2="98" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" />
                <Circle cx="80" cy="50" r="12" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" fill="none" />
                <Circle cx="80" cy="50" r="0.8" fill="rgba(255,255,255,0.6)" />
                <Rect x="2" y="22" width="22" height="56" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" fill="none" />
                <Rect x="2" y="35" width="10" height="30" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" fill="none" />
                <Circle cx="14" cy="50" r="0.8" fill="rgba(255,255,255,0.6)" />
                <Path d="M 24 36 A 13 13 0 0 0 24 64" stroke="rgba(255,255,255,0.42)" strokeWidth="0.5" fill="none" />
                <Rect x="136" y="22" width="22" height="56" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" fill="none" />
                <Rect x="148" y="35" width="10" height="30" stroke="rgba(255,255,255,0.45)" strokeWidth="0.5" fill="none" />
                <Circle cx="146" cy="50" r="0.8" fill="rgba(255,255,255,0.6)" />
                <Path d="M 136 36 A 13 13 0 0 1 136 64" stroke="rgba(255,255,255,0.42)" strokeWidth="0.5" fill="none" />
            </Svg>
        </View>
    );
}

function PlayerNode({ player, index, onPress }: { player: PitchPlayerItem; index: number; onPress?: () => void }) {
    const opacity = useSharedValue(0);
    const scale = useSharedValue(0.5);
    const translateY = useSharedValue(-20);

    useEffect(() => {
        const delay = 100 + index * 70;
        opacity.value = withDelay(delay, withTiming(1, { duration: 300 }));
        scale.value = withDelay(delay, withSpring(1, { stiffness: 180, damping: 12 }));
        translateY.value = withDelay(delay, withSpring(0, { stiffness: 180, damping: 12 }));
    }, []);

    const animatedStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }, { translateY: translateY.value }],
    }));

    const ratingColor = player.rating >= 90 ? '#FFD700' : player.rating >= 85 ? '#32CD32' : '#11998E';

    return (
        <Animated.View style={[styles.playerNode, { left: `${player.x}%`, top: `${player.y}%` }, animatedStyle] as any}>
            <TouchableOpacity activeOpacity={0.8} onPress={onPress} disabled={!onPress}>
                <View style={styles.circleWrapper}>
                    <LinearGradient colors={['rgba(59,130,246,0.15)', 'rgba(124,58,237,0.15)']} style={styles.playerCircle}>
                        <Text style={styles.playerShort}>{player.short}</Text>
                    </LinearGradient>
                    <LinearGradient colors={[ratingColor, `${ratingColor}CC`]} style={styles.ratingBadge}>
                        <Text style={styles.ratingText}>{player.rating}</Text>
                    </LinearGradient>
                </View>
                <View style={styles.nameBadge}>
                    <Text style={styles.nameText} numberOfLines={1}>
                        {(player.name || '').split(' ').slice(-1)[0] || player.name}
                    </Text>
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
}

function EmptyPlayerNode({ x, y, index }: { x: number; y: number; index: number }) {
    const opacity = useSharedValue(0.4);
    useEffect(() => {
        opacity.value = withDelay(
            index * 200,
            withRepeat(withTiming(0.7, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true),
        );
    }, []);
    const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

    return (
        <Animated.View style={[styles.playerNode, { left: `${x}%`, top: `${y}%` }, animatedStyle] as any}>
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
        </Animated.View>
    );
}

function PitchEmptyOverlay() {
    const scale = useSharedValue(1);
    const opacity = useSharedValue(1);
    useEffect(() => {
        scale.value = withRepeat(withTiming(1.15, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
        opacity.value = withRepeat(withTiming(0, { duration: 2000, easing: Easing.inOut(Easing.ease) }), -1, true);
    }, []);
    const ringStyle = useAnimatedStyle(() => ({
        opacity: opacity.value,
        transform: [{ scale: scale.value }],
    }));
    return (
        <View style={styles.pitchEmptyOverlay}>
            <Animated.View style={[styles.pulseRing, ringStyle] as any} />
            <Trophy size={28} color="rgba(253,224,71,0.55)" strokeWidth={2} />
        </View>
    );
}

interface TeamPitchProps {
    hasLineup?: boolean;
    players?: PitchPlayerItem[];
    onPlayerPress?: (player: PitchPlayerItem) => void;
    onDetailsPress?: () => void;
}

export function TeamPitch({ hasLineup, players: playersProp, onPlayerPress, onDetailsPress }: TeamPitchProps) {
    const router = useRouter();
    const data = playersProp && playersProp.length > 0 ? playersProp : DEFAULT_PLAYERS;
    const hasData = hasLineup ?? (playersProp ? playersProp.length > 0 : true);

    return (
        <View style={styles.container}>
            <SectionHeader
                subtitle="Formation"
                title="Team of the month"
                badge="4-3-3"
                action="Details"
                onAction={() => (onDetailsPress ? onDetailsPress() : router.push('/rank'))}
            />

            <View style={styles.pitchWrapper}>
                <LinearGradient
                    colors={['rgba(59,130,246,0.3)', 'rgba(124,58,237,0.4)', 'rgba(59,130,246,0.3)']}
                    start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                    style={styles.pitchBorderGradient}
                />
                <View style={styles.pitchContainer}>
                    <LinearGradient
                        colors={['#165a2f', '#1a6634', '#1e7239', '#1e7239', '#1a6634', '#165a2f']}
                        start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                        style={StyleSheet.absoluteFill}
                    />
                    <View style={StyleSheet.absoluteFill}>
                        {Array.from({ length: 16 }).map((_, i) => (
                            <LinearGradient
                                key={i}
                                colors={
                                    i % 2 === 0
                                        ? ['rgba(255,255,255,0.04)', 'rgba(255,255,255,0.02)', 'rgba(255,255,255,0.04)']
                                        : ['rgba(0,0,0,0.04)', 'rgba(0,0,0,0.02)', 'rgba(0,0,0,0.04)']
                                }
                                start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
                                style={{ position: 'absolute', top: 0, bottom: 0, left: `${i * 6.25}%`, width: '6.25%' }}
                            />
                        ))}
                    </View>
                    <PitchSVG />
                    {hasData ? (
                        <View style={styles.playersContainer}>
                            {data.map((p, i) => (
                                <PlayerNode
                                    key={`${p.short}-${i}`}
                                    player={p}
                                    index={i}
                                    onPress={onPlayerPress ? () => onPlayerPress(p) : undefined}
                                />
                            ))}
                        </View>
                    ) : (
                        <>
                            <View style={styles.playersContainer}>
                                {DEFAULT_POSITIONS.map((pos, i) => (
                                    <EmptyPlayerNode key={`empty-${i}`} x={pos.x} y={pos.y} index={i} />
                                ))}
                            </View>
                            <PitchEmptyOverlay />
                        </>
                    )}
                </View>
            </View>

            {!hasData && (
                <View style={styles.pitchEmptyText}>
                    <Text style={styles.pitchEmptyTitle}>Monthly heroes incoming</Text>
                    <Text style={styles.pitchEmptySubtitle}>Stay active to make the XI</Text>
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { paddingHorizontal: SCREEN_PADDING_H, paddingBottom: 16 },
    pitchWrapper: { borderRadius: 22, padding: 1.5, overflow: 'hidden' },
    pitchBorderGradient: { ...StyleSheet.absoluteFillObject, borderRadius: 22 },
    pitchContainer: { width: '100%', aspectRatio: 1.6, borderRadius: 20, overflow: 'hidden', elevation: 10 },
    playersContainer: { position: 'absolute', top: '7%', bottom: '7%', left: '3%', right: '3%' },
    playerNode: {
        position: 'absolute', alignItems: 'center', gap: 3,
        transform: [{ translateX: -18 }, { translateY: -18 }], zIndex: 10,
    },
    circleWrapper: { position: 'relative', alignItems: 'center' },
    playerCircle: {
        width: 36, height: 36, borderRadius: 18,
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.85)',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: PURPLE_PRIMARY, shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.4, shadowRadius: 6, elevation: 4,
    },
    playerShort: {
        color: '#fff', fontSize: 9.5, fontWeight: '900',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
    },
    ratingBadge: {
        position: 'absolute', bottom: -3, right: -5,
        width: 18, height: 18, borderRadius: 9,
        borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center', justifyContent: 'center',
    },
    ratingText: { color: '#000', fontSize: 7, fontWeight: '900' },
    nameBadge: {
        backgroundColor: 'rgba(0,0,0,0.8)',
        borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
        maxWidth: 64, borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.1)', marginTop: 4,
    },
    nameText: {
        color: 'rgba(255,255,255,0.95)', fontSize: 7.5, fontWeight: '800',
        textAlign: 'center', letterSpacing: 0.2,
    },
    emptyPlayerCircle: {
        width: 36, height: 36, borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 2, borderColor: 'rgba(255,255,255,0.25)',
        borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center',
    },
    emptyPlayerIcon: { color: 'rgba(255,255,255,0.35)', fontSize: 14, fontWeight: '700' },
    emptyRatingBadge: {
        position: 'absolute', bottom: -3, right: -5,
        width: 18, height: 18, borderRadius: 9,
        backgroundColor: 'rgba(255,255,255,0.2)',
        borderWidth: 1.5, borderColor: 'rgba(0,0,0,0.9)',
        alignItems: 'center', justifyContent: 'center',
    },
    emptyRatingText: { color: 'rgba(255,255,255,0.5)', fontSize: 7, fontWeight: '900' },
    emptyNameBadge: {
        backgroundColor: 'rgba(0,0,0,0.6)',
        borderRadius: 5, paddingHorizontal: 5, paddingVertical: 2,
        borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.06)', marginTop: 4,
    },
    emptyNameText: { color: 'rgba(255,255,255,0.3)', fontSize: 7.5, fontWeight: '700', textAlign: 'center' },
    pitchEmptyOverlay: {
        ...StyleSheet.absoluteFillObject,
        alignItems: 'center', justifyContent: 'center',
        backgroundColor: 'rgba(0,0,0,0.25)',
    },
    pulseRing: {
        position: 'absolute', width: 80, height: 80, borderRadius: 40,
        borderWidth: 1.5, borderColor: 'rgba(124,58,237,0.4)', borderStyle: 'dashed',
    },
    pitchEmptyText: { alignItems: 'center', marginTop: 16, gap: 4 },
    pitchEmptyTitle: { color: 'rgba(255,255,255,0.5)', fontSize: 14, fontWeight: '700' },
    pitchEmptySubtitle: { color: 'rgba(255,255,255,0.3)', fontSize: 12 },
});
