/**
 * ClubPickerModal
 *
 * Lets the user pick a club from real API-Football data, organised by
 * country. Top 5 clubs per country are returned by the backend and
 * persisted in `cached_teams`, refreshed at most once every 7 days.
 *
 * The picker is country-first: the user picks a country tab, the modal
 * fetches the top 5 for that country, and shows real logos. Selection
 * returns the canonical TopClub shape so the profile screen can save
 * `clubLogo` (logo URL) and `favoriteTeam` (team name) to the backend.
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { ApiFootballService } from '../../services/apiFootball';
import { logger } from '../../utils/logger';
import { useTranslation } from '../../src/i18n';

export interface TopClub {
    id: number;
    teamId: number;
    name: string;
    nameAr: string;
    logo: string | null;
    league: string;
    country: string;
}

interface ClubPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (club: TopClub) => void;
    selectedClubId?: string | number;
}

// Country labels (English key → Arabic display).
// The English keys are the same strings the backend's COUNTRY_TOP_LEAGUE
// map keys against (lowercased server-side), so the order here drives the
// tab order as well.
const COUNTRY_LABELS_AR: Record<string, string> = {
    england: 'إنجلترا',
    spain: 'إسبانيا',
    italy: 'إيطاليا',
    germany: 'ألمانيا',
    france: 'فرنسا',
    netherlands: 'هولندا',
    portugal: 'البرتغال',
    belgium: 'بلجيكا',
    turkey: 'تركيا',
    saudi: 'السعودية',
    egypt: 'مصر',
    morocco: 'المغرب',
    algeria: 'الجزائر',
    tunisia: 'تونس',
    brazil: 'البرازيل',
    argentina: 'الأرجنتين',
    usa: 'الولايات المتحدة',
    mexico: 'المكسيك',
};

const DEFAULT_COUNTRY_ORDER = [
    'england',
    'spain',
    'italy',
    'germany',
    'france',
    'saudi',
    'egypt',
    'morocco',
    'algeria',
    'tunisia',
    'turkey',
    'portugal',
    'netherlands',
    'belgium',
    'brazil',
    'argentina',
    'usa',
    'mexico',
];

export default function ClubPickerModal({ visible, onClose, onSelect, selectedClubId }: ClubPickerModalProps) {
    const { language } = useTranslation();
    const clubLabel = (club: TopClub) =>
        language === 'ar' ? club.nameAr || club.name : club.name || club.nameAr;
    const [search, setSearch] = useState('');
    const [selectedCountry, setSelectedCountry] = useState<string>('england');
    const [clubsByCountry, setClubsByCountry] = useState<Record<string, TopClub[]>>({});
    const [loadingCountry, setLoadingCountry] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const clubsByCountryRef = useRef(clubsByCountry);
    const fetchInFlightRef = useRef<string | null>(null);
    clubsByCountryRef.current = clubsByCountry;

    const fetchCountryClubs = useCallback(async (countryKey: string) => {
        if (clubsByCountryRef.current[countryKey]) return;
        if (fetchInFlightRef.current === countryKey) return;

        fetchInFlightRef.current = countryKey;
        setLoadingCountry(countryKey);
        setError(null);
        try {
            const apiCountry = countryKey === 'saudi' ? 'Saudi-Arabia' :
                countryKey === 'usa' ? 'USA' :
                // Capitalise first letter; backend lookup is case-insensitive
                countryKey.charAt(0).toUpperCase() + countryKey.slice(1);

            const clubs = await ApiFootballService.getTopClubsByCountry(apiCountry);

            const mapped: TopClub[] = clubs.map((c) => ({
                id: c.teamId,
                teamId: c.teamId,
                name: c.name,
                nameAr: c.name, // backend returns localised name when available
                logo: c.logo,
                league: COUNTRY_LABELS_AR[countryKey] ?? countryKey,
                country: c.country ?? apiCountry,
            }));

            setClubsByCountry((prev) => ({ ...prev, [countryKey]: mapped }));

            if (mapped.length === 0) {
                setError('لم نجد أندية لهذا البلد. حاول بلد آخر.');
            }
        } catch (err: any) {
            logger.error('[ClubPickerModal] Failed to load clubs for', countryKey, err?.message);
            setError('فشل تحميل الأندية. تحقق من اتصالك وحاول مرة أخرى.');
            // Mark as loaded (empty) so a failed fetch does not retrigger the effect loop.
            setClubsByCountry((prev) => (
                prev[countryKey] ? prev : { ...prev, [countryKey]: [] }
            ));
        } finally {
            if (fetchInFlightRef.current === countryKey) {
                fetchInFlightRef.current = null;
            }
            setLoadingCountry(null);
        }
    }, []);

    // Load initial country when modal opens
    useEffect(() => {
        if (visible) {
            fetchCountryClubs(selectedCountry);
        }
    }, [visible, selectedCountry, fetchCountryClubs]);

    // Filtered list for the active country + search
    const filteredClubs = useMemo(() => {
        const list = clubsByCountry[selectedCountry] ?? [];
        if (!search.trim()) return list;
        const q = search.trim().toLowerCase();
        return list.filter((c) =>
            c.name.toLowerCase().includes(q) || c.nameAr.includes(search),
        );
    }, [clubsByCountry, selectedCountry, search]);

    const renderClubItem = ({ item }: { item: TopClub }) => {
        const isSelected = String(selectedClubId ?? '') === String(item.id);
        return (
            <TouchableOpacity
                style={[styles.item, isSelected && styles.selectedItem]}
                onPress={() => {
                    onSelect(item);
                    onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={item.name}
            >
                {item.logo ? (
                    <Image
                        source={{ uri: item.logo }}
                        style={styles.logo}
                        contentFit="contain"
                        cachePolicy="memory-disk"
                        transition={200}
                    />
                ) : (
                    <View style={styles.logoFallback}>
                        <Text style={styles.logoFallbackText}>{item.name.charAt(0)}</Text>
                    </View>
                )}
                <Text style={styles.itemName} numberOfLines={2}>{clubLabel(item)}</Text>
                <Text style={styles.leagueName} numberOfLines={1}>{item.league}</Text>
                {isSelected && (
                    <View style={styles.checkmark}>
                        <Ionicons name="checkmark" size={14} color="#22c55e" />
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
                        <Text style={styles.title}>اختر النادي</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="gray" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ابحث عن النادي..."
                            placeholderTextColor="gray"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {/* Country filter (horizontal tabs) */}
                    <View style={styles.leagueFilter}>
                        <FlashList
                            data={DEFAULT_COUNTRY_ORDER}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => {
                                const isActive = selectedCountry === item;
                                return (
                                    <TouchableOpacity
                                        style={[styles.leagueButton, isActive && styles.leagueButtonActive]}
                                        onPress={() => {
                                            setSelectedCountry(item);
                                            setSearch('');
                                        }}
                                        accessibilityRole="tab"
                                    >
                                        <Text style={[styles.leagueButtonText, isActive && styles.leagueButtonTextActive]}>
                                            {COUNTRY_LABELS_AR[item] ?? item}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            }}
                        />
                    </View>

                    {loadingCountry === selectedCountry ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#22c55e" />
                            <Text style={styles.loadingText}>جاري تحميل الأندية...</Text>
                        </View>
                    ) : error && filteredClubs.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyText}>{error}</Text>
                        </View>
                    ) : (
                        <FlashList
                            data={filteredClubs}
                            keyExtractor={(item) => String(item.id)}
                            numColumns={3}
                            contentContainerStyle={styles.listContent}
                            renderItem={renderClubItem}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>لا توجد أندية</Text>
                                </View>
                            }
                        />
                    )}
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
        marginBottom: 20,
        height: 44,
    },
    searchIcon: { marginRight: 8 },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        textAlign: 'right',
    },
    leagueFilter: {
        marginBottom: 15,
        height: 40,
    },
    leagueButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginRight: 8,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    leagueButtonActive: { backgroundColor: '#22c55e' },
    leagueButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    leagueButtonTextActive: { color: '#000' },
    loadingContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    loadingText: {
        color: '#FFF',
        marginTop: 10,
        fontSize: 14,
    },
    listContent: { paddingBottom: 40 },
    item: {
        flex: 1,
        margin: 5,
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        padding: 10,
        borderRadius: 12,
        minHeight: 110,
        justifyContent: 'center',
        position: 'relative',
    },
    selectedItem: {
        backgroundColor: 'rgba(34, 197, 94, 0.2)',
        borderWidth: 2,
        borderColor: '#22c55e',
    },
    logo: {
        width: 50,
        height: 50,
        marginBottom: 8,
    },
    logoFallback: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    logoFallbackText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
    },
    itemName: {
        color: '#FFF',
        fontSize: 12,
        textAlign: 'center',
        fontWeight: '600',
    },
    leagueName: {
        color: '#888',
        fontSize: 10,
        textAlign: 'center',
        marginTop: 2,
    },
    checkmark: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
        textAlign: 'center',
    },
});
