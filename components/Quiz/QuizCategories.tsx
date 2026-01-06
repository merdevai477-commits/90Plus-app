import React, { useState, useEffect } from 'react';
import { View, StyleSheet, ScrollView, Text, TouchableOpacity, ImageBackground, Dimensions, ActivityIndicator } from 'react-native';
import { useLanguage } from '../../contexts/LanguageContext';
import { COLORS } from '../reels/constants';
import { LinearGradient } from 'expo-linear-gradient';
import { fetchAnswersForCategory } from '../../services/quizApi';
import { useAuth } from '@clerk/clerk-expo';
import { Clock } from 'lucide-react-native';
import { QUIZ_CATEGORIES, getCategoryById, QuizCategoryLocal } from '../../data/quizCategories';
import { 
    getCurrentQuizState, 
    shouldOpenNewQuiz, 
    openNewQuiz 
} from '../../services/quizLocalState';
import { startQuizSync, stopQuizSync } from '../../services/quizSyncService';
import { getCategoryMapping } from '../../services/quizApi';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

interface QuizCategoriesProps {
    onSelectCategory: (categoryId: string) => void;
}

// Map category names to image URLs from server
// All images are stored on server to reduce app size
const CATEGORY_IMAGES: Record<string, string> = {
    'In Common': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'Flash': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'Who Am I?': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'High Five': 'https://images.unsplash.com/photo-1459865264687-595d652de67e?w=800&q=80',
    'Q&A': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'Teammates': 'https://images.unsplash.com/photo-1529900748604-07564a03e7a6?w=800&q=80',
    'Guess the Number': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
    'Legends': 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80',
};

