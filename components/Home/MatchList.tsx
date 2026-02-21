import React, { useMemo } from 'react';
import { View, Text, FlatList, StyleSheet, TouchableOpacity } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { COLORS } from '../reels/constants';
import { Match } from '../../src/store/home.store';
import { useTranslation } from '../../src/i18n';
import { SkeletonCard } from '../ui/Skeleton';
import { Colors, Typography, Spacing, BorderRadius } from '../../src/designSystem/designSystem';
import GradientMatchCard, { Match as GradientMatch } from '../league-center/GradientMatchCard';

interface MatchListProps {
    matches: Match[];
    onMatchPress: (matchId: string) => void;
    onViewAllPress: () => void;
    onFavoritePress: (matchId: string) => void;
}

/**
 * Maps home store match to gradient match card format
 */
const mapStoreMatchToGradientMatch = (storeMatch: Match): GradientMatch => ({
    id: storeMatch.id,
    homeTeam: {
        name: storeMatch.homeTeam,
        logo: storeMatch.homeLogo || 'https://placehold.co/100x100/png'
    },
    awayTeam: {
        name: storeMatch.awayTeam,
        logo: storeMatch.awayLogo || 'https://placehold.co/100x100/png'
    },
    score: {
        home: storeMatch.homeScore || 0,
        away: storeMatch.awayScore || 0
    },
    status: storeMatch.isLive ? 'live' : (storeMatch.homeScore !== undefined ? 'finished' : 'upcoming'),
    statusShort: storeMatch.statusShort,
    minute: storeMatch.minute,
    startTimestamp: storeMatch.startTimestamp,
    time: storeMatch.time,
    league: {
        id: storeMatch.leagueId,
        name: storeMatch.league,
        logo: '' // League logo not in home store match yet
    },
    fixtureDate: storeMatch.date,
    isFavorited: storeMatch.isFavorited
});

export const MatchList: React.FC<MatchListProps> = ({ matches, onMatchPress, onViewAllPress, onFavoritePress }) => {
    const { t } = useTranslation();
    const isLoading = matches.length === 0;

    const renderItem = React.useCallback(({ item, index }: { item: Match, index: number }) => (
        <Animated.View
            entering={FadeInDown.delay(index * 50).springify().damping(15)}
            style={{ width: 330 }}
        >
            <GradientMatchCard
                match={mapStoreMatchToGradientMatch(item)}
                gradientIndex={index}
                onPress={() => onMatchPress(item.id)}
                onFavoritePress={() => onFavoritePress(item.id)}
            />
        </Animated.View>
    ), [onMatchPress, onFavoritePress]);

    const renderSkeleton = React.useCallback(({ index }: { index: number }) => (
        <Animated.View
            entering={FadeInDown.delay(index * 50)}
            style={{ marginRight: Spacing.md }}
        >
            <SkeletonCard width={330} height={180} />
        </Animated.View>
    ), []);

    const skeletonData = useMemo(() => Array.from({ length: 3 }, (_, i) => ({ id: `skeleton-${i}` })), []);

    return (
        <Animated.View entering={FadeInDown.delay(100)} style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t.home.importantMatches || 'Important Matches'}</Text>
                {!isLoading && (
                    <TouchableOpacity
                        onPress={onViewAllPress}
                        accessibilityLabel="View all matches"
                        accessibilityRole="button"
                    >
                        <Text style={styles.viewAll}>{t.home.viewAll || 'View All'}</Text>
                    </TouchableOpacity>
                )}
            </View>

            {isLoading ? (
                <FlatList
                    data={skeletonData}
                    renderItem={renderSkeleton}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
                    initialNumToRender={3}
                />
            ) : (
                <FlatList
                    data={matches}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.listContent}
                    ItemSeparatorComponent={() => <View style={{ width: Spacing.md }} />}
                    initialNumToRender={3}
                    windowSize={3}
                    maxToRenderPerBatch={3}
                    removeClippedSubviews={true}
                    getItemLayout={(data, index) => ({
                        length: 330 + Spacing.md,
                        offset: (330 + Spacing.md) * index,
                        index,
                    })}
                />
            )}
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: Spacing.lg,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: Spacing.md,
        marginBottom: Spacing.md,
        paddingTop: Spacing.sm,
    },
    title: {
        ...Typography.title.large,
        color: Colors.onSurface.primary,
        fontWeight: Typography.title.large.fontWeight,
    },
    viewAll: {
        ...Typography.label.medium,
        color: Colors.primary[500],
        fontWeight: Typography.label.medium.fontWeight,
    },
    listContent: {
        paddingHorizontal: Spacing.md,
    },
});

