import React, { useRef } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { View, Text, Image, Animated, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { styles } from './homeStyles';
import { COLORS, GRADIENTS } from '../reels/constants';
import { useLanguage } from '../../contexts/LanguageContext';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const CARD_WIDTH = SCREEN_WIDTH * 0.85;
const SPACING = 12;
const SNAP_INTERVAL = CARD_WIDTH + SPACING;

interface HeroItem {
    id: string;
    title: string;
    subtitle: string;
    image: string;
    tag: string;
}

const HERO_ITEMS: HeroItem[] = [
    {
        id: '1',
        title: 'Big Match: Top Teams Clash',
        subtitle: 'Match of the Week • Sat 21:00',
        image: 'https://images.unsplash.com/photo-1504454133178-d4888688edee?w=800&h=600&fit=crop',
        tag: 'Featured',
    },
    {
        id: '2',
        title: 'Daily Challenge: Crossbar Challenge',
        subtitle: 'Win 500 Points • Ends in 2h',
        image: 'https://images.unsplash.com/photo-1579952363873-27f3bade9f55?w=800&h=600&fit=crop',
        tag: 'Challenge',
    },
    {
        id: '3',
        title: 'Top 5 Goals of the Month',
        subtitle: 'Watch Now • 45k Views',
        image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&h=600&fit=crop',
        tag: 'Trending',
    },
];

export const HeroSection: React.FC = () => {
    const scrollX = useRef(new Animated.Value(0)).current;
    const { t, isRTL } = useLanguage();

    // homeStyles exports an untyped StyleSheet, which TS may widen to ViewStyle|TextStyle|ImageStyle.
    // Locally narrow the specific keys we use so component props get the right style types.
    const s = styles as unknown as {
        heroContainer: ViewStyle;
        heroScrollContent: ViewStyle;
        heroCard: ViewStyle;
        heroImage: ImageStyle;
        heroOverlay: ViewStyle;
        heroTag: ViewStyle;
        heroTagText: TextStyle;
        heroTitle: TextStyle;
        heroSubtitle: TextStyle;
    };

    return (
        <View style={s.heroContainer}>
            <Animated.ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                snapToInterval={SNAP_INTERVAL}
                decelerationRate="fast"
                contentContainerStyle={[
                    s.heroScrollContent,
                    { paddingRight: SCREEN_WIDTH - CARD_WIDTH - 20 } // Add padding to end
                ]}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: true }
                )}
                scrollEventThrottle={16}
            >
                {HERO_ITEMS.map((item, index) => {
                    const inputRange = [
                        (index - 1) * SNAP_INTERVAL,
                        index * SNAP_INTERVAL,
                        (index + 1) * SNAP_INTERVAL,
                    ];

                    const scale = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.9, 1, 0.9],
                        extrapolate: 'clamp',
                    });

                    const opacity = scrollX.interpolate({
                        inputRange,
                        outputRange: [0.6, 1, 0.6],
                        extrapolate: 'clamp',
                    });

                    return (
                        <TouchableOpacity key={item.id} activeOpacity={0.9}>
                            <Animated.View
                                style={[
                                    s.heroCard,
                                    {
                                        transform: [{ scale }],
                                        opacity,
                                        marginRight: index === HERO_ITEMS.length - 1 ? 0 : SPACING,
                                    },
                                ]}
                            >
                                <Image source={{ uri: item.image }} style={s.heroImage} resizeMode="cover" />

                                <LinearGradient
                                    colors={['transparent', 'rgba(0,0,0,0.8)', COLORS.deepBlack]}
                                    style={s.heroOverlay}
                                />

                                <View style={s.heroTag}>
                                    <Text style={s.heroTagText}>{item.tag}</Text>
                                </View>

                                <View style={s.heroOverlay}>
                                    <Text style={s.heroTitle} numberOfLines={2}>{item.title}</Text>
                                    <Text style={s.heroSubtitle}>{item.subtitle}</Text>
                                </View>
                            </Animated.View>
                        </TouchableOpacity>
                    );
                })}
            </Animated.ScrollView>
        </View>
    );
};
