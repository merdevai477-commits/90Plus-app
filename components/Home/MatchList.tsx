import React from 'react';
import { View, Text, FlatList, StyleSheet, Image, TouchableOpacity, Animated } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../reels/constants';
import { Match } from '../../src/store/home.store';
import { LinearGradient } from 'expo-linear-gradient';
import { useTranslation } from '../../src/i18n';
import { LiveTimer } from '../common/LiveTimer';

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

    const renderItem = React.useCallback(({ item, index }: { item: Match, index: number }) => (
        <View style={{ width: 330 }}>
            <GradientMatchCard
                match={mapStoreMatchToGradientMatch(item)}
                gradientIndex={index}
                onPress={() => onMatchPress(item.id)}
                onFavoritePress={() => onFavoritePress(item.id)}
            />
        </View>
    ), [onMatchPress, onFavoritePress]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>{t.home.importantMatches || 'Important Matches'}</Text>
                <TouchableOpacity onPress={onViewAllPress}>
                    <Text style={styles.viewAll}>{t.home.viewAll || 'View All'}</Text>
                </TouchableOpacity>
            </View>

            <FlatList
                data={matches}
                renderItem={renderItem}
                keyExtractor={(item) => item.id}
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.listContent}
                ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
                initialNumToRender={3}
                windowSize={3}
                maxToRenderPerBatch={3}
                removeClippedSubviews={true}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 24,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        marginBottom: 12,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFFFFF',
    },
    viewAll: {
        fontSize: 14,
        color: '#32cd32',
    },
    listContent: {
        paddingHorizontal: 16,
    },
});

