import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, FlatList, TextInput } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { CLUBS } from '../../data/clubs';
import { getClubLogo, refreshClubLogo } from '../../services/clubLogoService';
import { logger } from '../../utils/logger';

interface ClubPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (club: any) => void;
    selectedClubId?: string;
}

export default function ClubPickerModal({ visible, onClose, onSelect, selectedClubId }: ClubPickerModalProps) {
    const [search, setSearch] = useState('');
    const [failedLogos, setFailedLogos] = useState<Set<string>>(new Set());
    const [clubLogos, setClubLogos] = useState<Map<string, string>>(new Map());

    // Load real logos when modal opens - prioritize Egyptian clubs
    useEffect(() => {
        if (visible) {
            const loadLogos = async () => {
                const logoMap = new Map<string, string>();
                
                // ✅ Prioritize Egyptian clubs first
                const egyptianClubs = CLUBS.filter(c => c.country === 'Egypt');
                const otherClubs = CLUBS.filter(c => c.country !== 'Egypt');
                
                // Load Egyptian clubs first - force refresh from API to get correct logos
                const egyptianPromises = egyptianClubs.map(async (club) => {
                    if (club.apiId) {
                        try {
                            // ✅ Force refresh from API to ensure correct logo
                            const logo = await refreshClubLogo(club.apiId);
                            // ✅ Only use logo if it's a valid URL
                            if (logo && logo.startsWith('http')) {
                                logoMap.set(club.id, logo);
                                club.logo = logo; // Update club object
                            } else {
                                // Invalid logo - don't use it, try fallback
                                const fallbackLogo = await getClubLogo(club.apiId);
                                if (fallbackLogo && fallbackLogo.startsWith('http')) {
                                    logoMap.set(club.id, fallbackLogo);
                                    club.logo = fallbackLogo;
                                } else {
                                    logger.warn(`Invalid logo for ${club.name} (ID: ${club.apiId})`);
                                }
                            }
                        } catch (error) {
                            logger.error(`Error loading logo for ${club.name}:`, error);
                            // Try fallback
                            try {
                                const fallbackLogo = await getClubLogo(club.apiId);
                                if (fallbackLogo && fallbackLogo.startsWith('http')) {
                                    logoMap.set(club.id, fallbackLogo);
                                }
                            } catch (e) {
                                // Ignore fallback errors
                            }
                        }
                    } else if (club.logo && club.logo.startsWith('http')) {
                        logoMap.set(club.id, club.logo);
                    }
                });
                
                // Then load other clubs
                const otherPromises = otherClubs.map(async (club) => {
                    if (club.apiId && !club.logo) {
                        try {
                            const logo = await getClubLogo(club.apiId);
                            // ✅ Only use logo if it's a valid URL
                            if (logo && logo.startsWith('http')) {
                                logoMap.set(club.id, logo);
                                club.logo = logo; // Update club object
                            } else {
                                // Invalid logo - don't use it
                                logger.warn(`Invalid logo for ${club.name} (ID: ${club.apiId}): ${logo}`);
                            }
                        } catch (error) {
                            logger.error(`Error loading logo for ${club.name}:`, error);
                        }
                    } else if (club.logo && club.logo.startsWith('http')) {
                        logoMap.set(club.id, club.logo);
                    }
                });
                
                // Load Egyptian clubs first, then others
                await Promise.allSettled(egyptianPromises);
                await Promise.allSettled(otherPromises);
                setClubLogos(logoMap);
            };
            loadLogos();
        }
    }, [visible]);

    // ✅ Sort clubs: Egyptian clubs first, then others
    const sortedClubs = [...CLUBS].sort((a, b) => {
        // Egyptian clubs first
        if (a.country === 'Egypt' && b.country !== 'Egypt') return -1;
        if (a.country !== 'Egypt' && b.country === 'Egypt') return 1;
        // Within same country, sort by name
        return a.name.localeCompare(b.name, 'ar');
    });

    const filteredClubs = sortedClubs.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.name.includes(search) || // Support Arabic search
        c.league.toLowerCase().includes(search.toLowerCase()) ||
        c.country.toLowerCase().includes(search.toLowerCase())
    );

    const handleImageError = (clubId: string) => {
        setFailedLogos(prev => new Set(prev).add(clubId));
    };
    
    const getClubLogoUrl = (club: typeof CLUBS[0]): string | null => {
        // Priority: 1. Real logo from API, 2. Cached logo, 3. Existing logo
        return clubLogos.get(club.id) || club.logo || null;
    };

    const renderClubItem = ({ item }: { item: typeof CLUBS[0] }) => {
        const isSelected = selectedClubId === item.id;
        const logoFailed = failedLogos.has(item.id);

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
                {(() => {
                    const logoUrl = getClubLogoUrl(item);
                    if (!logoFailed && logoUrl) {
                        return (
                            <Image
                                source={{ uri: logoUrl }}
                                style={styles.logo}
                                contentFit="contain"
                                transition={200}
                                onError={() => handleImageError(item.id)}
                            />
                        );
                    }
                    return (
                        <View style={[styles.logoFallback, { backgroundColor: item.color }]}>
                            <Text style={styles.logoFallbackText}>
                                {item.name.charAt(0)}
                            </Text>
                        </View>
                    );
                })()}
                <Text style={styles.itemName} numberOfLines={1}>{item.name}</Text>
                <Text style={styles.leagueName} numberOfLines={1}>{item.country}</Text>
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

                    <FlatList
                        data={filteredClubs}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderClubItem}
                        removeClippedSubviews={true}
                        maxToRenderPerBatch={15}
                        windowSize={5}
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
    logoFallback: {
        width: 50,
        height: 50,
        borderRadius: 25,
        marginBottom: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    logoFallbackText: {
        color: '#FFF',
        fontSize: 20,
        fontWeight: 'bold',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
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
});
