import React, { useRef, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, LayoutAnimation, Platform, UIManager } from 'react-native';
import { Image } from 'expo-image';
import { ChevronDown } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import MatchCard from './MatchCard';
import { Match } from '../../services/apiFootball';

if (Platform.OS === 'android') {
    if (UIManager.setLayoutAnimationEnabledExperimental) {
        UIManager.setLayoutAnimationEnabledExperimental(true);
    }
}

interface LeagueAccordionItemProps {
    league: {
        id: string;
        name: string;
        logo: string;
        country: string;
    };
    matches: Match[];
    isExpanded: boolean;
    onToggle: () => void;
    onMatchPress: (match: Match) => void;
    onPredictionSubmit: (matchId: string, prediction: any) => void;
    userPredictions: any;
    activeTab: string;
}

const LeagueAccordionItem: React.FC<LeagueAccordionItemProps> = ({
    league,
    matches,
    isExpanded,
    onToggle,
    onMatchPress,
    onPredictionSubmit,
    userPredictions,
    activeTab
}) => {
    const rotateAnim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        Animated.timing(rotateAnim, {
            toValue: isExpanded ? 1 : 0,
            duration: 300,
            useNativeDriver: true,
        }).start();
    }, [isExpanded]);

    const rotate = rotateAnim.interpolate({
        inputRange: [0, 1],
        outputRange: ['0deg', '180deg'],
    });

    return (
        <View style={styles.container}>
            <TouchableOpacity
                style={styles.header}
                onPress={() => {
                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                    onToggle();
                }}
                activeOpacity={0.9}
            >
                <LinearGradient
                    colors={['rgba(255,255,255,0.05)', 'rgba(255,255,255,0.02)']}
                    style={styles.headerGradient}
                >
                    <View style={styles.leagueInfo}>
                        <Image source={{ uri: league.logo }} style={styles.logo} contentFit="contain" />
                        <View>
                            <Text style={styles.leagueName}>{league.name}</Text>
                            <Text style={styles.matchCount}>{matches.length} مباريات</Text>
                        </View>
                    </View>

                    <Animated.View style={{ transform: [{ rotate }] }}>
                        <ChevronDown size={20} color="#666" />
                    </Animated.View>
                </LinearGradient>
            </TouchableOpacity>

            {isExpanded && (
                <View style={styles.content}>
                    {matches.map((match) => (
                        <MatchCard
                            key={match.id}
                            match={match}
                            onPredictionSubmit={onPredictionSubmit}
                            showPrediction={activeTab === 'predictions'}
                            userPredictions={userPredictions}
                            onPress={() => onMatchPress(match)}
                        />
                    ))}
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        marginBottom: 12,
        borderRadius: 16,
        overflow: 'hidden',
        backgroundColor: 'rgba(20,20,20,0.6)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.05)',
    },
    header: {
        overflow: 'hidden',
    },
    headerGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 16,
    },
    leagueInfo: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    logo: {
        width: 32,
        height: 32,
    },
    leagueName: {
        fontSize: 16,
        fontWeight: 'bold',
        color: '#fff',
    },
    matchCount: {
        fontSize: 12,
        color: '#888',
        marginTop: 2,
    },
    content: {
        padding: 8,
        paddingTop: 0,
    },
});

export default LeagueAccordionItem;
