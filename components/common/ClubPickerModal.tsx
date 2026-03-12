import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, FlatList, TextInput, ActivityIndicator } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { getApiUrl } from '../../config/api.config';
import { logger } from '../../utils/logger';
import { useAuth } from '@clerk/clerk-expo';

interface Club {
    id: string;          // Convert teamId to string for compatibility
    apiId?: number;      // Numeric teamId for API calls
    name: string;
    logo: string;        // Non-nullable for compatibility
    country: string;     // Non-nullable for compatibility
    league: string;      // Non-nullable for compatibility
    color: string;       // Non-nullable for compatibility
}

interface ClubPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (club: Club) => void;
    selectedClubId?: string | number;  // ✅ Accept both string and number
}

export default function ClubPickerModal({ visible, onClose, onSelect, selectedClubId }: ClubPickerModalProps) {
    const [search, setSearch] = useState('');
    const [clubs, setClubs] = useState<Club[]>([]);
    const [loading, setLoading] = useState(false);
    const [failedLogos, setFailedLogos] = useState<Set<number>>(new Set());
    const { getToken } = useAuth();

    // ✅ Load clubs from backend database
    useEffect(() => {
        if (visible) {
            loadClubsFromBackend();
        }
    }, [visible]);

    const loadClubsFromBackend = async () => {
        try {
            setLoading(true);
            const token = await getToken();
            const response = await fetch(`${getApiUrl()}/football/cached/teams/all`, {
                headers: {
                    'Authorization': `Bearer ${token}`,
                },
            });

            if (response.ok) {
                const data = await response.json();
                const teams: Club[] = (data.response || data.teams || [])
                    .filter((team: any) => team.logo)  // ✅ Only include teams with logos
                    .map((team: any) => ({
                        id: String(team.teamId || team.id),  // ✅ Convert to string for compatibility
                        apiId: team.teamId || team.id,       // ✅ Keep numeric for API calls
                        name: team.name,
                        logo: team.logo || '',               // ✅ Default to empty string
                        country: team.country || '',         // ✅ Default to empty string
                        league: team.country || '',          // ✅ Use country as league for now
                        color: '#FFFFFF',                    // ✅ Default color
                    }));
                
                // ✅ Sort: Popular leagues first, then alphabetically
                const sortedTeams = teams.sort((a, b) => {
                    const popularCountries = ['England', 'Spain', 'Germany', 'Italy', 'France', 'Egypt'];
                    const aPopular = popularCountries.includes(a.country || '');
                    const bPopular = popularCountries.includes(b.country || '');
                    
                    if (aPopular && !bPopular) return -1;
                    if (!aPopular && bPopular) return 1;
                    
                    return a.name.localeCompare(b.name);
                });
                
                setClubs(sortedTeams);
                logger.info(`✅ Loaded ${sortedTeams.length} clubs from backend`);
            } else {
                logger.error('Failed to load clubs:', response.status);
            }
        } catch (error) {
            logger.error('Error loading clubs:', error);
        } finally {
            setLoading(false);
        }
    };

    const filteredClubs = clubs.filter(c => 
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        (c.country && c.country.toLowerCase().includes(search.toLowerCase()))
    );

    const handleImageError = (clubId: number) => {
        setFailedLogos(prev => new Set(prev).add(clubId));
    };

    const renderClubItem = ({ item }: { item: Club }) => {
        const isSelected = selectedClubId === item.id || selectedClubId === item.apiId;
        const logoFailed = failedLogos.has(item.apiId || 0);

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
                {!logoFailed && item.logo ? (
                    <Image
                        source={{ uri: item.logo }}
                        style={styles.logo}
                        contentFit="contain"
                        transition={200}
                        onError={() => handleImageError(item.apiId || 0)}
                    />
                ) : (
                    <View style={styles.logoFallback}>
                        <Text style={styles.logoFallbackText}>
                            {item.name.charAt(0)}
                        </Text>
                    </View>
                )}
                <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                {item.country && item.country.length > 0 && (
                    <Text style={styles.leagueName} numberOfLines={1}>{item.country}</Text>
                )}
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

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color="#22c55e" />
                            <Text style={styles.loadingText}>جاري تحميل الأندية...</Text>
                        </View>
                    ) : (
                        <FlatList
                            data={filteredClubs}
                            keyExtractor={(item) => item.id.toString()}
                            numColumns={3}
                            contentContainerStyle={styles.listContent}
                            renderItem={renderClubItem}
                            removeClippedSubviews={true}
                            maxToRenderPerBatch={15}
                            windowSize={5}
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
    searchIcon: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        color: '#FFF',
        fontSize: 16,
        textAlign: 'right',
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
