import React from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, Platform, StatusBar } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

interface Country {
    code: string;
    name: string;
    flag: string;
}

// Common countries list - can be expanded
const COUNTRIES: Country[] = [
    { code: 'EG', name: 'Egypt', flag: '🇪🇬' },
    { code: 'SA', name: 'Saudi Arabia', flag: '🇸🇦' },
    { code: 'AE', name: 'UAE', flag: '🇦🇪' },
    { code: 'QA', name: 'Qatar', flag: '🇶🇦' },
    { code: 'MA', name: 'Morocco', flag: '🇲🇦' },
    { code: 'DZ', name: 'Algeria', flag: '🇩🇿' },
    { code: 'TN', name: 'Tunisia', flag: '🇹🇳' },
    { code: 'KW', name: 'Kuwait', flag: '🇰🇼' },
    { code: 'OM', name: 'Oman', flag: '🇴🇲' },
    { code: 'BH', name: 'Bahrain', flag: '🇧🇭' },
    { code: 'JO', name: 'Jordan', flag: '🇯🇴' },
    { code: 'LB', name: 'Lebanon', flag: '🇱🇧' },
    { code: 'PS', name: 'Palestine', flag: '🇵🇸' },
    { code: 'IQ', name: 'Iraq', flag: '🇮🇶' },
    { code: 'YE', name: 'Yemen', flag: '🇾🇪' },
    { code: 'SD', name: 'Sudan', flag: '🇸🇩' },
    { code: 'LY', name: 'Libya', flag: '🇱🇾' },
    { code: 'ES', name: 'Spain', flag: '🇪🇸' },
    { code: 'GB', name: 'UK', flag: '🇬🇧' },
    { code: 'FR', name: 'France', flag: '🇫🇷' },
    { code: 'DE', name: 'Germany', flag: '🇩🇪' },
    { code: 'IT', name: 'Italy', flag: '🇮🇹' },
    { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
    { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
    { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
];

interface CountryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: Country) => void;
    selectedCountryCode?: string;
}

export default function CountryPickerModal({ visible, onClose, onSelect, selectedCountryCode }: CountryPickerModalProps) {
    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>اختر الدولة</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <FlatList
                        data={COUNTRIES}
                        keyExtractor={(item) => item.code}
                        showsVerticalScrollIndicator={false}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={[
                                    styles.item,
                                    selectedCountryCode === item.code && styles.selectedItem
                                ]}
                                onPress={() => {
                                    onSelect(item);
                                    onClose();
                                }}
                            >
                                <Text style={styles.flag}>{item.flag}</Text>
                                <Text style={styles.name}>{item.name}</Text>
                                {selectedCountryCode === item.code && (
                                    <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
                                )}
                            </TouchableOpacity>
                        )}
                    />
                </View>
            </View>
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
        height: '70%',
        padding: 20,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -4,
        },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        paddingBottom: 15,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        textAlign: 'center',
        flex: 1,
    },
    closeButton: {
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 16,
        paddingHorizontal: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
    },
    selectedItem: {
        backgroundColor: 'rgba(34, 197, 94, 0.1)',
        borderRadius: 12,
        borderBottomWidth: 0,
    },
    flag: {
        fontSize: 28,
        marginRight: 16,
    },
    name: {
        fontSize: 16,
        color: '#FFF',
        flex: 1,
    },
});
