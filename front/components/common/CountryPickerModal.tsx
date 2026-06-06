import React, { useMemo, useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import {
    ARAB_COUNTRIES_FLAGS,
    OTHER_COUNTRY_FLAGS,
    searchCountries,
    isCountrySelected,
    type CountryFlag,
} from '../../data/localCountryFlags';
import {
    BG_BASE,
    PURPLE_PRIMARY,
    PURPLE_DARK,
    PURPLE_GLOW_SM,
    PURPLE_SOFT,
    TEXT_PRIMARY,
    TEXT_MUTED,
    TEXT_SECONDARY,
} from '../../constants/tokens';

type CountryTab = 'arab' | 'other';

interface CountryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: CountryFlag) => void | Promise<void>;
    selectedCountryId?: string;
}

export default function CountryPickerModal({
    visible,
    onClose,
    onSelect,
    selectedCountryId,
}: CountryPickerModalProps) {
    const [search, setSearch] = useState('');
    const [tab, setTab] = useState<CountryTab>('arab');

    const filteredCountries = useMemo(() => {
        if (search.trim()) return searchCountries(search);
        return tab === 'arab' ? ARAB_COUNTRIES_FLAGS : OTHER_COUNTRY_FLAGS;
    }, [search, tab]);

    const handleSelect = (item: CountryFlag) => {
        void Promise.resolve(onSelect(item)).catch(() => {});
    };

    const renderCountryItem = ({ item }: { item: CountryFlag }) => {
        const isSelected = isCountrySelected(selectedCountryId, item);

        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                activeOpacity={0.85}
                onPress={() => handleSelect(item)}
            >
                <Text style={styles.flag}>{item.flag}</Text>
                <View style={styles.countryInfo}>
                    <Text style={styles.countryName}>{item.nameAr}</Text>
                    <Text style={styles.countryNameEn}>{item.name}</Text>
                    {item.league ? (
                        <Text style={styles.leagueName}>{item.league}</Text>
                    ) : null}
                </View>
                {isSelected ? (
                    <View style={styles.checkmark}>
                        <Ionicons name="checkmark" size={16} color={PURPLE_PRIMARY} />
                    </View>
                ) : null}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView intensity={24} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.content}>
                    <LinearGradient
                        colors={['rgba(124,58,237,0.18)', 'transparent']}
                        style={styles.headerGlow}
                    />

                    <View style={styles.header}>
                        <Text style={styles.title}>اختر الدولة</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={22} color={TEXT_PRIMARY} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={18} color={TEXT_MUTED} style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ابحث عن الدولة..."
                            placeholderTextColor={TEXT_MUTED}
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {!search.trim() ? (
                        <View style={styles.toggleContainer}>
                            <TouchableOpacity
                                style={[styles.toggleButton, tab === 'arab' && styles.toggleButtonActiveWrap]}
                                onPress={() => setTab('arab')}
                                activeOpacity={0.9}
                            >
                                {tab === 'arab' ? (
                                    <LinearGradient
                                        colors={[PURPLE_PRIMARY, PURPLE_DARK]}
                                        style={styles.toggleGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.toggleButtonTextActive}>22 دولة عربية</Text>
                                    </LinearGradient>
                                ) : (
                                    <Text style={styles.toggleButtonText}>22 دولة عربية</Text>
                                )}
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[styles.toggleButton, tab === 'other' && styles.toggleButtonActiveWrap]}
                                onPress={() => setTab('other')}
                                activeOpacity={0.9}
                            >
                                {tab === 'other' ? (
                                    <LinearGradient
                                        colors={[PURPLE_PRIMARY, PURPLE_DARK]}
                                        style={styles.toggleGradient}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 0 }}
                                    >
                                        <Text style={styles.toggleButtonTextActive}>باقي الدول</Text>
                                    </LinearGradient>
                                ) : (
                                    <Text style={styles.toggleButtonText}>باقي الدول</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    ) : null}

                    <FlashList
                        data={filteredCountries}
                        keyExtractor={(item) => item.id}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderCountryItem}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="flag-outline" size={44} color={TEXT_MUTED} />
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
        backgroundColor: 'rgba(0,0,0,0.55)',
    },
    content: {
        backgroundColor: BG_BASE,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '78%',
        padding: 20,
        borderTopWidth: 1,
        borderColor: PURPLE_GLOW_SM,
        overflow: 'hidden',
    },
    headerGlow: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        height: 100,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 14,
    },
    title: {
        fontSize: 20,
        fontWeight: '800',
        color: TEXT_PRIMARY,
    },
    closeButton: {
        padding: 6,
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 20,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderRadius: 14,
        paddingHorizontal: 12,
        marginBottom: 14,
        height: 46,
        borderWidth: 1,
        borderColor: 'rgba(124,58,237,0.2)',
    },
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: TEXT_PRIMARY,
        fontSize: 15,
        textAlign: 'right',
    },
    toggleContainer: {
        flexDirection: 'row',
        marginBottom: 14,
        gap: 10,
    },
    toggleButton: {
        flex: 1,
        borderRadius: 14,
        backgroundColor: 'rgba(255,255,255,0.06)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        overflow: 'hidden',
        minHeight: 44,
        justifyContent: 'center',
    },
    toggleButtonActiveWrap: {
        borderColor: PURPLE_SOFT,
    },
    toggleGradient: {
        paddingVertical: 12,
        paddingHorizontal: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toggleButtonText: {
        color: TEXT_SECONDARY,
        fontSize: 13,
        fontWeight: '700',
        textAlign: 'center',
        paddingVertical: 12,
    },
    toggleButtonTextActive: {
        color: TEXT_PRIMARY,
        fontSize: 13,
        fontWeight: '800',
        textAlign: 'center',
    },
    listContent: {
        paddingBottom: 40,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.04)',
        padding: 14,
        borderRadius: 14,
        marginBottom: 8,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.06)',
    },
    selectedItem: {
        backgroundColor: 'rgba(124,58,237,0.14)',
        borderColor: PURPLE_SOFT,
    },
    flag: {
        fontSize: 36,
        marginRight: 14,
    },
    countryInfo: {
        flex: 1,
    },
    countryName: {
        color: TEXT_PRIMARY,
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 2,
    },
    countryNameEn: {
        color: TEXT_MUTED,
        fontSize: 12,
    },
    leagueName: {
        color: PURPLE_SOFT,
        fontSize: 11,
        fontWeight: '600',
        marginTop: 2,
    },
    checkmark: {
        backgroundColor: 'rgba(255,255,255,0.95)',
        borderRadius: 14,
        padding: 4,
    },
    emptyContainer: {
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 60,
    },
    emptyText: {
        color: TEXT_MUTED,
        fontSize: 15,
        marginTop: 10,
    },
});