export const QuizCategories: React.FC<QuizCategoriesProps> = ({ onSelectCategory }) => {
    const { t } = useLanguage();
    const { getToken, userId } = useAuth();
    const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
    const [openCategoryName, setOpenCategoryName] = useState<string | null>(null);
    const [nextUnlockAt, setNextUnlockAt] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadOpenCategory();
        
        // بدء خدمة المزامنة إذا كان getToken متاحاً
        if (getToken) {
            startQuizSync(getToken, userId || null);
        }

        // تنظيف عند unmount
        return () => {
            stopQuizSync();
        };
    }, []);

    const loadOpenCategory = async () => {
        try {
            setLoading(true);
            
            // جلب category mapping من الباك إند
            let categoryMapping: Record<string, string> = {};
            if (getToken) {
                try {
                    categoryMapping = await getCategoryMapping(getToken);
                } catch (error: any) {
                    console.warn('Error getting category mapping, continuing without it:', error);
                }
            }
            
            // فحص الحالة المحلية للمستخدم الحالي
            const currentState = await getCurrentQuizState(userId || null);
            
            // فحص إذا كان يجب فتح كويز جديد (مرت 24 ساعة)
            const shouldOpen = await shouldOpenNewQuiz(userId || null);
            
            if (shouldOpen || !currentState.currentCategoryId) {
                // فتح كويز جديد
                console.log(`[QuizCategories] Opening new quiz for user ${userId || 'guest'}...`);
                const newQuiz = await openNewQuiz(userId || null, categoryMapping);
                
                setOpenCategoryId(newQuiz.categoryId);
                setOpenCategoryName(newQuiz.categoryName);
                
                // جلب الإجابات من الباك إند إذا كان getToken متاحاً
                if (getToken && newQuiz.questionIds.length > 0) {
                    try {
                        const token = await getToken();
                        if (token) {
                            const answers = await fetchAnswersForCategory(
                                newQuiz.categoryId,
                                newQuiz.questionIds,
                                getToken
                            );
                            console.log(`✅ Daily quiz opened: ${newQuiz.categoryName}, ${newQuiz.questionIds.length} questions, ${Object.keys(answers).length} answers fetched`);
                        }
                    } catch (error: any) {
                        console.error('Error fetching answers:', error);
                        // لا نوقف العملية، الإجابات قد تكون في cache
                    }
                }
                
                // حساب nextUnlockAt (24 ساعة من الآن)
                const unlockAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                setNextUnlockAt(unlockAt.toISOString());
            } else {
                // استخدام الكويز الحالي
                setOpenCategoryId(currentState.currentCategoryId);
                setOpenCategoryName(currentState.currentCategoryName);
                
                // حساب nextUnlockAt بناءً على lastQuizOpenedAt
                if (currentState.lastQuizOpenedAt) {
                    const unlockAt = new Date(currentState.lastQuizOpenedAt + 24 * 60 * 60 * 1000);
                    setNextUnlockAt(unlockAt.toISOString());
                }
                
                console.log(`✅ Using existing quiz for user ${userId || 'guest'}: ${currentState.currentCategoryName}, ${currentState.currentQuestionIds.length} questions`);
            }
        } catch (error: any) {
            console.error('Error loading open category:', error);
            // في حالة الخطأ، نعرض الكاتيجوري المحلية فقط بدون تحديد النوع المفتوح
            setOpenCategoryId(null);
            setOpenCategoryName(null);
        } finally {
            setLoading(false);
        }
    };

    const handleCategoryPress = async (category: QuizCategoryLocal) => {
        // التحقق من أن النوع مفتوح بناءً على الاسم
        if (category.name !== openCategoryName) {
            return;
        }

        // استخدام category.id مباشرة (UUID) - الأسئلة المحلية مرتبطة به
        if (category.id) {
            onSelectCategory(category.id);
        } else if (openCategoryId) {
            // Fallback: استخدام openCategoryId من الباك إند
            onSelectCategory(openCategoryId);
        }
    };

    const calculateTimeUntilUnlock = (unlockAt?: string) => {
        if (!unlockAt) return null;
        
        const now = new Date().getTime();
        const unlockTime = new Date(unlockAt).getTime();
        const diff = unlockTime - now;

        if (diff <= 0) return null;

        const hours = Math.floor(diff / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        return { hours, minutes, seconds };
    };

    const getCategoryImage = (categoryName: string) => {
        return CATEGORY_IMAGES[categoryName] || 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=800&q=80';
    };

    const formatTimeUntilUnlock = (time: { hours: number; minutes: number; seconds: number } | null) => {
        if (!time) return '';
        if (time.hours > 0) {
            return `${time.hours}h ${time.minutes}m`;
        }
        if (time.minutes > 0) {
            return `${time.minutes}m ${time.seconds}s`;
        }
        return `${time.seconds}s`;
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
                <Text style={styles.headerTitle}>Daily Quiz</Text>
                <Text style={styles.headerSubtitle}>One quiz category opens every 24 hours</Text>
            </View>

            {/* عرض كل الكاتيجوري دائماً، محلية من الفرونت إند */}
            <View style={styles.grid}>
                {QUIZ_CATEGORIES.map((category) => {
                    const imageSource = getCategoryImage(category.name);
                    // التحقق من أن النوع مفتوح بناءً على الاسم (ليس ID)
                    const isOpen = category.name === openCategoryName;

                    return (
                        <View
                            key={category.id}
                            style={styles.cardContainer}
                        >
                            <TouchableOpacity
                                activeOpacity={0.85}
                                onPress={() => handleCategoryPress(category)}
                                disabled={!isOpen}
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

                                        {!isOpen && (
                                            <View style={styles.lockedOverlay}>
                                                <View style={styles.lockIconContainer}>
                                                    <Text style={styles.lockIcon}>🔒</Text>
                                                </View>
                                            </View>
                                        )}

                                        <View style={styles.textContainer}>
                                            <Text style={styles.title}>{category.name}</Text>
                                            {category.description && (
                                                <Text style={styles.description}>{category.description}</Text>
                                            )}
                                            {isOpen && (
                                                <View style={styles.openBadge}>
                                                    <Text style={styles.openBadgeText}>Available Now</Text>
                                                </View>
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
            
            {/* عرض countdown إذا لم يكن هناك نوع مفتوح */}
            {!openCategoryId && nextUnlockAt && (() => {
                const [timeUntilUnlock, setTimeUntilUnlock] = React.useState(calculateTimeUntilUnlock(nextUnlockAt));
                
                React.useEffect(() => {
                    if (!timeUntilUnlock) return;
                    
                    const interval = setInterval(() => {
                        const newTime = calculateTimeUntilUnlock(nextUnlockAt);
                        setTimeUntilUnlock(newTime);
                        if (!newTime) {
                            clearInterval(interval);
                            loadOpenCategory(); // Reload when unlocked
                        }
                    }, 1000);
                    
                    return () => clearInterval(interval);
                }, [nextUnlockAt]);
                
                return timeUntilUnlock ? (
                    <View style={styles.countdownContainer}>
                        <Clock size={24} color={COLORS.neonBlue} />
                        <Text style={styles.countdownText}>
                            Next quiz unlocks in: {formatTimeUntilUnlock(timeUntilUnlock)}
                        </Text>
                    </View>
                ) : null;
            })()}
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
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 40,
        minHeight: 300,
    },
    emptyTitle: {
        color: COLORS.white,
        fontSize: 20,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    countdownContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(0, 255, 255, 0.1)',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: COLORS.neonBlue,
    },
    countdownText: {
        color: COLORS.neonBlue,
        fontSize: 16,
        fontWeight: '600',
        marginLeft: 12,
    },
    openBadge: {
        backgroundColor: COLORS.neonBlue,
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 12,
        marginTop: 8,
        alignSelf: 'flex-start',
    },
    openBadgeText: {
        color: COLORS.deepBlack,
        fontSize: 12,
        fontWeight: 'bold',
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

