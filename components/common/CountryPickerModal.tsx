import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ALL_COUNTRY_FLAGS, TOP_5_LEAGUES_FLAGS, searchCountries, CountryFlag } from '../../data/localCountryFlags';

interface CountryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: CountryFlag) => void;
    selectedCountryId?: string;
}

export default function CountryPickerModal({ visible, onClose, onSelect, selectedCountryId }: CountryPickerModalProps) {
    const [search, setSearch] = useState('');
    const [showAll, setShowAll] = useState(false);

    // Filter countries based on search
    const filteredCountries = search 
        ? searchCountries(search)
        : showAll 
            ? ALL_COUNTRY_FLAGS 
            : TOP_5_LEAGUES_FLAGS;

    const renderCountryItem = ({ item }: { item: CountryFlag }) => {
        const isSelected = selectedCountryId === item.id || selectedCountryId === item.code;

        return (
            <TouchableOpacity
                style={[
                    styles.item,
                    isSelected && styles.selectedItem
                ]}
                onPress={() => {
                    onSelect(item);
                    onClose();
                }}
            >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{item.nameAr}</Text>
                    <Text style={styles.countryNameEn}>{item.name}</Text>
                    {item.league && (
                        <Text style={styles.leagueName}>{item.league}</Text>
                    )}
                </View>
                {isSelected && (
                    <View style={styles.checkmark}>
                        <Ionicons name="checkmark" size={18} color="#22c55e" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

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

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="gray" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ابحث عن الدولة..."
                            placeholderTextColor="gray"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {/* Toggle between Top 5 and All */}
                    {!search && (
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    !showAll && styles.toggleButtonActive
                                ]}
                                onPress={() => setShowAll(false)}
                            >
                                <Text style={[
                                    styles.toggleButtonText,
                                    !showAll && styles.toggleButtonTextActive
                                ]}>
                                    الدوريات الخمسة الكبرى
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.toggleButton,
                                    showAll && styles.toggleButtonActive
                                ]}
                                onPress={() => setShowAll(true)}
                            >
                                <Text style={[
                                    styles.toggleButtonText,
                                    showAll && styles.toggleButtonTextActive
                                ]}>
                                    جميع الدول
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    <FlashList
                        data={filteredCountries}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderCountryItem}
                        estimatedItemSize={70}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="flag-outline" size={48} color="#666" />
                                <Text style={styles.emptyText}>لا توجد دول</Text>
                            </View>
                        }
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
        height: '75%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 15,
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
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        paddingHorizontal: 10,
        marginBottom: 15,
        height: 44,
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        textAlign: 'right',
    },
    toggleContainer: {
        flexDirection: 'row',
        marginBottom: 15,
        gap: 10,
    },
    toggleButton: {
        flex: 1,
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 12,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
    },
    toggleButtonActive: {
        backgroundColor: '#22c55e',
    },
    toggleButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    toggleButtonTextActive: {
        color: '#000',
    },
    listContent: {
        paddingBottom: 40,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 15,
        borderRadius: 12,
        marginBottom: 10,
        position: 'relative',
    },
    selectedItem: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 2,
        borderColor: '#22c55e',
    },
    flag: {
        fontSize: 40,
        marginRight: 15,
    },
    countryInfo: {
        flex: 1,
    },
    countryName: {
        color: '#FFF',
        fontSize: 16,
        fontWeight: '600',
        marginBottom: 2,
    },
    countryNameEn: {
        color: '#888',
        fontSize: 13,
        marginBottom: 2,
    },
    leagueName: {
        color: '#22c55e',
        fontSize: 11,
        fontWeight: '500',
    },
    checkmark: {
        backgroundColor: '#FFF',
        borderRadius: 15,
        padding: 4,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
        marginTop: 10,
    },
});
