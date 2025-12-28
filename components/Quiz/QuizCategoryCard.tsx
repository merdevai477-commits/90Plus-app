import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ImageBackground, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withSpring,
    withTiming,
    withDelay,
    interpolate,
    Extrapolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { COLORS } from '../reels/constants';

const { width } = Dimensions.get('window');
const CARD_WIDTH = (width - 48) / 2;
const CARD_HEIGHT = CARD_WIDTH * 1.4;

interface QuizCategoryCardProps {
    title: string;
    image: { uri: string } | string;
    onPress: () => void;
    index: number;
    locked?: boolean;
}

export const QuizCategoryCard: React.FC<QuizCategoryCardProps> = ({
    title,
    image,
    onPress,
    index,
    locked = false
}) => {
    const scale = useSharedValue(1);

    const animatedStyle = useAnimatedStyle(() => ({
        transform: [
            { scale: scale.value }
        ]
    }));

    const handlePressIn = () => {
        scale.value = withSpring(0.95);
    };

    const handlePressOut = () => {
        scale.value = withSpring(1);
    };

    return (
        <Animated.View style={[styles.container, animatedStyle]}>
            <TouchableOpacity
                activeOpacity={1}
                onPress={onPress}
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                disabled={locked}
            >
                <View style={styles.cardContent}>
                    <ImageBackground
                        source={typeof image === 'string' ? { uri: image } : image}
                        style={styles.image}
                        imageStyle={styles.imageStyle}
                    >
                        <LinearGradient
                            colors={['transparent', 'rgba(0,0,0,0.6)', 'rgba(0,0,0,0.9)']}
                            style={styles.gradient}
                        />

                        {locked && (
                            <BlurView intensity={20} style={styles.lockedOverlay}>
                                <View style={styles.lockIconContainer}>
                                    <Text style={styles.lockIcon}>🔒</Text>
                                </View>
                            </BlurView>
                        )}

                        <View style={styles.textContainer}>
                            <Text style={styles.title}>{title}</Text>
                        </View>
                    </ImageBackground>

                    {/* Glass Border Effect */}
                    <View style={styles.glassBorder} />
                </View>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        width: CARD_WIDTH,
        height: CARD_HEIGHT,
        marginBottom: 16,
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
    image: {
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
        backgroundColor: 'rgba(0,0,0,0.4)',
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
