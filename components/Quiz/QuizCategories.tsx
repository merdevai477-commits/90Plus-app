import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ImageBackground, Dimensions, ActivityIndicator } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { COLORS } from '../reels/constants';
import { LinearGradient } from 'expo-linear-gradient';
import { getQuizCategories, checkQuizCooldown, QuizCategory } from '../../services/quizApi';
import { Clock } from 'lucide-react-native';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

interface QuizCategoriesProps {
    onSelectCategory: (categoryId: string) => void;
}

// Map category names to local image resources
const CATEGORY_IMAGES: Record<string, any> = {
    'In Common': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'Flash': require('../../assets/Quiz/Flash.png'),
    'Who Am I?': require('../../assets/Quiz/احدذر من اللاعب.png'),
    'High Five': 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80',
    'Q&A': require('../../assets/Quiz/Mcq.png'),
    'Teammates': 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
    'Guess the Number': require('../../assets/Quiz/Guess the numer.png'),
    'Legends': require('../../assets/Quiz/legand.png'),
};

export const QuizCategories: React.FC<QuizCategoriesProps> = ({ onSelectCategory }) => {
    const { t } = useLanguage();
    const [categories, setCategories] = useState<QuizCategory[]>([]);
    const [loading, setLoading] = useState(true);
    const [cooldowns, setCooldowns] = useState<Record<string, { canStart: boolean; hoursRemaining?: number }>>({});

    useEffect(() => {
        loadCategories();
    }, []);

    const loadCategories = async () => {
        try {
            setLoading(true);
            const fetchedCategories = await getQuizCategories();
            setCategories(fetchedCategories);

            // Check cooldown for each category
            const cooldownMap: Record<string, { canStart: boolean; hoursRemaining?: number }> = {};
            for (const category of fetchedCategories) {
                try {
                    const cooldown = await checkQuizCooldown(category.id);
                    cooldownMap[category.id] = cooldown;
                } catch (error) {
                    // If error, assume can start
                    cooldownMap[category.id] = { canStart: true };
                }
            }
            setCooldowns(cooldownMap);
        } catch (error) {
            console.error('Error loading quiz categories:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryPress = async (category: QuizCategory) => {
        if (category.isLocked) {
            return;
        }

        // Check cooldown before starting
        const cooldown = cooldowns[category.id];
        if (cooldown && !cooldown.canStart) {
            // Show cooldown message
            return;
        }

        onSelectCategory(category.id);
    };

    const getCategoryImage = (categoryName: string) => {
        return CATEGORY_IMAGES[categoryName] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80';
    };

    const formatCooldownTime = (hours?: number) => {
        if (!hours) return '';
        if (hours < 1) {
            const minutes = Math.ceil(hours * 60);
            return `${minutes}m`;
        }
        return `${Math.ceil(hours)}h`;
    };

    if (loading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={COLORS.neonBlue} />
                <Text style={styles.loadingText}>Loading categories...</Text>
            </View>
        );
    }

    return (
        <ScrollView
            contentContainerStyle={styles.container}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Text style={styles.headerTitle}>Quiz Categories</Text>
                <Text style={styles.headerSubtitle}>Test your football knowledge</Text>
            </View>

            <View style={styles.grid}>
                {categories.map((category) => {
                    const cooldown = cooldowns[category.id];
                    const isOnCooldown = cooldown && !cooldown.canStart;
                    const imageSource = getCategoryImage(category.name);

                    return (
                        <View
                            key={category.id}
                            style={styles.cardContainer}
                        >
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => handleCategoryPress(category)}
                                disabled={category.isLocked || isOnCooldown}
                                style={styles.touchable}
                            >
                                <View style={styles.cardContent}>
                                    <ImageBackground
                                        source={typeof imageSource === 'string' ? { uri: imageSource } : imageSource}
                                        style={styles.imageBackground}
                                        imageStyle={[
                                            styles.imageStyle,
                                            category.name === 'Who Am I?' && {
                                                transform: [{ translateY: -78 }]
                                            }
                                        ]}
                                    >
                                        <LinearGradient
                                            colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                                            style={styles.gradient}
                                        />

                                        {(category.isLocked || isOnCooldown) && (
                                            <View style={styles.lockedOverlay}>
                                                <View style={styles.lockIconContainer}>
                                                    <Text style={styles.lockIcon}>
                                                        {category.isLocked ? '🔒' : '⏰'}
                                                    </Text>
                                                </View>
                                                {isOnCooldown && cooldown?.hoursRemaining && (
                                                    <Text style={styles.cooldownText}>
                                                        {formatCooldownTime(cooldown.hoursRemaining)}
                                                    </Text>
                                                )}
                                            </View>
                                        )}

                                        <View style={styles.textContainer}>
                                            <Text style={styles.title}>{category.name}</Text>
                                            {category.description && (
                                                <Text style={styles.description}>{category.description}</Text>
                                            )}
                                        </View>
                                    </ImageBackground>

                                    <View style={styles.glassBorder} />
                                </View>
                            </TouchableOpacity>
                        </View>
                    );
                })}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 100,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
    },
    loadingText: {
        color: COLORS.white,
        marginTop: 16,
        fontSize: 16,
    },
    header: {
        marginBottom: 24,
        marginTop: 16,
    },
    headerTitle: {
        fontSize: 28,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 8,
    },
    headerSubtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.6)',
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
    },
    cardContainer: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginBottom: 16,
    },
    touchable: {
        flex: 1,
    },
    cardContent: {
        flex: 1,
        borderRadius: 20,
        overflow: 'hidden',
        backgroundColor: COLORS.deepBlack,
        elevation: 5,
        shadowColor: COLORS.neonBlue,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
    },
    imageBackground: {
        flex: 1,
        justifyContent: 'flex-end',
    },
    imageStyle: {
        borderRadius: 20,
    },
    gradient: {
        ...StyleSheet.absoluteFillObject,
    },
    textContainer: {
        padding: 16,
        zIndex: 10,
    },
    title: {
        color: COLORS.white,
        fontSize: 18,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    description: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 12,
        marginTop: 4,
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    glassBorder: {
        ...StyleSheet.absoluteFillObject,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        pointerEvents: 'none',
    },
    lockedOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        zIndex: 5,
    },
    lockIconContainer: {
        width: 50,
        height: 50,
        borderRadius: 25,
        backgroundColor: 'rgba(255,255,255,0.2)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    lockIcon: {
        fontSize: 24,
    },
    cooldownText: {
        color: COLORS.white,
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 8,
        textShadowColor: 'rgba(0,0,0,0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
});

