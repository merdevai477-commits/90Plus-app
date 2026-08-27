import React, { useState, useEffect, useCallback, memo } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  TextInput,
  Pressable,
} from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useAuth } from '@clerk/clerk-expo';
import { FollowService } from '../../src/services/authService';
import { router } from 'expo-router';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';
import { logger } from '../../utils/logger';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');
const PURPLE = ProfileTheme.colors.profilePrimary;
const RING = ProfileTheme.colors.avatarRing;

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

function isAutoUsername(username?: string) {
  if (!username) return true;
  return /^user[_-]/i.test(username.trim());
}

const UserRow = memo(function UserRow({
  item,
  onPress,
  onFollowToggle,
  followLabel,
  followingLabel,
}: {
  item: FollowUser;
  onPress: () => void;
  onFollowToggle: () => void;
  followLabel: string;
  followingLabel: string;
}) {
  const name = item.displayName?.trim() || item.username;
  const showHandle = !isAutoUsername(item.username);
  const metaParts = [
    item.position,
    item.countryFlag,
  ].filter(Boolean) as string[];

  return (
    <TouchableOpacity style={styles.userCard} onPress={onPress} activeOpacity={0.82}>
      <View style={styles.avatarWrap}>
        <LinearGradient
          colors={['#D8AEFF', '#8B5CF6', '#460BCB']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.avatarRing}
        >
          <View style={styles.avatarInner}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} contentFit="cover" />
            ) : (
              <View style={styles.avatarFallback}>
                <Ionicons name="person" size={22} color={RING} />
              </View>
            )}
          </View>
        </LinearGradient>
        {item.clubLogo ? (
          <View style={styles.clubBadge}>
            <Image source={{ uri: item.clubLogo }} style={styles.clubLogo} contentFit="contain" />
          </View>
        ) : null}
      </View>

      <View style={styles.cardInfo}>
        <View style={styles.nameRow}>
          <Text style={styles.displayName} numberOfLines={1}>
            {name}
          </Text>
          {item.isVerified ? (
            <View style={styles.verifiedDot}>
              <Ionicons name="checkmark" size={10} color="#fff" />
            </View>
          ) : null}
          {item.isDeveloper ? (
            <View style={styles.devDot}>
              <Ionicons name="code-slash" size={9} color="#fff" />
            </View>
          ) : null}
        </View>

        {showHandle ? (
          <Text style={styles.username} numberOfLines={1}>
            @{item.username}
          </Text>
        ) : metaParts.length > 0 ? (
          <Text style={styles.metaLine} numberOfLines={1}>
            {metaParts.join('  ·  ')}
          </Text>
        ) : null}
      </View>

      <TouchableOpacity
        style={[styles.followHit, item.isFollowing && styles.followingHit]}
        onPress={onFollowToggle}
        activeOpacity={0.85}
        hitSlop={6}
      >
        {item.isFollowing ? (
          <Text style={styles.followingText}>{followingLabel}</Text>
        ) : (
          <LinearGradient
            colors={['#8B5CF6', '#5B21B6']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.followGradient}
          >
            <Ionicons name="person-add" size={13} color="#fff" />
            <Text style={styles.followText}>{followLabel}</Text>
          </LinearGradient>
        )}
      </TouchableOpacity>
    </TouchableOpacity>
  );
});

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
  const insets = useSafeAreaInsets();

  const PAGE_SIZE = 30;

  useEffect(() => {
    if (visible && !userId) {
      onClose();
      return;
    }
    if (visible && userId) {
      setActiveTab(initialTab);
      setSearchQuery('');
      setFollowers([]);
      setFollowing([]);
      setFollowersPage(0);
      setFollowingPage(0);
      setHasMoreFollowers(true);
      setHasMoreFollowing(true);
      loadData(initialTab);
    }
  }, [visible, initialTab, userId]);

  const loadFollowers = async () => {
    if (!userId) return;
    const token = await getToken();
    if (!token) return;
    const followersData = await FollowService.getFollowers(token, userId, PAGE_SIZE, 0);
    setFollowers(followersData || []);
    setFollowersPage(1);
    setHasMoreFollowers((followersData || []).length >= PAGE_SIZE);
  };

  const loadFollowing = async () => {
    if (!userId) return;
    const token = await getToken();
    if (!token) return;
    const followingData = await FollowService.getFollowing(token, userId, PAGE_SIZE, 0);
    setFollowing(followingData || []);
    setFollowingPage(1);
    setHasMoreFollowing((followingData || []).length >= PAGE_SIZE);
  };

  const loadData = async (tab: 'followers' | 'following' = initialTab) => {
    setIsLoading(true);
    try {
      if (tab === 'followers') {
        await loadFollowers();
      } else {
        await loadFollowing();
      }
    } catch (error) {
      logger.error('Error loading follow data:', error);
    }
    setIsLoading(false);
  };

  const handleTabChange = (tab: 'followers' | 'following') => {
    setActiveTab(tab);
    if (tab === 'followers' && followers.length === 0) {
      void loadFollowers();
    } else if (tab === 'following' && following.length === 0) {
      void loadFollowing();
    }
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
          setFollowers((prev) => [...prev, ...moreData]);
          setFollowersPage((prev) => prev + 1);
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
          setFollowing((prev) => [...prev, ...moreData]);
          setFollowingPage((prev) => prev + 1);
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
        const updateList = (list: FollowUser[]) =>
          list.map((u) => (u.id === targetUserId ? { ...u, isFollowing: true } : u));
        setFollowers(updateList);
        setFollowing(updateList);
      }
    } catch (error) {
      logger.error('Error following:', error);
    }
  };

  const handleUnfollow = async (targetUserId: string) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    try {
      const token = await getToken();
      if (token) {
        await FollowService.unfollow(token, targetUserId);
        const updateList = (list: FollowUser[]) =>
          list.map((u) => (u.id === targetUserId ? { ...u, isFollowing: false } : u));
        setFollowers(updateList);
        setFollowing(updateList);
      }
    } catch (error) {
      logger.error('Error unfollowing:', error);
    }
  };

  const handleUserPress = (user: FollowUser) => {
    if (!user?.username) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
    router.push({
      pathname: '/user/[username]',
      params: { username: user.username },
    });
  };

  const currentList = activeTab === 'followers' ? followers : following;
  const filteredList = searchQuery
    ? currentList.filter((u) => {
        if (!u) return false;
        const q = searchQuery.toLowerCase();
        return (
          (u.username || '').toLowerCase().includes(q) ||
          (u.displayName || '').toLowerCase().includes(q)
        );
      })
    : currentList;

  const headerTitle = username
    ? isAutoUsername(username)
      ? username
      : `@${username.replace(/^@/, '')}`
    : '';

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.container, { paddingBottom: Math.max(insets.bottom, 12) }]}>
          <LinearGradient
            colors={['#1A0B33', '#0B0614', '#030303']}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.handle} />

          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.closeButton} activeOpacity={0.8}>
              <Ionicons name="close" size={20} color="#fff" />
            </TouchableOpacity>
            <Text style={styles.title} numberOfLines={1}>
              {headerTitle}
            </Text>
            <View style={styles.headerSpacer} />
          </View>

          <View style={styles.tabs}>
            {(['followers', 'following'] as const).map((tab) => {
              const active = activeTab === tab;
              const count = tab === 'followers' ? followers.length : following.length;
              const label = tab === 'followers' ? t.profile.followers : t.profile.following;
              return (
                <TouchableOpacity
                  key={tab}
                  style={styles.tab}
                  onPress={() => handleTabChange(tab)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.tabText, active && styles.activeTabText]}>
                    {label} ({count})
                  </Text>
                  {active ? <View style={styles.tabUnderline} /> : null}
                </TouchableOpacity>
              );
            })}
          </View>

          <View style={styles.searchContainer}>
            <Ionicons name="search" size={16} color={ProfileTheme.colors.profileMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t.profile.searchFollowersPlaceholder}
              placeholderTextColor={ProfileTheme.colors.profileHandle}
              value={searchQuery}
              onChangeText={setSearchQuery}
              autoCorrect={false}
              autoCapitalize="none"
            />
            {searchQuery.length > 0 ? (
              <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
                <Ionicons name="close-circle" size={16} color={ProfileTheme.colors.profileMuted} />
              </TouchableOpacity>
            ) : null}
          </View>

          {isLoading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="large" color={PURPLE} />
            </View>
          ) : (
            <FlashList
              data={filteredList}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <UserRow
                  item={item}
                  onPress={() => handleUserPress(item)}
                  onFollowToggle={() =>
                    item.isFollowing ? handleUnfollow(item.id) : handleFollow(item.id)
                  }
                  followLabel={t.rank.follow}
                  followingLabel={t.rank.following}
                />
              )}
              contentContainerStyle={styles.listContent}
              showsVerticalScrollIndicator={false}
              onEndReached={() => {
                if (activeTab === 'followers') loadMoreFollowers();
                else loadMoreFollowing();
              }}
              onEndReachedThreshold={0.5}
              ListFooterComponent={
                isLoadingMore ? (
                  <View style={styles.footerLoader}>
                    <ActivityIndicator size="small" color={PURPLE} />
                  </View>
                ) : null
              }
              ListEmptyComponent={
                <View style={styles.emptyContainer}>
                  <View style={styles.emptyIcon}>
                    <Ionicons name="people-outline" size={28} color={RING} />
                  </View>
                  <Text style={styles.emptyText}>
                    {activeTab === 'followers'
                      ? t.profile.noFollowersYet
                      : t.profile.noFollowingYet}
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
    backgroundColor: 'rgba(0,0,0,0.72)',
    justifyContent: 'flex-end',
  },
  container: {
    height: SCREEN_HEIGHT * 0.86,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    backgroundColor: ProfileTheme.colors.profileBg,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(216,174,255,0.35)',
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  closeButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    paddingHorizontal: 8,
  },
  headerSpacer: { width: 36 },
  tabs: {
    flexDirection: 'row',
    marginHorizontal: 16,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontSize: 14,
    color: ProfileTheme.colors.profileMuted,
    fontWeight: '500',
  },
  activeTabText: {
    color: '#fff',
    fontWeight: '700',
  },
  tabUnderline: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 0,
    height: 2.5,
    borderRadius: 2,
    backgroundColor: PURPLE,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,7,28,0.92)',
    borderRadius: 14,
    marginHorizontal: 16,
    marginTop: 14,
    marginBottom: 8,
    paddingHorizontal: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: ProfileTheme.colors.profileCardBorder,
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
    paddingHorizontal: 14,
    paddingTop: 6,
    paddingBottom: 40,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 10,
    marginBottom: 8,
    gap: 12,
    borderRadius: 16,
    backgroundColor: 'rgba(14,7,28,0.72)',
    borderWidth: 1,
    borderColor: 'rgba(37,10,63,0.9)',
  },
  avatarWrap: {
    width: 52,
    height: 52,
    position: 'relative',
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    padding: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarInner: {
    width: '100%',
    height: '100%',
    borderRadius: 24,
    overflow: 'hidden',
    backgroundColor: '#12081F',
  },
  avatar: {
    width: '100%',
    height: '100%',
  },
  avatarFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#170D2B',
  },
  clubBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#0B0614',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.45)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  clubLogo: {
    width: 14,
    height: 14,
  },
  cardInfo: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  displayName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#fff',
    flexShrink: 1,
  },
  verifiedDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#1877F2',
    alignItems: 'center',
    justifyContent: 'center',
  },
  devDot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: PURPLE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  username: {
    fontSize: 12,
    color: ProfileTheme.colors.profileHandle,
    fontWeight: '500',
  },
  metaLine: {
    fontSize: 12,
    color: ProfileTheme.colors.profileMuted,
    fontWeight: '500',
  },
  followHit: {
    borderRadius: 20,
    overflow: 'hidden',
  },
  followGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 20,
  },
  followingHit: {
    backgroundColor: '#26095C',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  followText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#fff',
  },
  followingText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#BABABA',
  },
  footerLoader: {
    padding: 16,
    alignItems: 'center',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 72,
    gap: 12,
  },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(139,92,246,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.28)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 15,
    color: ProfileTheme.colors.profileMuted,
    fontWeight: '500',
  },
});
