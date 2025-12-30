import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { LinearGradient } from 'expo-linear-gradient';

interface BioEditModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (newBio: string) => void;
    initialBio: string;
}

export default function BioEditModal({ visible, onClose, onSave, initialBio }: BioEditModalProps) {
    const [bio, setBio] = useState(initialBio);

    useEffect(() => {
        setBio(initialBio);
    }, [initialBio]);

    return (
        <Modal
            visible={visible}
            animationType="fade"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <KeyboardAvoidingView
                    behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
                    style={styles.keyboardView}
                >
                    <View style={styles.content}>
                        <View style={styles.header}>
                            <Text style={styles.title}>تعديل البايو</Text>
                            <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                                <Ionicons name="close" size={24} color="#FFF" />
                            </TouchableOpacity>
                        </View>

                        <TextInput
                            style={styles.input}
                            value={bio}
                            onChangeText={setBio}
                            multiline
                            maxLength={150}
                            placeholder="اكتب شيئاً عنك..."
                            placeholderTextColor="#666"
                            textAlign="center"
                        />
                        <Text style={styles.charCount}>{bio.length}/150</Text>

                        <TouchableOpacity
                            onPress={() => {
                                onSave(bio);
                                onClose();
                            }}
                            activeOpacity={0.8}
                        >
                            <LinearGradient
                                colors={[ProfileTheme.colors.neonBlue, '#2563eb']}
                                style={styles.saveButton}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                            >
                                <Text style={styles.saveButtonText}>حفظ</Text>
                            </LinearGradient>
                        </TouchableOpacity>
                    </View>
                </KeyboardAvoidingView>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        padding: 20,
    },
    keyboardView: {
        width: '100%',
        alignItems: 'center',
    },
    content: {
        width: '100%',
        backgroundColor: '#1E1E1E',
        borderRadius: 24,
        padding: 24,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 10 },
        shadowOpacity: 0.3,
        shadowRadius: 20,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    closeButton: {
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    input: {
        backgroundColor: 'rgba(0,0,0,0.3)',
        borderRadius: 16,
        padding: 16,
        color: '#FFF',
        fontSize: 16,
        minHeight: 100,
        textAlignVertical: 'top',
        marginBottom: 8,
    },
    charCount: {
        color: '#666',
        fontSize: 12,
        textAlign: 'right',
        marginBottom: 20,
    },
    saveButton: {
        width: '100%',
        paddingVertical: 14,
        borderRadius: 16,
        alignItems: 'center',
    },
    saveButtonText: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: 'bold',
    },
});
