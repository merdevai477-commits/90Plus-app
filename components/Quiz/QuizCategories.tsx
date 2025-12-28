import React from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { COLORS } from '../reels/constants';
import { LinearGradient } from 'expo-linear-gradient';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

interface QuizCategoriesProps {
    onSelectCategory: (category: string) => void;
}

export const QuizCategories: React.FC<QuizCategoriesProps> = ({ onSelectCategory }) => {
    const { t } = useLanguage();

    const CATEGORIES = [
        {
            id: 'in_common',
            title: 'In Common',
            image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
            mode: 'CLASSIC',
            locked: false
        },
        {
            id: 'flash',
            title: 'Flash',
            image: require('../../assets/Quiz/Flash.png'),
            mode: 'SPEED',
            locked: false
        },
        {
            id: 'who_am_i',
            title: 'Who Am I?',
            image: require('../../assets/Quiz/احدذر من اللاعب.png'),
            mode: 'PICTURE',
            locked: false
        },
        {
            id: 'high_five',
            title: 'High Five',
            image: 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80',
            mode: 'EXPERT',
            locked: false
        },
        {
            id: 'qa',
            title: 'Q&A',
            image: require('../../assets/Quiz/Mcq.png'),
            mode: 'CLASSIC',
            locked: false
        },
        {
            id: 'teammates',
            title: 'Teammates',
            image: 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
            mode: 'CLASSIC',
            locked: true
        },
        {
            id: 'guess_number',
            title: 'Guess the Number',
            image: require('../../assets/Quiz/Guess the numer.png'),
            mode: 'EXPERT',
            locked: false
        },
        {
            id: 'legends',
            title: 'Legends',
            image: require('../../assets/Quiz/legand.png'),
            mode: 'EXPERT',
            locked: true
        }
    ];

    console.log('🎯 QuizCategories rendering with', CATEGORIES.length, 'categories');

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
                {CATEGORIES.map((category, index) => (
                    <View
                        key={category.id}
                        style={styles.cardContainer}
                    >
                        <TouchableOpacity
                            activeOpacity={0.85}
                            onPress={() => {
                                console.log('🎯 Category pressed:', category.title);
                                onSelectCategory(category.mode);
                            }}
                            disabled={category.locked}
                            style={styles.touchable}
                        >
                            <View style={styles.cardContent}>
                                <ImageBackground
                                    source={typeof category.image === 'string' ? { uri: category.image } : category.image}
                                    style={styles.imageBackground}
                                    imageStyle={[
                                        styles.imageStyle,
                                        category.id === 'who_am_i' && {
                                            transform: [{ translateY: -78 }]
                                        }
                                    ]}
                                >
                                    <LinearGradient
                                        colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                                        style={styles.gradient}
                                    />

                                    {category.locked && (
                                        <View style={styles.lockedOverlay}>
                                            <View style={styles.lockIconContainer}>
                                                <Text style={styles.lockIcon}>🔒</Text>
                                            </View>
                                        </View>
                                    )}

                                    <View style={styles.textContainer}>
                                        <Text style={styles.title}>{category.title}</Text>
                                    </View>
                                </ImageBackground>

                                <View style={styles.glassBorder} />
                            </View>
                        </TouchableOpacity>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        padding: 16,
        paddingBottom: 100,
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
});
