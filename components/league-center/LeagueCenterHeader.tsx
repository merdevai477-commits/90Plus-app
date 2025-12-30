import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { Zap, Ticket } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { useHaptic } from '../../hooks/useHaptic';

interface LeagueCenterHeaderProps {
    onFilterPress: () => void;
    filterCount?: number;
    activeTab: 'matches' | 'predictions';
    onTabChange: (tab: 'matches' | 'predictions') => void;
    matchCount?: number;
    leagueCount?: number;
    userCoins?: number;
    remainingPredictions?: number;
    totalPredictions?: number;
}

const LeagueCenterHeader: React.FC<LeagueCenterHeaderProps> = ({
    onFilterPress,
    filterCount = 0,
    activeTab,
    onTabChange,
    matchCount = 0,
    leagueCount = 0,
    userCoins = 0,
    remainingPredictions = 5,
    totalPredictions = 5,
}) => {
    const insets = useSafeAreaInsets();
    const { trigger } = useHaptic();

    const handleFilterPress = () => {
        trigger('selection');
        onFilterPress();
    };

    const handleTabPress = (tab: 'matches' | 'predictions') => {
        if (activeTab !== tab) {
            trigger('selection');
            onTabChange(tab);
        }
    };

    return (
        <View style={styles.outerContainer}>
            <LinearGradient
                colors={['rgba(15, 15, 26, 0.95)', 'rgba(15, 15, 26, 0.8)']}
                style={[styles.container, { paddingTop: insets.top + 10 }]}
            >
                {/* Top Row: Title & Coins */}
                <View style={styles.headerTop}>
                    <Text style={styles.title}>Matches</Text>

                    <View style={styles.headerRight}>
                        <View style={styles.topBadgesRow}>
                            {/* Coin Balance */}
                            <View style={styles.coinBadge}>
                                <Zap size={16} color="#FFD700" fill="#FFD700" />
                                <Text style={styles.coinText}>{userCoins.toLocaleString()}</Text>
                            </View>

                            {/* Daily Prediction Counter */}
                            <View style={styles.predictionCounterBadge}>
                                <Ticket size={14} color="#60a5fa" fill="#60a5fa" />
                                <Text style={styles.predictionCounterText}>{remainingPredictions}/{totalPredictions}</Text>
                            </View>
                        </View>

                        {/* Summary Badges */}
                        <View style={{ flexDirection: 'row', gap: 6 }}>
                            {/* Matches Badge (Red) */}
                            <View style={[styles.summaryBadge, styles.matchesBadge]}>
                                <View style={styles.liveDot} />
                                <Text style={styles.matchesText}>
                                    {matchCount} Matches
                                </Text>
                            </View>

                            {/* Leagues Badge (Green) */}
                            <View style={[styles.summaryBadge, styles.leaguesBadge]}>
                                <Text style={styles.leaguesText}>
                                    {leagueCount} Leagues
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* Bottom Row: Tabs & Filter */}
                <View style={styles.headerBottom}>
                    <View style={styles.tabsContainer}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'matches' && styles.activeTab]}
                            onPress={() => handleTabPress('matches')}
                        >
                            <Ionicons
                                name="football"
                                size={16}
                                color={activeTab === 'matches' ? '#fff' : 'rgba(255,255,255,0.6)'}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.tabText, activeTab === 'matches' && styles.activeTabText]}>
                                Matches
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'predictions' && styles.activeTab]}
                            onPress={() => handleTabPress('predictions')}
                        >
                            <Ionicons
                                name="analytics"
                                size={16}
                                color={activeTab === 'predictions' ? '#fff' : 'rgba(255,255,255,0.6)'}
                                style={{ marginRight: 6 }}
                            />
                            <Text style={[styles.tabText, activeTab === 'predictions' && styles.activeTabText]}>
                                Predictions
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={styles.filterButton}
                        onPress={handleFilterPress}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="filter" size={20} color="#FFFFFF" />
                        {filterCount > 0 && (
                            <View style={styles.badge}>
                                <Text style={styles.badgeText}>{filterCount}</Text>
                            </View>
                        )}
                    </TouchableOpacity>
                </View>
            </LinearGradient>

            {/* Divider Gradient */}
            <LinearGradient
                colors={['transparent', 'rgba(139, 92, 246, 0.3)', 'transparent']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={{ height: 1 }}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    outerContainer: {
        zIndex: 100,
    },
    container: {
        paddingHorizontal: 20,
        paddingBottom: 16,
    },
    headerTop: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 16,
    },
    title: {
        fontSize: 26,
        fontWeight: '900',
        color: '#FFFFFF',
        letterSpacing: -0.5,
    },
    headerRight: {
        alignItems: 'flex-end',
        gap: 6,
    },
    coinBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.1)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 4,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    coinText: {
        color: '#fff',
        fontWeight: '700',
        fontSize: 13,
    },
    plusButton: {
        marginLeft: 2,
    },
    summaryBadge: {
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
    },
    matchesBadge: {
        backgroundColor: 'rgba(239, 68, 68, 0.15)',
        borderColor: 'rgba(239, 68, 68, 0.3)',
        gap: 4,
    },
    leaguesBadge: {
        backgroundColor: 'rgba(34, 197, 94, 0.15)',
        borderColor: 'rgba(34, 197, 94, 0.3)',
    },
    liveDot: {
        width: 6,
        height: 6,
        borderRadius: 3,
        backgroundColor: '#ef4444',
    },
    matchesText: {
        color: '#ef4444',
        fontSize: 10,
        fontWeight: '700',
    },
    leaguesText: {
        color: '#22c55e',
        fontSize: 10,
        fontWeight: '700',
    },
    headerBottom: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: 12,
    },
    tabsContainer: {
        flex: 1,
        flexDirection: 'row',
        backgroundColor: 'rgba(0, 0, 0, 0.3)',
        borderRadius: 16,
        padding: 4,
        gap: 4,
    },
    tab: {
        flex: 1,
        flexDirection: 'row',
        paddingVertical: 8,
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 12,
    },
    activeTab: {
        backgroundColor: 'rgba(139, 92, 246, 0.6)',
    },
    tabText: {
        color: 'rgba(255, 255, 255, 0.6)',
        fontSize: 13,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#FFFFFF',
        fontWeight: '700',
    },
    filterButton: {
        width: 40,
        height: 40,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    badge: {
        position: 'absolute',
        top: -2,
        right: -2,
        backgroundColor: '#ef4444',
        borderRadius: 8,
        minWidth: 16,
        height: 16,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 2,
        borderColor: '#0F0F1A',
    },
    badgeText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: 'bold',
    },
    topBadgesRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    predictionCounterBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(59, 130, 246, 0.15)',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 20,
        gap: 6,
        borderWidth: 1,
        borderColor: 'rgba(59, 130, 246, 0.3)',
    },
    predictionCounterText: {
        color: '#60a5fa',
        fontWeight: '700',
        fontSize: 13,
    },
});

export default LeagueCenterHeader;
