import React from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useTranslation } from '../../src/i18n';
import { ProfileTheme } from '../../constants/ProfileTheme';

interface UploadProgressModalProps {
    visible: boolean;
    progress: number;
    message?: string;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
    visible,
    progress,
    message,
}) => {
    const { t } = useTranslation();
    const safeProgress = Math.min(Math.max(Math.round(progress), 0), 100);
    const label = message || t.profile.uploadingLabel;

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color={ProfileTheme.colors.profilePrimary} />
                    <Text style={styles.message}>{label}</Text>
                    
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${safeProgress}%` }]} />
                    </View>
                    
                    <Text style={styles.percentage}>{safeProgress}%</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.75)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: ProfileTheme.colors.profileCard,
        borderRadius: 20,
        padding: 28,
        alignItems: 'center',
        minWidth: 220,
        borderWidth: 1,
        borderColor: 'rgba(139,92,246,0.35)',
    },
    message: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        marginTop: 16,
        marginBottom: 16,
        textAlign: 'center',
    },
    progressBarContainer: {
        width: 180,
        height: 6,
        backgroundColor: 'rgba(255,255,255,0.12)',
        borderRadius: 3,
        overflow: 'hidden',
        marginBottom: 10,
    },
    progressBar: {
        height: '100%',
        backgroundColor: ProfileTheme.colors.profilePrimary,
        borderRadius: 3,
    },
    percentage: {
        color: ProfileTheme.colors.avatarRing,
        fontSize: 14,
        fontWeight: '700',
    },
});
