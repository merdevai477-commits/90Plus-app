import React from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';

interface UploadProgressModalProps {
    visible: boolean;
    progress: number;
    message?: string;
}

export const UploadProgressModal: React.FC<UploadProgressModalProps> = ({
    visible,
    progress,
    message = 'جاري الرفع...'
}) => {
    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
        >
            <View style={styles.overlay}>
                <View style={styles.container}>
                    <ActivityIndicator size="large" color="#00ff00" />
                    <Text style={styles.message}>{message}</Text>
                    
                    {/* Progress Bar */}
                    <View style={styles.progressBarContainer}>
                        <View style={[styles.progressBar, { width: `${progress}%` }]} />
                    </View>
                    
                    <Text style={styles.percentage}>{Math.round(progress)}%</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: '#1a1a1a',
        borderRadius: 20,
        padding: 30,
        alignItems: 'center',
        minWidth: 250,
    },
    message: {
        color: '#fff',
        fontSize: 18,
        fontWeight: '600',
        marginTop: 20,
        marginBottom: 20,
        textAlign: 'center',
    },
    progressBarContainer: {
        width: '100%',
        height: 8,
        backgroundColor: '#333',
        borderRadius: 4,
        overflow: 'hidden',
    },
    progressBar: {
        height: '100%',
        backgroundColor: '#00ff00',
        borderRadius: 4,
    },
    percentage: {
        color: '#00ff00',
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 15,
    },
});

export default UploadProgressModal;
