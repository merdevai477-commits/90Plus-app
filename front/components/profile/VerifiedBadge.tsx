import React, { useRef, useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Animated, Modal, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface VerifiedBadgeProps {
    size?: number;
}

export default function VerifiedBadge({ size = 32 }: VerifiedBadgeProps) {
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
                    {/* Facebook verified badge - exact style */}
                    <View style={[styles.badgeContainer, { width: size, height: size }]}>
                        {/* Blue circle background */}
                        <View style={[styles.blueCircle, { 
                            width: size, 
                            height: size, 
                            borderRadius: size / 2 
                        }]} />
                        
                        {/* White checkmark */}
                        <View style={styles.checkmarkContainer}>
                            <Ionicons 
                                name="checkmark" 
                                size={size * 0.65} 
                                color="#FFF"
                                style={styles.checkmark}
                            />
                        </View>
                    </View>
                </Animated.View>
            </TouchableOpacity>

            {/* Modal */}
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
                            {/* Background accent */}
                            <View style={styles.modalBackgroundAccent} />
                            
                            {/* Verified badge icon */}
                            <View style={styles.modalIconContainer}>
                                <View style={styles.modalIconBlueBg}>
                                    <Ionicons name="checkmark" size={44} color="#FFF" />
                                </View>
                            </View>

                            <Text style={styles.modalTitle}>✓ علامة التوثيق</Text>
                            
                            <View style={styles.divider} />
                            
                            <Text style={styles.modalSubtitle}>حساب موثق</Text>
                            
                            <Text style={styles.modalText}>
                                تُمنح هذه العلامة للحسابات الأكثر نشاطاً وتفاعلاً ومساهمة في المجتمع. إنها علامة على الأصالة والمصداقية
                            </Text>

                            <View style={styles.modalFeatures}>
                                <View style={styles.featureItem}>
                                    <View style={styles.featureBullet} />
                                    <Text style={styles.featureText}>مستخدم نشط وموثوق</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={styles.featureBullet} />
                                    <Text style={styles.featureText}>تفاعل مستمر مع المجتمع</Text>
                                </View>
                                <View style={styles.featureItem}>
                                    <View style={styles.featureBullet} />
                                    <Text style={styles.featureText}>محتوى أصلي ومميز</Text>
                                </View>
                            </View>

                            <TouchableOpacity 
                                style={styles.closeButton}
                                onPress={() => setShowModal(false)}
                            >
                                <LinearGradient
                                    colors={['#1877F2', '#166FE5']}
                                    style={styles.closeButtonGradient}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                >
                                    <Text style={styles.closeButtonText}>رائع!</Text>
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
    blueCircle: {
        position: 'absolute',
        backgroundColor: '#1877F2',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 2,
        elevation: 3,
    },
    checkmarkContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    checkmark: {
        fontWeight: '900',
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
        borderColor: '#1877F2',
        alignItems: 'center',
        shadowColor: '#1877F2',
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.5,
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
        backgroundColor: '#1877F2',
        opacity: 0.08,
    },
    modalIconContainer: {
        marginBottom: 24,
        position: 'relative',
    },
    modalIconBlueBg: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#1877F2',
        justifyContent: 'center',
        alignItems: 'center',
        shadowColor: '#1877F2',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
        elevation: 8,
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
        backgroundColor: '#1877F2',
        borderRadius: 2,
        marginBottom: 16,
    },
    modalSubtitle: {
        color: '#60A5FA',
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
        backgroundColor: '#1877F2',
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
        shadowColor: '#1877F2',
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