import React, { useState, useMemo, useCallback, memo } from 'react';
import { View, Text, Modal, TouchableOpacity, FlatList, StyleSheet, Platform, StatusBar, TextInput, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { COUNTRIES, Country } from '../../data/countries';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

// Region labels and icons
const REGIONS = [
    { key: 'all' as const, label: 'الكل', labelEn: 'All', icon: '🌍' },
    { key: 'arab' as const, label: 'عربي', labelEn: 'Arab', icon: '🕌' },
    { key: 'europe' as const, label: 'أوروبا', labelEn: 'Europe', icon: '🏰' },
    { key: 'asia' as const, label: 'آسيا', labelEn: 'Asia', icon: '🏯' },
    { key: 'africa' as const, label: 'أفريقيا', labelEn: 'Africa', icon: '🌍' },
    { key: 'americas' as const, label: 'أمريكا', labelEn: 'Americas', icon: '🗽' },
    { key: 'oceania' as const, label: 'أوقيانوسيا', labelEn: 'Oceania', icon: '🏝️' },
] as const;

type RegionFilter = typeof REGIONS[number]['key'];

// Helper to get flag image URL from country code
export const getFlagImageUrl = (countryCode: string, size: number = 80): string => {
    return `https://flagcdn.com/w${size}/${countryCode.toLowerCase()}.png`;
};

// Helper to check if a string is an emoji flag and convert to country code
export const emojiToCountryCode = (emoji: string): string | null => {
    // Emoji flags are two regional indicator symbols
    // 🇪🇬 = regional indicator E + regional indicator G
    const codePoints = [...emoji];
    if (codePoints.length !== 2) return null;
    
    const first = codePoints[0].codePointAt(0);
    const second = codePoints[1].codePointAt(0);
    
    if (!first || !second) return null;
    
    // Regional indicator symbols range: 0x1F1E6 (A) to 0x1F1FF (Z)
    if (first >= 0x1F1E6 && first <= 0x1F1FF && second >= 0x1F1E6 && second <= 0x1F1FF) {
        const a = String.fromCharCode(first - 0x1F1E6 + 65); // A=65
        const b = String.fromCharCode(second - 0x1F1E6 + 65);
        return (a + b).toLowerCase();
    }
    
    return null;
};

// Deduplicate countries by id (some appear in both arab and asia regions)
const UNIQUE_COUNTRIES = (() => {
    const seen = new Set<string>();
    return COUNTRIES.filter(c => {
        if (seen.has(c.id)) return false;
        seen.add(c.id);
        return true;
    });
})();

// ✅ Memoized flag image component for performance
const FlagImage = memo(({ countryCode, size = 32 }: { countryCode: string; size?: number }) => (
    <Image
        source={{ uri: getFlagImageUrl(countryCode, 80) }}
        style={{ width: size, height: size * 0.7, borderRadius: 4 }}
        contentFit="cover"
        cachePolicy="memory-disk"
        transition={150}
        placeholder={require('../../assets/images/icon.png')}
    />
));

// ✅ Memoized country row for FlatList performance
const CountryRow = memo(({ 
    item, 
    isSelected, 
    onPress 
}: { 
    item: Country; 
    isSelected: boolean; 
    onPress: () => void;
}) => (
    <TouchableOpacity
        style={[styles.item, isSelected && styles.selectedItem]}
        onPress={onPress}
        activeOpacity={0.7}
    >
        <FlagImage countryCode={item.id} size={36} />
        <View style={styles.nameContainer}>
            <Text style={styles.nameAr}>{item.name}</Text>
            <Text style={styles.nameEn}>{item.nameEn}</Text>
        </View>
        {isSelected && (
            <Ionicons name="checkmark-circle" size={24} color="#22c55e" />
        )}
    </TouchableOpacity>
));

interface CountryPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (country: { code: string; name: string; flag: string }) => void;
    selectedCountryCode?: string;
}

