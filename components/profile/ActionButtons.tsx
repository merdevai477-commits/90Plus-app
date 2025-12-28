import React from 'react';
import { View, StyleSheet, TouchableOpacity, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface ActionButtonsProps {
    onEditPress: () => void;
    onSharePress: () => void;
}

export default function ActionButtons({ onEditPress, onSharePress }: ActionButtonsProps) {
    return (
        <View style={styles.container}>
            <View style={styles.buttonsContainer}>
                <TouchableOpacity onPress={onEditPress} activeOpacity={0.8}>
                    <LinearGradient
                        colors={[ProfileTheme.colors.glassWhite, 'transparent']}
                        style={styles.actionButton}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="pencil" size={20} color={ProfileTheme.colors.textPrimary} />
                        <Text style={styles.buttonText}>تعديل</Text>
                    </LinearGradient>
                </TouchableOpacity>

                <TouchableOpacity onPress={onSharePress} activeOpacity={0.8}>
                    <LinearGradient
                        colors={[ProfileTheme.colors.neonBlue, '#2563eb']}
                        style={[styles.actionButton, styles.primaryButton]}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 1, y: 1 }}
                    >
                        <Ionicons name="share-social" size={20} color="#FFF" />
                        <Text style={styles.buttonText}>مشاركة</Text>
                    </LinearGradient>
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 24,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 30,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        minWidth: 140,
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
        fontSize: 16,
        fontWeight: '600',
    },
});
