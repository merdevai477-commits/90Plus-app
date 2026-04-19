import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Modal, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

interface DeveloperBadgeProps {
    size?: number;
}

export default function DeveloperBadge({ size = 32 }: DeveloperBadgeProps) {
    const [showModal, setShowModal] = useState(false);
    const scaleAnim = useRef(new Animated.Value(1)).current;

    const handlePressIn = () => {
        Animated.spring(scaleAnim, {
            toValue: 0.92,
            useNativeDriver: true,
        }).start();
    };

    const handlePressOut = () => {
        Animated.spring(scaleAnim, {
            toValue: 1,
            friction: 3,
            tension: 40,
            useNativeDriver: true,
        }).start();
        setShowModal(true);
    };

    return (
        <>
            <TouchableOpacity
                onPressIn={handlePressIn}
                onPressOut={handlePressOut}
                activeOpacity={1}
                style={styles.container}
            >
                <Animated.View
                    style={[
                        styles.badge,
                        {
                            width: size,
                            height: size,
                            transform: [{ scale: scaleAnim }],
                        }
                    ]}
                >
                    <View style={[styles.badgeContainer, { width: size, height: size }]}>
                        <View style={[styles.outerCircle, {
                            width: size,
                            height: size,
                            borderRadius: size / 2,
                            borderWidth: 1.5
                        }]} />
                        <View style={styles.innerContent}>
                            <Ionicons name="person" size={size * 0.6} color="#A855F7" style={styles.personIcon} />
                            <Ionicons
                                name="star"
                                size={size * 0.3}
                                color="#A855F7"
                                style={[styles.starIcon, { position: 'absolute', right: 0, bottom: 0 }]}
                            />
                        </View>
                    </View>
                </Animated.View>
            </TouchableOpacity>

            <Modal
                visible={showModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowModal(false)}
            >
                <TouchableOpacity
                    style={styles.modalOverlay}
                    activeOpacity={1}
                    onPress={() => setShowModal(false)}
                >
                    <Animated.View
                        style={styles.modalContent}
                        onStartShouldSetResponder={() => true}
                    >
                        <LinearGradient
                            colors={['#0f172a', '#1e293b', '#0f172a']}
                            style={styles.modalCard}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <View style={styles.modalBackgroundAccent} />

                            <View style={styles.modalIconContainer}>
                                <View style={styles.modalBadgeContainer}>
                                    <View style={styles.modalOuterCircle} />
                                    <View style={styles.modalInnerContent}>
                                        <Ionicons name="person" size={40} color="#A855F7" style={styles.modalPersonIcon} />
                                        <Ionicons name="star" size={20} color="#A855F7" style={styles.modalStarIcon} />
                                    </View>
                                </View>
                            </View>

                            <Text style={styles.modalTitle}>شـارة المطور</Text>

                            <View style={styles.divider} />

                            <Text style={styles.modalSubtitle}>مطور التطبيق</Text>

                            <Text style={styles.modalText}>
                                تُمنح هذه الشارة لمطوري التطبيق والمساهمين في بنائه وتطويره.
                            </Text>

                            <View style={styles.modalFeatures}>
                                <View style={styles.featureItem}>
                                    <View style={styles.featureBullet} />
                                    <Text style={styles.featureText}>تميز حصري</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={styles.featureBullet} />
                                    <Text style={styles.featureText}>صاحب التطبيق</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={styles.featureBullet} />
                                    <Text style={styles.featureText}>مطور محترف</Text>
                                </View>
                            </View>

                            <TouchableOpacity
                                style={styles.closeButton}
                                onPress={() => setShowModal(false)}
                            >
                                <LinearGradient
                                    colors={['#9333EA', '#7C3AED']}
                                    style={styles.closeButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.closeButtonText}>حسناً</Text>
                                </LinearGradient>
                            </TouchableOpacity>
                        </LinearGradient>
                    </Animated.View>
                </TouchableOpacity>
            </Modal>
        </>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
    },
    badge: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    badgeContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    outerCircle: {
        position: 'absolute',
        borderColor: '#A855F7',
        backgroundColor: 'transparent',
    },
    innerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    personIcon: {
        marginTop: 2,
    },
    starIcon: {
        // positioned absolutely in JSX
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.92)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalContent: {
        width: '100%',
        maxWidth: 400,
    },
    modalCard: {
        padding: 32,
        borderRadius: 28,
        borderWidth: 2,
        borderColor: '#9333EA',
        alignItems: 'center',
        shadowColor: '#9333EA',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.6,
        shadowRadius: 24,
        elevation: 15,
        overflow: 'hidden',
    },
    modalBackgroundAccent: {
        position: 'absolute',
        top: -100,
        right: -100,
        width: 250,
        height: 250,
        borderRadius: 125,
        backgroundColor: '#9333EA',
        opacity: 0.08,
    },
    modalIconContainer: {
        marginBottom: 24,
        position: 'relative',
    },
    modalBadgeContainer: {
        width: 80,
        height: 80,
        justifyContent: 'center',
        alignItems: 'center',
        position: 'relative',
    },
    modalOuterCircle: {
        position: 'absolute',
        width: 80,
        height: 80,
        borderRadius: 40,
        borderWidth: 6,
        borderColor: '#A855F7',
        backgroundColor: 'transparent',
    },
    modalInnerContent: {
        justifyContent: 'center',
        alignItems: 'center',
        width: '100%',
        height: '100%',
    },
    modalPersonIcon: {
        marginTop: 2,
    },
    modalStarIcon: {
        position: 'absolute',
        right: 12,
        bottom: 18,
    },
    modalTitle: {
        color: '#FFF',
        fontSize: 26,
        fontWeight: 'bold',
        marginBottom: 12,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    divider: {
        width: 60,
        height: 3,
        backgroundColor: '#9333EA',
        borderRadius: 2,
        marginBottom: 16,
    },
    modalSubtitle: {
        color: '#C084FC',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 16,
        textAlign: 'center',
    },
    modalText: {
        color: '#94a3b8',
        fontSize: 15,
        textAlign: 'center',
        lineHeight: 24,
        marginBottom: 24,
        paddingHorizontal: 8,
    },
    modalFeatures: {
        width: '100%',
        marginBottom: 28,
        paddingHorizontal: 8,
    },
    featureItem: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    featureBullet: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: '#9333EA',
        marginRight: 12,
    },
    featureText: {
        color: '#cbd5e1',
        fontSize: 14,
        fontWeight: '500',
    },
    closeButton: {
        width: '100%',
        borderRadius: 14,
        overflow: 'hidden',
        shadowColor: '#9333EA',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 6,
    },
    closeButtonGradient: {
        paddingVertical: 14,
        paddingHorizontal: 32,
        alignItems: 'center',
    },
    closeButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
        letterSpacing: 0.5,
    },
});