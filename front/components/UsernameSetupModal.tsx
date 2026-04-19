import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { User, Check, X } from 'lucide-react-native';
import { COLORS, GRADIENTS } from './reels/constants';
import { useAuth, useUser } from '@clerk/clerk-expo';
import { AuthService } from '../src/services/authService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { globalState } from '../globalState';

interface UsernameSetupModalProps {
    visible: boolean;
    onComplete: (username: string) => void;
    defaultUsername?: string;
}

const USERNAME_SETUP_KEY = '@username_setup_complete';

export default function UsernameSetupModal({
    visible,
    onComplete,
    defaultUsername = '',
}: UsernameSetupModalProps) {
    const [username, setUsername] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const { getToken } = useAuth();
    const { user } = useUser();

    useEffect(() => {
        if (visible && defaultUsername) {
            setUsername(defaultUsername);
        }
    }, [visible, defaultUsername]);

    const validateUsername = (value: string): boolean => {
        if (value.length < 3) {
            setError('Username must be at least 3 characters');
            return false;
        }
        if (value.length > 20) {
            setError('Username must be less than 20 characters');
            return false;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(value)) {
            setError('Username can only contain letters, numbers, and underscores');
            return false;
        }
        setError('');
        return true;
    };

    const handleUsernameChange = (value: string) => {
        const cleaned = value.toLowerCase().replace(/[^a-z0-9_]/g, '');
        setUsername(cleaned);
        if (cleaned.length > 0) {
            validateUsername(cleaned);
        } else {
            setError('');
        }
    };

    const handleSubmit = async () => {
        const finalUsername = username.trim() || defaultUsername;
        
        if (!validateUsername(finalUsername)) {
            return;
        }

        setIsLoading(true);
        try {
            const token = await getToken();
            if (!token) {
                Alert.alert('Error', 'Authentication failed');
                setIsLoading(false);
                return;
            }

            const result = await AuthService.updateProfile(token, {
                username: finalUsername,
            });

            if (result.user) {
                // Update globalState with new user data
                globalState.username = result.user.username;
                globalState.isLoggedIn = true;
                globalState.setUserProfile({
                    id: result.user.id,
                    username: result.user.username,
                    displayName: result.user.displayName || result.user.username,
                    avatar: result.user.avatar || undefined,
                    bio: result.user.bio || undefined,
                    stats: {
                        views: 0,
                        likes: 0,
                        questionsSolved: 0,
                        rating: 0,
                        posts: 0,
                        predictions: 0,
                        interactions: 0,
                        level: result.user.level || 1,
                        followers: 0,
                        following: 0,
                        monthlyViews: 0,
                        yearlyViews: 0,
                        engagementRate: 0,
                        contentQuality: 0,
                    },
                    videos: [],
                    badges: [],
                    achievements: [],
                    socialStats: { followers: [], following: [] },
                    notifications: [],
                    isOwner: true,
                    isVerified: result.user.isVerified || false,
                    isAppOwner: result.user.isDeveloper || false,
                });
                await globalState.saveState();

                // Mark setup as complete
                await AsyncStorage.setItem(USERNAME_SETUP_KEY, 'true');
                onComplete(finalUsername);
            } else {
                Alert.alert('Error', result.error || 'Username might be taken. Try another one.');
            }
        } catch (err: any) {
            console.error('Error setting username:', err);
            Alert.alert('Error', 'Failed to set username. Please try again.');
        } finally {
            setIsLoading(false);
        }
    };

    const handleSkip = async () => {
        // Use default username (email prefix)
        const finalUsername = defaultUsername;
        
        setIsLoading(true);
        try {
            // Mark setup as complete even if skipped
            await AsyncStorage.setItem(USERNAME_SETUP_KEY, 'true');
            onComplete(finalUsername);
        } catch (err) {
            console.error('Error skipping username setup:', err);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            statusBarTranslucent
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                style={styles.overlay}
            >
                <View style={styles.container}>
                    <LinearGradient
                        colors={['#1a1a2e', '#16213e']}
                        style={styles.gradient}
                    >
                        {/* Header */}
                        <View style={styles.header}>
                            <View style={styles.iconContainer}>
                                <User size={32} color={COLORS.neonGreen} />
                            </View>
                            <Text style={styles.title}>Choose Your Username</Text>
                            <Text style={styles.subtitle}>
                                This will be your unique identity in 90Plus
                            </Text>
                        </View>

                        {/* Input */}
                        <View style={styles.inputContainer}>
                            <Text style={styles.atSymbol}>@</Text>
                            <TextInput
                                style={styles.input}
                                placeholder="username"
                                placeholderTextColor={COLORS.textTertiary}
                                value={username}
                                onChangeText={handleUsernameChange}
                                autoCapitalize="none"
                                autoCorrect={false}
                                maxLength={20}
                            />
                        </View>

                        {error ? (
                            <Text style={styles.errorText}>{error}</Text>
                        ) : (
                            <Text style={styles.hintText}>
                                Letters, numbers, and underscores only
                            </Text>
                        )}

                        {/* Buttons */}
                        <View style={styles.buttonContainer}>
                            <TouchableOpacity
                                style={styles.submitButton}
                                onPress={handleSubmit}
                                disabled={isLoading}
                            >
                                <LinearGradient
                                    colors={GRADIENTS.greenGlow}
                                    start={{ x: 0, y: 0 }}
                                    end={{ x: 1, y: 0 }}
                                    style={styles.gradientButton}
                                >
                                    {isLoading ? (
                                        <ActivityIndicator color={COLORS.deepBlack} />
                                    ) : (
                                        <>
                                            <Check size={20} color={COLORS.deepBlack} />
                                            <Text style={styles.submitText}>Confirm</Text>
                                        </>
                                    )}
                                </LinearGradient>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.skipButton}
                                onPress={handleSkip}
                                disabled={isLoading}
                            >
                                <Text style={styles.skipText}>
                                    Skip (use {defaultUsername || 'default'})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </LinearGradient>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

// Helper function to check if username setup is needed
export async function needsUsernameSetup(): Promise<boolean> {
    try {
        const value = await AsyncStorage.getItem(USERNAME_SETUP_KEY);
        return value !== 'true';
    } catch {
        return true;
    }
}

// Helper to reset username setup (for testing)
export async function resetUsernameSetup(): Promise<void> {
    await AsyncStorage.removeItem(USERNAME_SETUP_KEY);
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    container: {
        width: '100%',
        maxWidth: 400,
        borderRadius: 24,
        overflow: 'hidden',
    },
    gradient: {
        padding: 24,
    },
    header: {
        alignItems: 'center',
        marginBottom: 24,
    },
    iconContainer: {
        width: 64,
        height: 64,
        borderRadius: 32,
        backgroundColor: 'rgba(50, 205, 50, 0.1)',
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 16,
        borderWidth: 1,
        borderColor: COLORS.neonGreen,
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: COLORS.white,
        marginBottom: 8,
    },
    subtitle: {
        fontSize: 14,
        color: COLORS.textSecondary,
        textAlign: 'center',
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255, 255, 255, 0.05)',
        borderRadius: 16,
        paddingHorizontal: 16,
        height: 56,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.1)',
    },
    atSymbol: {
        fontSize: 18,
        color: COLORS.neonGreen,
        marginRight: 8,
        fontWeight: 'bold',
    },
    input: {
        flex: 1,
        color: COLORS.white,
        fontSize: 18,
    },
    errorText: {
        color: '#ff6b6b',
        fontSize: 12,
        marginTop: 8,
        marginLeft: 4,
    },
    hintText: {
        color: COLORS.textTertiary,
        fontSize: 12,
        marginTop: 8,
        marginLeft: 4,
    },
    buttonContainer: {
        marginTop: 24,
        gap: 12,
    },
    submitButton: {
        borderRadius: 16,
        overflow: 'hidden',
    },
    gradientButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 16,
        gap: 8,
    },
    submitText: {
        color: COLORS.deepBlack,
        fontSize: 16,
        fontWeight: 'bold',
    },
    skipButton: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    skipText: {
        color: COLORS.textSecondary,
        fontSize: 14,
    },
});
