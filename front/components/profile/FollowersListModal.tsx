import React, { useState, useEffect, useCallback } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    ActivityIndicator,
    TextInput,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { X, Search, BadgeCheck, Code, UserPlus, UserMinus } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useAuth } from '@clerk/clerk-expo';
import { FollowService } from '../../src/services/authService';
import { router } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import MiniProfileCard from './MiniProfileCard';
import * as Haptics from 'expo-haptics';
import { logger } from '../../utils/logger';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface FollowUser {
    id: string;
    username: string;
    displayName?: string;
    avatar?: string;
    isVerified?: boolean;
    isDeveloper?: boolean;
    isFollowing?: boolean;
    countryFlag?: string;
    position?: string;
    clubLogo?: string;
}

interface FollowersListModalProps {
    visible: boolean;
    onClose: () => void;
    userId: string;
    initialTab?: 'followers' | 'following';
    username?: string;
}

export default function FollowersListModal({
    visible,
    onClose,
    userId,
    initialTab = 'followers',
    username,
}: FollowersListModalProps) {
    const [activeTab, setActiveTab] = useState<'followers' | 'following'>(initialTab);
    const [followers, setFollowers] = useState<FollowUser[]>([]);
    const [following, setFollowing] = useState<FollowUser[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isLoadingMore, setIsLoadingMore] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [followersPage, setFollowersPage] = useState(0);
    const [followingPage, setFollowingPage] = useState(0);
    const [hasMoreFollowers, setHasMoreFollowers] = useState(true);
    const [hasMoreFollowing, setHasMoreFollowing] = useState(true);
    const { getToken } = useAuth();
    const { t } = useTranslation();

    const PAGE_SIZE = 30;

    useEffect(() => {
        if (visible) {
            setActiveTab(initialTab);
            // Reset pagination state
            setFollowers([]);
            setFollowing([]);
            setFollowersPage(0);
            setFollowingPage(0);
            setHasMoreFollowers(true);
            setHasMoreFollowing(true);
            loadData();
        }
    }, [visible, initialTab]);

    const loadData = async () => {
        setIsLoading(true);
        try {
            const token = await getToken();
            if (token) {
                const [followersData, followingData] = await Promise.all([
                    FollowService.getFollowers(token, userId, PAGE_SIZE, 0),
                    FollowService.getFollowing(token, userId, PAGE_SIZE, 0),
                ]);
                setFollowers(followersData || []);
                setFollowing(followingData || []);
                setFollowersPage(1);
                setFollowingPage(1);
                setHasMoreFollowers((followersData || []).length >= PAGE_SIZE);
                setHasMoreFollowing((followingData || []).length >= PAGE_SIZE);
            }
        } catch (error) {
            console.error('Error loading follow data:', error);
        }
        setIsLoading(false);
    };

    const loadMoreFollowers = useCallback(async () => {
        if (!hasMoreFollowers || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const token = await getToken();
            if (token) {
                const offset = followersPage * PAGE_SIZE;
                const moreData = await FollowService.getFollowers(token, userId, PAGE_SIZE, offset);
                if (moreData && moreData.length > 0) {
                    setFollowers(prev => [...prev, ...moreData]);
                    setFollowersPage(prev => prev + 1);
                    setHasMoreFollowers(moreData.length >= PAGE_SIZE);
                } else {
                    setHasMoreFollowers(false);
                }
            }
        } catch (error) {
            logger.error('Error loading more followers:', error);
        }
        setIsLoadingMore(false);
    }, [hasMoreFollowers, isLoadingMore, followersPage, getToken, userId]);

    const loadMoreFollowing = useCallback(async () => {
        if (!hasMoreFollowing || isLoadingMore) return;
        setIsLoadingMore(true);
        try {
            const token = await getToken();
            if (token) {
                const offset = followingPage * PAGE_SIZE;
                const moreData = await FollowService.getFollowing(token, userId, PAGE_SIZE, offset);
                if (moreData && moreData.length > 0) {
                    setFollowing(prev => [...prev, ...moreData]);
                    setFollowingPage(prev => prev + 1);
                    setHasMoreFollowing(moreData.length >= PAGE_SIZE);
                } else {
                    setHasMoreFollowing(false);
                }
            }
        } catch (error) {
            logger.error('Error loading more following:', error);
        }
        setIsLoadingMore(false);
    }, [hasMoreFollowing, isLoadingMore, followingPage, getToken, userId]);

    const handleFollow = async (targetUserId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const token = await getToken();
            if (token) {
                await FollowService.follow(token, targetUserId);
                // Update local state
                const updateList = (list: FollowUser[]) =>
                    list.map(u => u.id === targetUserId ? { ...u, isFollowing: true } : u);
                setFollowers(updateList);
                setFollowing(updateList);
            }
        } catch (error) {
            console.error('Error following:', error);
        }
    };

    const handleUnfollow = async (targetUserId: string) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const token = await getToken();
            if (token) {
                await FollowService.unfollow(token, targetUserId);
                // Update local state
                const updateList = (list: FollowUser[]) =>
                    list.map(u => u.id === targetUserId ? { ...u, isFollowing: false } : u);
                setFollowers(updateList);
                setFollowing(updateList);
            }
        } catch (error) {
            console.error('Error unfollowing:', error);
        }
    };

    const handleUserPress = (user: FollowUser) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onClose();
        router.push({
            pathname: '/user/[username]',
            params: { username: user.username }
        });
    };

    const currentList = activeTab === 'followers' ? followers : following;
    const filteredList = searchQuery
        ? currentList.filter(u =>
            u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
            u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
        )
        : currentList;

    const renderUserCard = ({ item }: { item: FollowUser }) => (
        <TouchableOpacity
            style={styles.userCard}
            onPress={() => handleUserPress(item)}
            activeOpacity={0.8}
        >
            <View style={styles.cardLeft}>
                <MiniProfileCard
                    playerImage={item.avatar}
                    countryFlag={item.countryFlag || '🌍'}
                    position={item.position || 'ST'}
                    clubLogo={item.clubLogo}
                />
            </View>
            
            <View style={styles.cardInfo}>
                <View style={styles.nameRow}>
                    <Text style={styles.displayName} numberOfLines={1}>
                        {item.displayName || item.username}
                    </Text>
                    {item.isVerified && <BadgeCheck size={14} color="#22c55e" />}
                    {item.isDeveloper && <Code size={12} color="#3b82f6" />}
                </View>
                <Text style={styles.username}>@{item.username}</Text>
            </View>

            <TouchableOpacity
                style={[styles.followButton, item.isFollowing && styles.followingButton]}
                onPress={() => item.isFollowing ? handleUnfollow(item.id) : handleFollow(item.id)}
            >
                {item.isFollowing ? (
                    <>
                        <UserMinus size={14} color="#888" />
                        <Text style={styles.followingText}>{t.rank.following}</Text>
                    </>
                ) : (
                    <>
                        <UserPlus size={14} color="#fff" />
                        <Text style={styles.followText}>{t.rank.follow}</Text>
                    </>
                )}
            </TouchableOpacity>
        </TouchableOpacity>
    );

    return (
        <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.title}>@{username}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Tabs */}
                    <View style={styles.tabs}>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'followers' && styles.activeTab]}
                            onPress={() => setActiveTab('followers')}
                        >
                            <Text style={[styles.tabText, activeTab === 'followers' && styles.activeTabText]}>
                                {t.profile.followers} ({followers.length})
                            </Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.tab, activeTab === 'following' && styles.activeTab]}
                            onPress={() => setActiveTab('following')}
                        >
                            <Text style={[styles.tabText, activeTab === 'following' && styles.activeTabText]}>
                                {t.profile.following} ({following.length})
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Search */}
                    <View style={styles.searchContainer}>
                        <Search size={18} color="#666" />
                        <TextInput
                            style={styles.searchInput}
                            placeholder={t.search.placeholder}
                            placeholderTextColor="#666"
                            value={searchQuery}
                            onChangeText={setSearchQuery}
                        />
                    </View>

                    {/* List */}
                    {isLoading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={ProfileTheme.colors.neonGreen} />
                        </View>
                    ) : (
                        <FlashList
                            data={filteredList}
                            keyExtractor={item => item.id}
                            renderItem={renderUserCard}
                            contentContainerStyle={styles.listContent}
                            showsVerticalScrollIndicator={false}
                            onEndReached={() => {
                                if (activeTab === 'followers') loadMoreFollowers();
                                else loadMoreFollowing();
                            }}
                            onEndReachedThreshold={0.5}
                            ListFooterComponent={isLoadingMore ? (
                                <View style={{ padding: 16, alignItems: 'center' }}>
                                    <ActivityIndicator size="small" color={ProfileTheme.colors.neonGreen} />
                                </View>
                            ) : null}
                            ListEmptyComponent={
                                <View style={styles.emptyContainer}>
                                    <Text style={styles.emptyText}>
                                        {activeTab === 'followers' 
                                            ? 'لا يوجد متابعين بعد' 
                                            : 'لا يتابع أحد بعد'}
                                    </Text>
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
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.9)',
        justifyContent: 'flex-end',
    },
    container: {
        backgroundColor: ProfileTheme.colors.deepBlack,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: SCREEN_HEIGHT * 0.85,
        paddingTop: 8,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 16,
        fontWeight: '600',
        color: '#fff',
    },
    tabs: {
        flexDirection: 'row',
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
    },
    tab: {
        flex: 1,
        paddingVertical: 14,
        alignItems: 'center',
    },
    activeTab: {
        borderBottomWidth: 2,
        borderBottomColor: ProfileTheme.colors.neonGreen,
    },
    tabText: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
        fontWeight: '600',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.08)',
        borderRadius: 12,
        margin: 16,
        paddingHorizontal: 12,
        gap: 8,
    },
    searchInput: {
        flex: 1,
        height: 44,
        color: '#fff',
        fontSize: 14,
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.05)',
        gap: 12,
    },
    cardLeft: {
        transform: [{ scale: 0.6 }],
        marginLeft: -20,
        marginRight: -20,
    },
    cardInfo: {
        flex: 1,
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    displayName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
        maxWidth: 150,
    },
    username: {
        fontSize: 13,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    followButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        backgroundColor: ProfileTheme.colors.neonGreen,
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
    },
    followingButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
    },
    followText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#000',
    },
    followingText: {
        fontSize: 13,
        fontWeight: '500',
        color: '#888',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingTop: 60,
    },
    emptyText: {
        fontSize: 16,
        color: 'rgba(255,255,255,0.5)',
    },
});
