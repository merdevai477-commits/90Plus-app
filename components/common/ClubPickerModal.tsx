import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, TextInput, ActivityIndicator } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { TOP_5_LEAGUES_CLUBS, TopClub, getClubsByLeague, getAllLeagues } from '../../data/top5LeaguesClubs';
import { logger } from '../../utils/logger';

interface ClubPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (club: TopClub) => void;
    selectedClubId?: string | number;  // ✅ Accept both string and number
}

export default function ClubPickerModal({ visible, onClose, onSelect, selectedClubId }: ClubPickerModalProps) {
    const [search, setSearch] = useState('');
    const [selectedLeague, setSelectedLeague] = useState<string>('all');
    const [loading, setLoading] = useState(false);

    // ✅ Use local clubs from top 5 leagues
    const clubs = selectedLeague === 'all' 
        ? TOP_5_LEAGUES_CLUBS 
        : getClubsByLeague(selectedLeague);

    const leagues = ['all', ...getAllLeagues()];

    const filteredClubs = clubs.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.nameAr.includes(search) ||
        c.league.toLowerCase().includes(search.toLowerCase())
    );

    const getLeagueDisplayName = (league: string) => {
        const leagueNames: Record<string, string> = {
            'all': 'الكل',
            'Premier League': 'الدوري الإنجليزي',
            'La Liga': 'الدوري الإسباني',
            'Serie A': 'الدوري الإيطالي',
            'Bundesliga': 'الدوري الألماني',
            'Ligue 1': 'الدوري الفرنسي',
        };
        return leagueNames[league] || league;
    };

    const renderClubItem = ({ item }: { item: TopClub }) => {
        const isSelected = selectedClubId === item.id || selectedClubId === item.apiId;
        // ✅ Apple compliance: always show emoji, never real club logos (trademark issue)
        const isEmoji = !item.logo?.startsWith('http') && !item.logo?.startsWith('/');
        const displayLogo = isEmoji ? item.logo : null; // ignore real URLs

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
                {displayLogo ? (
                    <Text style={styles.logoEmoji}>{displayLogo}</Text>
                ) : (
                    <View style={styles.logoFallback}>
                        <Text style={styles.logoFallbackText}>{item.name.charAt(0)}</Text>
                    </View>
                )}
                <Text style={styles.itemName} numberOfLines={2}>{item.nameAr}</Text>
                <Text style={styles.leagueName} numberOfLines={1}>{getLeagueDisplayName(item.league)}</Text>
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

                    {/* League Filter */}
                    <View style={styles.leagueFilter}>
                        <FlashList
                            data={leagues}
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            keyExtractor={(item) => item}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[
                                        styles.leagueButton,
                                        selectedLeague === item && styles.leagueButtonActive
                                    ]}
                                    onPress={() => setSelectedLeague(item)}
                                >
                                    <Text style={[
                                        styles.leagueButtonText,
                                        selectedLeague === item && styles.leagueButtonTextActive
                                    ]}>
                                        {getLeagueDisplayName(item)}
                                    </Text>
                                </TouchableOpacity>
                            )}
                            estimatedItemSize={100}
                        />
                    </View>

                    <FlashList
                        data={filteredClubs}
                        keyExtractor={(item) => item.id.toString()}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderClubItem}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>لا توجد أندية</Text>
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
        marginBottom: 20,
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
    leagueButtonActive: {
        backgroundColor: '#22c55e',
    },
    leagueButtonText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    leagueButtonTextActive: {
        color: '#000',
    },
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
    listContent: {
        paddingBottom: 40,
    },
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
    logoEmoji: {
        fontSize: 30,
        width: 50,
        height: 50,
        textAlign: 'center',
        lineHeight: 50,
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
    },
});