export default function CountryPickerModal({ visible, onClose, onSelect, selectedCountryCode }: CountryPickerModalProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeRegion, setActiveRegion] = useState<RegionFilter>('all');

    // ✅ Memoized filtered countries for performance
    const filteredCountries = useMemo(() => {
        let result = UNIQUE_COUNTRIES;

        // Filter by region
        if (activeRegion !== 'all') {
            result = result.filter(c => c.region === activeRegion);
        }

        // Filter by search query
        if (searchQuery.trim()) {
            const query = searchQuery.trim().toLowerCase();
            result = result.filter(c =>
                c.name.includes(query) ||
                c.nameEn.toLowerCase().includes(query) ||
                c.id.includes(query)
            );
        }

        return result;
    }, [searchQuery, activeRegion]);

    // ✅ Normalize selectedCountryCode — handle both emoji and code formats
    const normalizedSelectedCode = useMemo(() => {
        if (!selectedCountryCode) return null;
        // If it's an emoji, convert
        const fromEmoji = emojiToCountryCode(selectedCountryCode);
        if (fromEmoji) return fromEmoji;
        // Otherwise treat as a code (lowercase)
        return selectedCountryCode.toLowerCase();
    }, [selectedCountryCode]);

    const handleSelect = useCallback((country: Country) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        // Return in the format profile.tsx expects
        onSelect({
            code: country.id.toUpperCase(),
            name: country.name,
            flag: country.flag, // Keep emoji for backward compat
        });
        onClose();
        // Reset filters on close
        setSearchQuery('');
        setActiveRegion('all');
    }, [onSelect, onClose]);

    const handleClose = useCallback(() => {
        onClose();
        setSearchQuery('');
        setActiveRegion('all');
    }, [onClose]);

    const handleRegionPress = useCallback((region: RegionFilter) => {
        Haptics.selectionAsync();
        setActiveRegion(prev => prev === region ? 'all' : region);
    }, []);

    const renderItem = useCallback(({ item }: { item: Country }) => (
        <CountryRow
            item={item}
            isSelected={normalizedSelectedCode === item.id}
            onPress={() => handleSelect(item)}
        />
    ), [normalizedSelectedCode, handleSelect]);

    const keyExtractor = useCallback((item: Country) => item.id, []);

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={handleClose}
        >
            <View style={styles.container}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.content}>
                    {/* Header */}
                    <View style={styles.header}>
                        <Text style={styles.title}>اختر دولتك 🌍</Text>
                        <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Search Bar */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="rgba(255,255,255,0.5)" style={styles.searchIcon} />
                        <TextInput
                            style={styles.searchInput}
                            placeholder="ابحث بالعربي أو الإنجليزي..."
                            placeholderTextColor="rgba(255,255,255,0.35)"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                            autoCorrect={false}
                            autoCapitalize="none"
                            returnKeyType="search"
                        />
                        {searchQuery.length > 0 && (
                            <TouchableOpacity
                                onPress={() => setSearchQuery('')}
                                style={styles.clearButton}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Ionicons name="close-circle" size={20} color="rgba(255,255,255,0.4)" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {/* Region Filters */}
                    <FlatList
                        horizontal
                        data={REGIONS}
                        keyExtractor={(item) => item.key}
                        showsHorizontalScrollIndicator={false}
                        contentContainerStyle={styles.regionsContainer}
                        renderItem={({ item: region }) => (
                            <TouchableOpacity
                                key={region.key}
                                onPress={() => handleRegionPress(region.key)}
                                activeOpacity={0.7}
                            >
                                {activeRegion === region.key ? (
                                    <LinearGradient
                                        colors={['#22c55e', '#16a34a'] as const}
                                        start={{ x: 0, y: 0 }}
                                        end={{ x: 1, y: 1 }}
                                        style={styles.regionChip}
                                    >
                                        <Text style={styles.regionIcon}>{region.icon}</Text>
                                        <Text style={[styles.regionLabel, styles.regionLabelActive]}>{region.label}</Text>
                                    </LinearGradient>
                                ) : (
                                    <View style={[styles.regionChip, styles.regionChipInactive]}>
                                        <Text style={styles.regionIcon}>{region.icon}</Text>
                                        <Text style={styles.regionLabel}>{region.label}</Text>
                                    </View>
                                )}
                            </TouchableOpacity>
                        )}
                        style={styles.regionsList}
                    />

                    {/* Results Count */}
                    <Text style={styles.resultsCount}>
                        {filteredCountries.length} دولة
                    </Text>

                    {/* Countries List */}
                    <FlatList
                        data={filteredCountries}
                        keyExtractor={keyExtractor}
                        renderItem={renderItem}
                        showsVerticalScrollIndicator={false}
                        initialNumToRender={15}
                        maxToRenderPerBatch={20}
                        windowSize={10}
                        removeClippedSubviews={true}
                        getItemLayout={(_, index) => ({
                            length: 72,
                            offset: 72 * index,
                            index,
                        })}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Ionicons name="search-outline" size={48} color="rgba(255,255,255,0.2)" />
                                <Text style={styles.emptyText}>لا توجد نتائج</Text>
                                <Text style={styles.emptySubtext}>جرب البحث بلغة مختلفة</Text>
                            </View>
                        }
                        contentContainerStyle={filteredCountries.length === 0 ? styles.emptyList : undefined}
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
        backgroundColor: '#1A1A2E',
        borderTopLeftRadius: 28,
        borderTopRightRadius: 28,
        height: '85%',
        paddingTop: 16,
        paddingHorizontal: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -8 },
        shadowOpacity: 0.4,
        shadowRadius: 12,
        elevation: 10,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
        paddingHorizontal: 4,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        color: '#FFF',
        flex: 1,
        textAlign: 'center',
    },
    closeButton: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(255,255,255,0.1)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 14,
        paddingHorizontal: 14,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    searchIcon: {
        marginRight: 10,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
        color: '#FFF',
        paddingVertical: Platform.OS === 'ios' ? 14 : 10,
        textAlign: 'right',
        fontWeight: '500',
    },
    clearButton: {
        padding: 4,
    },
    regionsList: {
        maxHeight: 48,
        marginBottom: 8,
    },
    regionsContainer: {
        gap: 8,
        paddingHorizontal: 2,
    },
    regionChip: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        gap: 6,
    },
    regionChipInactive: {
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.08)',
    },
    regionIcon: {
        fontSize: 14,
    },
    regionLabel: {
        fontSize: 13,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.7)',
    },
    regionLabelActive: {
        color: '#FFF',
        fontWeight: '700',
    },
    resultsCount: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.35)',
        textAlign: 'right',
        marginBottom: 8,
        paddingRight: 4,
    },
    item: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 14,
        borderRadius: 14,
        marginBottom: 4,
        height: 72,
    },
    selectedItem: {
        backgroundColor: 'rgba(34, 197, 94, 0.12)',
        borderWidth: 1,
        borderColor: 'rgba(34, 197, 94, 0.25)',
    },
    nameContainer: {
        flex: 1,
        marginLeft: 14,
    },
    nameAr: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFF',
        textAlign: 'left',
    },
    nameEn: {
        fontSize: 12,
        color: 'rgba(255,255,255,0.45)',
        textAlign: 'left',
        marginTop: 2,
    },
    emptyContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 60,
        gap: 12,
    },
    emptyText: {
        fontSize: 18,
        fontWeight: '600',
        color: 'rgba(255,255,255,0.4)',
    },
    emptySubtext: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.25)',
    },
    emptyList: {
        flexGrow: 1,
    },
});
