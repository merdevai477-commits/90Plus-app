import React, { useState } from 'react';
import { 
    View, 
    StyleSheet, 
    ScrollView, 
    Text, 
    TouchableOpacity, 
    ImageBackground, 
    Dimensions, 
    ActivityIndicator,
    Alert 
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { QUIZ_CATEGORIES, QuizCategoryLocal } from '../../data/quizCategories';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

interface DailyQuizCategoriesProps {
    onSelectCategory: (categoryId: string) => void;
}

export const DailyQuizCategories: React.FC<DailyQuizCategoriesProps> = ({ onSelectCategory }) => {
    const [loading, setLoading] = useState(false);

    // الأساطير مفتوحة دائماً كـ Daily Quiz
    const legendsCategory: QuizCategoryLocal = {
        id: 'legends',
        name: 'Legends',
        nameAr: 'الأساطير',
        description: 'Daily quiz about football legends',
        descriptionAr: 'كويز يومي عن أساطير كرة القدم',
        icon: '👑',
        isLocked: false,
        unlockLevel: 1,
        imageUrl: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    };

    const otherCategories = QUIZ_CATEGORIES.filter(cat => cat.id !== 'legends');

    const handleCategorySelect = async (categoryId: string) => {
        if (categoryId === 'legends') {
            setLoading(true);
            try {
                // Validate category ID
                if (!categoryId || typeof categoryId !== 'string') {
                    throw new Error('Invalid category ID');
                }

                // فحص إذا كان الكويز اليومي متاح في Cache
                try {
                    const { isDailyQuizCached } = await import('../../services/quizApi');
                    const cacheStatus = await isDailyQuizCached();
                    
                    if (cacheStatus.cached) {
                        console.log('✅ Daily quiz available in cache, loading instantly...');
                    } else {
                        console.log('📥 Loading fresh daily quiz...');
                    }
                } catch (cacheError) {
                    console.warn('Cache check failed, continuing anyway:', cacheError);
                    // Continue even if cache check fails
                }
                
                // Call the callback with error handling
                try {
                    onSelectCategory(categoryId);
                } catch (callbackError) {
                    console.error('Error in onSelectCategory callback:', callbackError);
                    throw new Error('Failed to start quiz. Please try again.');
                }
            } catch (error) {
                console.error('Error in handleCategorySelect:', error);
                
                // Show user-friendly error message
                Alert.alert(
                    'خطأ',
                    'حدث خطأ أثناء بدء الاختبار. هل تريد المحاولة مرة أخرى؟',
                    [
                        { 
                            text: 'إعادة المحاولة', 
                            onPress: () => handleCategorySelect(categoryId)
                        },
                        { 
                            text: 'إلغاء', 
                            style: 'cancel'
                        }
                    ]
                );
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <ScrollView 
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            <View style={styles.header}>
                <Text style={styles.title}>Daily Quiz</Text>
                <Text style={styles.subtitle}>20 questions about football legends, updated every 24 hours</Text>
            </View>

            <View style={styles.categoriesGrid}>
                {/* Daily Legends Quiz - Always Available */}
                <TouchableOpacity
                    style={[styles.categoryCard, styles.availableCard]}
                    onPress={() => handleCategorySelect('legends')}
                    disabled={loading}
                    activeOpacity={0.8}
                >
                    <ImageBackground
                        source={{ uri: legendsCategory.imageUrl }}
                        style={styles.cardBackground}
                        imageStyle={styles.cardImage}
                    >
                        <LinearGradient
                            colors={['rgba(0,0,0,0.3)', 'rgba(0,0,0,0.8)']}
                            style={styles.cardGradient}
                        >
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={styles.categoryIcon}>{legendsCategory.icon}</Text>
                                    <View style={styles.dailyBadge}>
                                        <Text style={styles.dailyBadgeText}>DAILY</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.cardInfo}>
                                    <Text style={styles.categoryName}>{legendsCategory.name}</Text>
                                    <Text style={styles.categoryDescription}>
                                        {legendsCategory.description}
                                    </Text>
                                </View>

                                <View style={styles.cardFooter}>
                                    {loading ? (
                                        <ActivityIndicator size="small" color="#fff" />
                                    ) : (
                                        <View style={styles.playButton}>
                                            <Text style={styles.playButtonText}>PLAY NOW</Text>
                                        </View>
                                    )}
                                </View>
                            </View>
                        </LinearGradient>
                    </ImageBackground>
                </TouchableOpacity>

                {/* Other Categories - Coming Soon */}
                {otherCategories.map((category) => (
                    <View
                        key={category.id}
                        style={[styles.categoryCard, styles.lockedCard]}
                    >
                        <LinearGradient
                            colors={['rgba(26,26,26,0.9)', 'rgba(10,10,10,0.95)']}
                            style={styles.cardGradient}
                        >
                            <View style={styles.cardContent}>
                                <View style={styles.cardHeader}>
                                    <Text style={[styles.categoryIcon, styles.lockedIcon]}>
                                        {category.icon}
                                    </Text>
                                    <View style={styles.comingSoonBadge}>
                                        <Text style={styles.comingSoonBadgeText}>SOON</Text>
                                    </View>
                                </View>
                                
                                <View style={styles.cardInfo}>
                                    <Text style={[styles.categoryName, styles.lockedText]}>
                                        {category.name}
                                    </Text>
                                    <Text style={[styles.categoryDescription, styles.lockedText]}>
                                        {category.description}
                                    </Text>
                                </View>

                                <View style={styles.cardFooter}>
                                    <View style={styles.lockedButton}>
                                        <Text style={styles.lockedButtonText}>🔒 LOCKED</Text>
                                    </View>
                                </View>
                            </View>
                        </LinearGradient>
                    </View>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#0a0a0a',
    },
    contentContainer: {
        padding: 16,
        paddingBottom: 32,
    },
    header: {
        marginBottom: 24,
        alignItems: 'center',
    },
    title: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.7)',
        textAlign: 'center',
        lineHeight: 22,
    },
    categoriesGrid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 16,
    },
    categoryCard: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        borderRadius: 20,
        overflow: 'hidden',
        marginBottom: 16,
    },
    availableCard: {
        borderWidth: 2,
        borderColor: '#10b981',
        shadowColor: '#10b981',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 8,
    },
    lockedCard: {
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        opacity: 0.6,
    },
    cardBackground: {
        width: '100%',
        height: '100%',
    },
    cardImage: {
        borderRadius: 20,
    },
    cardGradient: {
        flex: 1,
        padding: 16,
    },
    cardContent: {
        flex: 1,
        justifyContent: 'space-between',
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    categoryIcon: {
        fontSize: 32,
        marginBottom: 8,
    },
    lockedIcon: {
        opacity: 0.5,
    },
    dailyBadge: {
        backgroundColor: '#10b981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    dailyBadgeText: {
        color: '#fff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    comingSoonBadge: {
        backgroundColor: 'rgba(255,255,255,0.2)',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    comingSoonBadgeText: {
        color: 'rgba(255,255,255,0.7)',
        fontSize: 10,
        fontWeight: 'bold',
    },
    cardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    categoryName: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 4,
    },
    categoryDescription: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.8)',
        lineHeight: 16,
    },
    lockedText: {
        color: 'rgba(255,255,255,0.5)',
    },
    cardFooter: {
        alignItems: 'center',
    },
    playButton: {
        backgroundColor: '#10b981',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        minWidth: 80,
        alignItems: 'center',
    },
    playButtonText: {
        color: '#fff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    lockedButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 16,
        minWidth: 80,
        alignItems: 'center',
    },
    lockedButtonText: {
        color: 'rgba(255,255,255,0.5)',
        fontSize: 12,
        fontWeight: 'bold',
    },
});