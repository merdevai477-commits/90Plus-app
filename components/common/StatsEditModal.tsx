import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

export interface Stats {
    age: string;
    height: string;
    weight: string;
    foot: 'R' | 'L' | 'B';
}

interface StatsEditModalProps {
    visible: boolean;
    onClose: () => void;
    onSave: (stats: Stats) => void;
    initialStats: Stats;
}

export default function StatsEditModal({ visible, onClose, onSave, initialStats }: StatsEditModalProps) {
    const [stats, setStats] = useState<Stats>(initialStats);

    useEffect(() => {
        setStats(initialStats);
    }, [initialStats, visible]);

    const handleChange = (key: keyof Stats, value: string | 'R' | 'L' | 'B') => {
        setStats(prev => ({ ...prev, [key]: value as any }));
    };

    const handleSave = () => {
        // Ensure foot is one of the valid values
        const validFoot: 'R' | 'L' | 'B' = (stats.foot === 'R' || stats.foot === 'L' || stats.foot === 'B') 
            ? stats.foot 
            : 'R'; // Default to 'R' if invalid
        onSave({ ...stats, foot: validFoot });
        onClose();
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <KeyboardAvoidingView
                behavior={Platform.OS === "ios" ? "padding" : "height"}
                style={styles.container}
            >
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>تعديل الإحصائيات</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <ScrollView contentContainerStyle={styles.form}>
                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>العمر (Age)</Text>
                            <TextInput
                                style={styles.input}
                                value={stats.age}
                                onChangeText={(t) => handleChange('age', t)}
                                keyboardType="numeric"
                                maxLength={2}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>الطول (Height - cm)</Text>
                            <TextInput
                                style={styles.input}
                                value={stats.height}
                                onChangeText={(t) => handleChange('height', t)}
                                keyboardType="numeric"
                                maxLength={3}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>الوزن (Weight - kg)</Text>
                            <TextInput
                                style={styles.input}
                                value={stats.weight}
                                onChangeText={(t) => handleChange('weight', t)}
                                keyboardType="numeric"
                                maxLength={3}
                            />
                        </View>

                        <View style={styles.inputGroup}>
                            <Text style={styles.label}>القدم المفضلة (Foot)</Text>
                            <View style={styles.footSelector}>
                                <TouchableOpacity
                                    style={[styles.footOption, stats.foot === 'R' && styles.selectedFoot]}
                                    onPress={() => handleChange('foot', 'R')}
                                >
                                    <Text style={[styles.footText, stats.foot === 'R' && styles.selectedFootText]}>Right (R)</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[styles.footOption, stats.foot === 'L' && styles.selectedFoot]}
                                    onPress={() => handleChange('foot', 'L')}
                                >
                                    <Text style={[styles.footText, stats.foot === 'L' && styles.selectedFootText]}>Left (L)</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </ScrollView>

                    <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
                        <Text style={styles.saveButtonText}>حفظ التغييرات</Text>
                    </TouchableOpacity>
                </View>
            </KeyboardAvoidingView>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    content: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        paddingBottom: 40,
        maxHeight: '80%',
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
    form: {
        paddingBottom: 20,
    },
    inputGroup: {
        marginBottom: 15,
    },
    label: {
        color: '#CCC',
        marginBottom: 8,
        textAlign: 'right',
    },
    input: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        padding: 12,
        color: '#FFF',
        fontSize: 16,
        textAlign: 'right',
    },
    footSelector: {
        flexDirection: 'row',
        gap: 10,
    },
    footOption: {
        flex: 1,
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 12,
        borderRadius: 12,
        alignItems: 'center',
    },
    selectedFoot: {
        backgroundColor: '#22c55e',
    },
    footText: {
        color: '#FFF',
    },
    selectedFootText: {
        color: '#000',
        fontWeight: 'bold',
    },
    saveButton: {
        backgroundColor: '#22c55e',
        padding: 16,
        borderRadius: 12,
        alignItems: 'center',
        marginTop: 10,
    },
    saveButtonText: {
        color: '#000',
        fontWeight: 'bold',
        fontSize: 16,
    },
});
