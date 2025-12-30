import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    TouchableOpacity,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import {
    Trophy,
    Gamepad2,
    ArrowLeft,
} from 'lucide-react-native';
import { globalState } from '../globalState';
import { COLORS, GRADIENTS, EFFECTS } from '../components/reels/constants';
import { useHomeStore } from '../src/store/home.store';

export default function SignupScreen() {
    const handleGuest = () => {
        globalState.setUserType('guest');
        useHomeStore.getState().setUserMode('guest');
        router.replace('/(tabs)/Home');
    };

    const handleGoBack = () => {
        router.back();
    };

    return (
        <View style={styles.container}>
            <StatusBar style="light" />

            {/* Background */}
            <LinearGradient
                colors={[COLORS.deepBlack, '#0a1f0a', COLORS.deepBlack]}
                style={StyleSheet.absoluteFill}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
            />

            {/* Back Button */}
            <TouchableOpacity style={styles.backButton} onPress={handleGoBack}>
                <ArrowLeft color={COLORS.neonGreen} size={24} />
            </TouchableOpacity>

            <View style={styles.content}>
                {/* Header */}
                <View style={styles.header}>
                    <View style={styles.logoContainer}>
                        <Trophy size={48} color={COLORS.neonGreen} />
                    </View>
                    <Text style={styles.appName}>Create Account</Text>
                    <Text style={styles.tagline}>Join the 90Plus Community</Text>
                </View>

                {/* Coming Soon Message */}
                <View style={styles.messageContainer}>
                    <Text style={styles.comingSoonTitle}>🚀 Registration Coming Soon</Text>
                    <Text style={styles.comingSoonText}>
                        We're implementing a new secure authentication system with Clerk.
                        {'\n\n'}
                        For now, you can continue as a guest to explore the app.
                    </Text>
                </View>

                {/* Guest Access */}
                <TouchableOpacity style={styles.guestButton} onPress={handleGuest}>
                    <LinearGradient
                        colors={GRADIENTS.greenGlow}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 0 }}
                        style={styles.gradientButton}
                    >
                        <Gamepad2 color={COLORS.deepBlack} size={20} style={{ marginRight: 8 }} />
                        <Text style={styles.guestText}>Continue as Guest</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {/* Login Link */}
                <TouchableOpacity
                    style={styles.loginLink}
                    onPress={() => router.replace('/auth')}
                >
                    <Text style={styles.loginLinkText}>
                        Already have an account? <Text style={styles.loginLinkBold}>Sign In</Text>
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: COLORS.deepBlack,
    },
    backButton: {
        position: 'absolute',
        top: 50,
        left: 20,
        zIndex: 10,
        padding: 10,
    },
    content: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 40,
    },
    logoContainer: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: 'rgba(50, 205, 50, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.neonGreen,
        ...EFFECTS.greenGlow,
    },
    appName: {
        fontSize: 32,
        fontWeight: 'bold',
        color: '#fff',
        marginBottom: 8,
    },
    tagline: {
        fontSize: 16,
        color: COLORS.textSecondary,
    },
    messageContainer: {
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        padding: 24,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
        marginBottom: 40,
        maxWidth: 320,
    },
    comingSoonTitle: {
        fontSize: 18,
        fontWeight: 'bold',
        color: COLORS.neonGreen,
        textAlign: 'center',
        marginBottom: 12,
    },
    comingSoonText: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
        lineHeight: 22,
    },
    guestButton: {
        borderRadius: 12,
        overflow: 'hidden',
        width: '100%',
        maxWidth: 280,
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    guestText: {
        color: COLORS.deepBlack,
        fontSize: 16,
        fontWeight: 'bold',
    },
    loginLink: {
        marginTop: 32,
        alignItems: 'center',
    },
    loginLinkText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
    loginLinkBold: {
        color: COLORS.neonGreen,
        fontWeight: 'bold',
    },
});
