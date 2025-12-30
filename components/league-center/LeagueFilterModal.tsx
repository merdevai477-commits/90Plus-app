import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    TextInput,
} from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LEAGUES } from '../../data/leagues';
import { useTranslation } from '../../src/i18n';

interface LeagueFilterModalProps {
    visible: boolean;
    onClose: () => void;
    selectedLeagues: number[];
    onSave: (leagues: number[]) => void;
}

// الدوريات الخمس الكبرى
const TOP_5_LEAGUES = [39, 140, 78, 135, 61]; // Premier, La Liga, Bundesliga, Serie A, Ligue 1

export default function LeagueFilterModal({
    visible,
    onClose,
    selectedLeagues,
    onSave,
}: LeagueFilterModalProps) {
    const insets = useSafeAreaInsets();
    const { t, language } = useTranslation();
    const [search, setSearch] = useState('');
    const [tempSelected, setTempSelected] = useState<number[]>(selectedLeagues);

    useEffect(() => {
        if (visible) {
            setTempSelected(selectedLeagues);
        }
    }, [visible, selectedLeagues]);

    const filteredLeagues = LEAGUES.filter(
        (l) =>
            l.name.toLowerCase().includes(search.toLowerCase()) ||
            l.nameAr.includes(search) ||
            l.country.toLowerCase().includes(search.toLowerCase())
    );

    // Sort: Top 5 first, then alphabetically
    const sortedLeagues = [...filteredLeagues].sort((a, b) => {
        const aIsTop5 = TOP_5_LEAGUES.includes(a.id);
        const bIsTop5 = TOP_5_LEAGUES.includes(b.id);
        if (aIsTop5 && !bIsTop5) return -1;
        if (!aIsTop5 && bIsTop5) return 1;
        return a.name.localeCompare(b.name);
    });

    const toggleLeague = (leagueId: number) => {
        setTempSelected((prev) =>
            prev.includes(leagueId)
                ? prev.filter((id) => id !== leagueId)
                : [...prev, leagueId]
        );
    };

    const handleSave = () => {
        onSave(tempSelected);
        onClose();
    };

    const handleClearAll = () => {
        setTempSelected([]);
    };

    const handleSelectTop5 = () => {
        setTempSelected(TOP_5_LEAGUES);
    };

    const renderLeagueItem = ({ item }: { item: typeof LEAGUES[0] }) => {
        const isSelected = tempSelected.includes(item.id);
        const isTop5 = TOP_5_LEAGUES.includes(item.id);

        return (
            <TouchableOpacity
                style={[styles.leagueItem, isSelected && styles.selectedItem]}
                onPress={() => toggleLeague(item.id)}
                activeOpacity={0.7}
            >
                <Image
                    source={{ uri: item.logo }}
                    style={styles.leagueLogo}
                    contentFit="contain"
                />
                <View style={styles.leagueInfo}>
                    <Text style={styles.leagueName}>
                        {language === 'ar' ? item.nameAr : item.name}
                    </Text>
                    <Text style={styles.leagueCountry}>
                        {item.countryFlag} {item.country}
                        {isTop5 && ' ⭐'}
                    </Text>
                </View>
                <View style={[styles.checkbox, isSelected && styles.checkboxSelected]}>
                    {isSelected && <Ionicons name="checkmark" size={16} color="#fff" />}
                </View>
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
                <BlurView intensity={30} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={[styles.content, { paddingTop: insets.top + 10 }]}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                        <Text style={styles.title}>
                            {t.leagues?.filterTitle || 'فلتر الدوريات'}
                        </Text>
                        <TouchableOpacity onPress={handleSave} style={styles.saveButton}>
                            <Text style={styles.saveText}>
                                {t.leagues?.filterSave || 'حفظ'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Quick Actions */}
                    <View style={styles.quickActions}>
                        <TouchableOpacity
                            style={styles.quickButton}
                            onPress={handleSelectTop5}
                        >
                            <Ionicons name="star" size={16} color="#FFD700" />
                            <Text style={styles.quickButtonText}>
                                {t.leagues?.filterMajorLeagues || 'الدوريات الكبرى'}
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={styles.quickButton}
                            onPress={handleClearAll}
                        >
                            <Ionicons name="close-circle" size={16} color="#ef4444" />
                            <Text style={styles.quickButtonText}>
                                {t.leagues?.filterClearAll || 'مسح الكل'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <Ionicons name="search" size={20} color="#888" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t.leagues?.filterSearchPlaceholder || 'ابحث عن دوري...'}
                            placeholderTextColor="#888"
                            value={search}
                            onChangeText={setSearch}
                        />
                    </View>

                    {/* Selected Count */}
                    <Text style={styles.selectedCount}>
                        {tempSelected.length > 0
                            ? (t.leagues?.filterSelectedCount || 'تم اختيار {count} دوري').replace('{count}', String(tempSelected.length))
                            : (t.leagues?.filterNoSelection || 'لم يتم اختيار أي دوري (سيتم عرض جميع المباريات)')}
                    </Text>

                    {/* Leagues List */}
                    <FlatList
                        data={sortedLeagues}
                        keyExtractor={(item) => item.id.toString()}
                        renderItem={renderLeagueItem}
                        contentContainerStyle={styles.listContent}
                        showsVerticalScrollIndicator={false}
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    content: {
        flex: 1,
        backgroundColor: '#1a1a2e',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        marginTop: 50,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 20,
        paddingVertical: 16,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: '#FFF',
    },
    saveButton: {
        backgroundColor: '#8B5CF6',
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 12,
    },
    saveText: {
        color: '#FFF',
        fontWeight: '600',
    },
    quickActions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 12,
        paddingVertical: 12,
        paddingHorizontal: 20,
    },
    quickButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    quickButtonText: {
        color: '#FFF',
        fontSize: 13,
        fontWeight: '500',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 12,
        marginHorizontal: 20,
        paddingHorizontal: 12,
        height: 44,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 15,
        textAlign: 'right',
    },
    selectedCount: {
        color: '#888',
        fontSize: 13,
        textAlign: 'center',
        paddingVertical: 12,
    },
    listContent: {
        paddingHorizontal: 20,
        paddingBottom: 40,
    },
    leagueItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.05)',
        borderRadius: 12,
        padding: 12,
        marginBottom: 8,
        gap: 12,
    },
    selectedItem: {
        backgroundColor: 'rgba(139, 92, 246, 0.2)',
        borderWidth: 1,
        borderColor: '#8B5CF6',
    },
    leagueLogo: {
        width: 40,
        height: 40,
        borderRadius: 20,
    },
    leagueInfo: {
        flex: 1,
    },
    leagueName: {
        color: '#FFF',
        fontSize: 15,
        fontWeight: '600',
    },
    leagueCountry: {
        color: '#888',
        fontSize: 12,
        marginTop: 2,
    },
    checkbox: {
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 2,
        borderColor: '#555',
        alignItems: 'center',
        justifyContent: 'center',
    },
    checkboxSelected: {
        backgroundColor: '#8B5CF6',
        borderColor: '#8B5CF6',
    },
});
