import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';

interface CooldownInfo {
    canChange: boolean;
    daysRemaining: number;
    hoursRemaining: number;
}

interface ActionButtonsProps {
    onEditPress: () => void;
    onSharePress: () => void;
    onQRPress?: () => void;
    uploadCooldown?: CooldownInfo | null;
}

/**
 * Format cooldown time for display
 * Requirements: 13.2, 13.3 - Show countdown timer when on cooldown
 */
function formatCooldownTime(cooldown: CooldownInfo): string {
    if (cooldown.daysRemaining > 0) {
        return `${cooldown.daysRemaining}d ${cooldown.hoursRemaining}h`;
    }
    return `${cooldown.hoursRemaining}h`;
}

/**
 * Get detailed cooldown message for alert
 * Requirements: 13.3 - Show remaining time on tap
 */
function getCooldownMessage(cooldown: CooldownInfo): string {
    if (cooldown.daysRemaining > 0) {
        return `يمكنك رفع فيديو جديد بعد ${cooldown.daysRemaining} يوم و ${cooldown.hoursRemaining} ساعة`;
    }
    return `يمكنك رفع فيديو جديد بعد ${cooldown.hoursRemaining} ساعة`;
}

export default function ActionButtons({ onEditPress, onSharePress, onQRPress, uploadCooldown }: ActionButtonsProps) {
    const isOnCooldown = uploadCooldown && !uploadCooldown.canChange;
    const { t } = useTranslation();

    /**
     * Handle upload button press
     * Requirements: 13.2, 13.3 - Show remaining time on tap when on cooldown
     */
    const handleUploadPress = () => {
        if (isOnCooldown && uploadCooldown) {
            // Haptic feedback for warning
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
            
            // Show remaining time on tap (Requirement 13.3)
            Alert.alert(
                '⏳ انتظر قليلاً',
                getCooldownMessage(uploadCooldown),
                [{ text: 'حسناً', style: 'default' }]
            );
        } else {
            onEditPress();
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.buttonsContainer}>
                <TouchableOpacity onPress={handleUploadPress} activeOpacity={0.8}>
                    <LinearGradient
                        colors={isOnCooldown 
                            ? ['rgba(239,68,68,0.8)', 'rgba(220,38,38,0.6)'] // Red gradient when on cooldown
                            : [ProfileTheme.colors.glassWhite, 'transparent']
                        }
                        style={[styles.actionButton, isOnCooldown && styles.cooldownButton]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        {isOnCooldown && uploadCooldown ? (
                            <>
                                <Ionicons name="time-outline" size={18} color="#FF4444" />
                                <Text style={[styles.buttonText, styles.cooldownText]}>
                                    {formatCooldownTime(uploadCooldown)}
                                </Text>
                            </>
                        ) : (
                            <>
                                <Ionicons name="add-circle-outline" size={18} color={ProfileTheme.colors.textPrimary} />
                                <Text style={styles.buttonText}>{t.profile.uploadVideo}</Text>
                            </>
                        )}
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={onSharePress} activeOpacity={0.8}>
                    <LinearGradient
                        colors={[ProfileTheme.colors.neonBlue, '#2563eb']}
                        style={[styles.actionButton, styles.primaryButton]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="share-social" size={18} color="#FFF" />
                        <Text style={styles.buttonText}>{t.profile.share}</Text>
                    </LinearGradient>
                </TouchableOpacity>

                {onQRPress && (
                    <TouchableOpacity onPress={onQRPress} activeOpacity={0.8}>
                        <LinearGradient
                            colors={['rgba(255,215,0,0.3)', 'rgba(255,215,0,0.1)']}
                            style={[styles.actionButton, styles.qrButton]}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 1 }}
                        >
                            <Ionicons name="qr-code" size={18} color="#FFD700" />
                        </LinearGradient>
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        marginBottom: 24,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 10,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 25,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        height: 42,
    },
    primaryButton: {
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: ProfileTheme.colors.neonBlue,
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 10,
        elevation: 5,
    },
    buttonText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '600',
    },
    cooldownButton: {
        borderColor: 'rgba(239,68,68,0.5)', // Red border when on cooldown
    },
    cooldownText: {
        color: '#FF4444', // Red text color
        fontSize: 12,
        fontWeight: '700',
    },
    qrButton: {
        borderColor: 'rgba(255,215,0,0.3)',
        minWidth: 42,
        paddingHorizontal: 0,
        width: 42,
    },
});
