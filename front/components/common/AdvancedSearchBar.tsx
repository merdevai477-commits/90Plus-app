import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  ActivityIndicator,
  ScrollView,
  KeyboardAvoidingView,
  Modal,
  Platform,
} from 'react-native';
import { Image } from 'expo-image';
import {
  Search,
  X,
  Users,
  BadgeCheck,
  Code,
  Hash,
  Clock,
  TrendingUp,
  Play,
  ChevronRight,
} from 'lucide-react-native';
import { useFadeIn, useSlideIn } from '../Matches/Animations';
import { useHapticFeedback } from '../Matches/HapticFeedback';
import { useAuth } from '@clerk/clerk-expo';
import { AuthService, SearchUserResult, ReelsService } from '../../src/services/authService';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Haptics from 'expo-haptics';
import { useTranslation } from '../../src/i18n';
import { PURPLE_PRIMARY, PURPLE_SOFT } from '../../constants/tokens';

const AVATAR_PLACEHOLDER = require('../../assets/images/plear 90Plus.jpg');

// Cache for search results (5 minutes TTL)
const searchCache = new Map<string, { results: any; timestamp: number }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000;
const SEARCH_TIMEOUT = 10000; // 10 seconds timeout for search operations

function pruneSearchCache(): void {
  const now = Date.now();
  for (const [key, value] of searchCache.entries()) {
    if (now - value.timestamp > SEARCH_CACHE_TTL) {
      searchCache.delete(key);
    }
  }
}

// Recent searches storage key
const RECENT_SEARCHES_KEY = '@search_recent_searches';
const MAX_RECENT_SEARCHES = 10;

export interface SearchResult {
  id: string;
  type: 'profile' | 'reel' | 'hashtag';
  title: string;
  subtitle: string;
  image?: string;
  data: any;
}

type SearchTab = 'all' | 'users' | 'reels' | 'hashtags';

interface AdvancedSearchBarProps {
  onResultSelect: (result: SearchResult) => void;
  onClose: () => void;
  visible: boolean;
  /** Opens on this tab when the modal becomes visible (default: all). */
  initialTab?: SearchTab;
}

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({
  onResultSelect,
  onClose,
  visible,
  initialTab = 'all',
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<SearchTab>(initialTab);
  const [searchResults, setSearchResults] = useState<{
    users: SearchResult[];
    reels: SearchResult[];
    hashtags: SearchResult[];
  }>({ users: [], reels: [], hashtags: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [trendingHashtags, setTrendingHashtags] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);

  const { getToken } = useAuth();
  const { t } = useTranslation();
  const tSearch = t.searchModal;
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(300);
  const slideAnim = useSlideIn('down', 300);
  const searchInputRef = useRef<TextInput>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Load recent searches from AsyncStorage
  const loadRecentSearches = useCallback(async () => {
    try {
      const stored = await AsyncStorage.getItem(RECENT_SEARCHES_KEY);
      if (stored) {
        setRecentSearches(JSON.parse(stored));
      }
    } catch (error) {
      console.error('Error loading recent searches:', error);
    }
  }, []);

  // Save search to recent searches - FIXED: use functional update to avoid dependency
  const saveToRecentSearches = useCallback(async (query: string) => {
    if (!query.trim()) return;
    
    try {
      const trimmed = query.trim().toLowerCase();
      setRecentSearches(prev => {
        const updated = [trimmed, ...prev.filter(s => s !== trimmed)].slice(0, MAX_RECENT_SEARCHES);
        AsyncStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated)).catch(() => {});
        return updated;
      });
    } catch (error) {
      console.error('Error saving recent search:', error);
    }
  }, []);

  // Load trending hashtags
  const loadTrendingHashtags = useCallback(async () => {
    try {
      const hashtags = await AuthService.getTrendingHashtags();
      setTrendingHashtags(hashtags);
    } catch (error) {
      console.error('Error loading trending hashtags:', error);
    }
  }, []);

  // Load recent searches and trending hashtags on mount - FIXED: removed function deps
  const hasLoadedRef = useRef(false);
  const loadRecentSearchesRef = useRef(loadRecentSearches);
  const loadTrendingHashtagsRef = useRef(loadTrendingHashtags);
  
  loadRecentSearchesRef.current = loadRecentSearches;
  loadTrendingHashtagsRef.current = loadTrendingHashtags;
  
  useEffect(() => {
    if (!visible) return;
    const pruneTimer = setInterval(pruneSearchCache, 60_000);
    return () => clearInterval(pruneTimer);
  }, [visible]);

  useEffect(() => {
    if (visible && !hasLoadedRef.current) {
      hasLoadedRef.current = true;
      setActiveTab(initialTab);
      loadRecentSearchesRef.current();
      loadTrendingHashtagsRef.current();
      // Auto-focus search input
      setTimeout(() => searchInputRef.current?.focus(), 100);
    } else if (!visible) {
      hasLoadedRef.current = false;
      // Reset search when closing
      setSearchQuery('');
      setSearchResults({ users: [], reels: [], hashtags: [] });
    }
  }, [visible, initialTab]); // Only depend on visible / opening tab

  // Generate suggestions based on query
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSuggestions([]);
      return;
    }

    const query = searchQuery.toLowerCase().trim();
    const newSuggestions: string[] = [];

    // Add matching recent searches
    recentSearches.forEach(search => {
      if (search.includes(query) && !newSuggestions.includes(search)) {
        newSuggestions.push(search);
      }
    });

    // Add matching trending hashtags
    trendingHashtags.forEach(hashtag => {
      if (hashtag.name.includes(query) && !newSuggestions.includes(`#${hashtag.name}`)) {
        newSuggestions.push(`#${hashtag.name}`);
      }
    });

    setSuggestions(newSuggestions.slice(0, 5));
  }, [searchQuery, recentSearches, trendingHashtags]);
    
  // Parallel search with caching and abort support - FIXED: removed saveToRecentSearches from deps
  const performSearchRef = useRef<((query: string, tab: SearchTab) => Promise<void>) | null>(null);
  
  performSearchRef.current = useCallback(async (query: string, tab: SearchTab) => {
    // Cancel previous request
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    abortControllerRef.current = new AbortController();

    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) {
      setSearchResults({ users: [], reels: [], hashtags: [] });
      setIsSearching(false);
      return;
    }

    const cacheKey = `${normalizedQuery}_${tab}`;
    
    // Check cache first
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      setSearchResults(cached.results);
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    
    try {
      const token = await getToken();
      if (!token) {
        setIsSearching(false);
        return;
      }

      // Parallel search based on tab - OPTIMIZED
      const promises: Promise<any>[] = [];

      if (tab === 'all' || tab === 'users') {
        promises.push(
          Promise.race([
            AuthService.searchUsers(token, query, 10).catch(() => []),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('User search timeout')), SEARCH_TIMEOUT)
            )
          ])
        );
      } else {
        promises.push(Promise.resolve([]));
      }

      if (tab === 'all' || tab === 'reels' || tab === 'hashtags') {
        const searchType = tab === 'hashtags' ? 'hashtags' : tab === 'reels' ? 'reels' : 'all';
        promises.push(
          Promise.race([
            ReelsService.searchReels(token, query, 10, searchType).catch(() => ({ reels: [], hashtags: [] })),
            new Promise((_, reject) => 
              setTimeout(() => reject(new Error('Reels search timeout')), SEARCH_TIMEOUT)
            )
          ])
        );
      } else {
        promises.push(Promise.resolve({ reels: [], hashtags: [] }));
      }

      const [users, reelsData] = await Promise.all(promises);

      // Format results with null safety - FIXED: ensure arrays are always defined
      const formattedUsers: SearchResult[] = Array.isArray(users) ? users.map((user: SearchUserResult) => ({
            id: user.id,
            type: 'profile',
            title: user.displayName || user.username,
            subtitle: `@${user.username}${user.favoriteTeam ? ` • ${user.favoriteTeam}` : ''}`,
            image: user.avatar || undefined,
            data: user
      })) : [];

      const formattedReels: SearchResult[] = Array.isArray(reelsData?.reels) ? reelsData.reels.map((reel: any) => ({
        id: reel.id,
        type: 'reel',
        title: reel.caption || 'Video',
        subtitle: `@${reel.user?.username || 'user'} • ${(reel.views || 0).toLocaleString()} views`,
        image: reel.thumbnail,
        data: reel
      })) : [];

      const formattedHashtags: SearchResult[] = Array.isArray(reelsData?.hashtags) ? reelsData.hashtags.map((hashtag: any) => ({
        id: hashtag.id,
        type: 'hashtag',
        title: `#${hashtag.name}`,
        subtitle: `${(hashtag.reelCount || 0).toLocaleString()} videos`,
        data: hashtag
      })) : [];

      const results = {
        users: formattedUsers,
        reels: formattedReels,
        hashtags: formattedHashtags
      };

      // Cache results
      searchCache.set(cacheKey, { results, timestamp: Date.now() });

      // Limit cache size
      if (searchCache.size > 50) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) searchCache.delete(firstKey);
      }

      setSearchResults(results);
      setIsSearching(false);

      // Save to recent searches (non-blocking, no dependency)
      if (query.trim()) {
        saveToRecentSearches(query);
      }
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        console.error('Search error:', error);
        setIsSearching(false);
        
        // Show user-friendly error message
        if (error.message.includes('timeout') || error.message.includes('network')) {
          // Could add a toast notification here
          console.warn('Search timeout - please check your connection');
        }
      }
    }
  }, [getToken]); // Removed saveToRecentSearches to prevent loop
    
  // Debounced search - OPTIMIZED: faster debounce + immediate cache lookup
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults({ users: [], reels: [], hashtags: [] });
      setIsSearching(false);
      return;
    }

    setIsSearching(true);
    const normalizedQuery = searchQuery.trim().toLowerCase();
    const cacheKey = `${normalizedQuery}_${activeTab}`;
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      setSearchResults(cached.results);
    setIsSearching(false);
      return;
    }

    // Debounce for API calls only
    const timeoutId = setTimeout(() => {
      if (performSearchRef.current) {
        performSearchRef.current(searchQuery, activeTab);
      }
    }, 300); // Slightly slower debounce for better UX and reduced API calls

    return () => {
      clearTimeout(timeoutId);
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, [searchQuery, activeTab]); // Removed performSearch from dependencies

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    haptic.search();
  };

  const handleResultSelect = (result: SearchResult) => {
    haptic.cardTap();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    
    // Save to recent searches
    if (result.type === 'hashtag') {
      saveToRecentSearches(result.data.name);
    } else if (result.type === 'profile') {
      saveToRecentSearches(result.data.username);
    } else {
      saveToRecentSearches(result.title);
    }

    // Navigate based on type
    if (result.type === 'profile') {
      onClose();
      router.push({
        pathname: '/user/[username]',
        params: { username: result.data.username }
      });
    } else if (result.type === 'reel') {
      onClose();
      router.push({
        pathname: '/(tabs)/reels',
        params: { reelId: result.id }
      });
    } else if (result.type === 'hashtag') {
      onClose();
      router.push({
        pathname: '/(tabs)/reels',
        params: { hashtag: result.data.name }
      });
    } else {
    onResultSelect(result);
    }
  };

  const handleSuggestionSelect = (suggestion: string) => {
    const cleanSuggestion = suggestion.replace(/^#/, '');
    setSearchQuery(cleanSuggestion);
    haptic.selection();
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults({ users: [], reels: [], hashtags: [] });
    haptic.light();
  };

  const handleClearRecent = async () => {
    try {
      await AsyncStorage.removeItem(RECENT_SEARCHES_KEY);
      setRecentSearches([]);
      haptic.light();
    } catch (error) {
      console.error('Error clearing recent searches:', error);
    }
  };

  // Get filtered results based on active tab
  const filteredResults = useMemo(() => {
    if (activeTab === 'users') return searchResults.users;
    if (activeTab === 'reels') return searchResults.reels;
    if (activeTab === 'hashtags') return searchResults.hashtags;
    return [...searchResults.users, ...searchResults.reels, ...searchResults.hashtags];
  }, [activeTab, searchResults]);

  const hasResults = filteredResults.length > 0;
  const showSuggestions = searchQuery.length > 0 && suggestions.length > 0 && !hasResults && !isSearching;
  const showRecentSearches = searchQuery.length === 0 && recentSearches.length > 0;
  const showTrending = searchQuery.length === 0 && trendingHashtags.length > 0;

  if (!visible) return null;

  const tabLabel = (tab: SearchTab) => {
    if (tab === 'all') return tSearch.tabAll;
    if (tab === 'users') return tSearch.tabUsers;
    if (tab === 'reels') return tSearch.tabReels;
    return tSearch.tabHashtags;
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      presentationStyle="overFullScreen"
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        style={styles.keyboardRoot}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <Animated.View
          style={[
            styles.container,
            {
              opacity: fadeAnim,
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <BlurView intensity={90} tint="dark" style={StyleSheet.absoluteFill} />
          <LinearGradient
            colors={['rgba(8,4,18,0.98)', 'rgba(5,1,13,0.98)']}
            style={StyleSheet.absoluteFill}
          />

          <View style={styles.header}>
            <View style={styles.searchContainer}>
              <View style={styles.searchInputContainer}>
                <Search size={20} color={PURPLE_PRIMARY} />
                <TextInput
                  ref={searchInputRef}
                  style={styles.searchInput}
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder={tSearch.placeholder}
                  placeholderTextColor="#666"
                  autoFocus
                  autoCorrect={false}
                  autoCapitalize="none"
                  returnKeyType="search"
                />
                {searchQuery.length > 0 && (
                  <TouchableOpacity onPress={handleClear} style={styles.clearButton} hitSlop={8}>
                    <X size={16} color="#666" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeButton} hitSlop={8}>
              <X size={22} color="#fff" />
            </TouchableOpacity>
          </View>

          {searchQuery.length > 0 && (
            <View style={styles.tabsContainer}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsScroll}>
                {(['all', 'users', 'reels', 'hashtags'] as SearchTab[]).map((tab) => (
                  <TouchableOpacity
                    key={tab}
                    style={[styles.tab, activeTab === tab && styles.tabActive]}
                    onPress={() => {
                      setActiveTab(tab);
                      haptic.selection();
                    }}
                    activeOpacity={0.7}
                  >
                    <LinearGradient
                      colors={
                        activeTab === tab
                          ? [PURPLE_PRIMARY, PURPLE_SOFT]
                          : ['transparent', 'transparent']
                      }
                      style={styles.tabGradient}
                    >
                      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
                        {tabLabel(tab)}
                      </Text>
                    </LinearGradient>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          <ScrollView
            style={styles.content}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {isSearching && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={PURPLE_PRIMARY} />
                <Text style={styles.loadingText}>{tSearch.searching}</Text>
              </View>
            )}

            {showSuggestions && (
              <View style={styles.suggestionsContainer}>
                {suggestions.map((suggestion, index) => (
                  <TouchableOpacity
                    key={`${suggestion}-${index}`}
                    style={styles.suggestionItem}
                    onPress={() => handleSuggestionSelect(suggestion)}
                    activeOpacity={0.7}
                  >
                    <Search size={16} color={PURPLE_PRIMARY} />
                    <Text style={styles.suggestionText}>{suggestion}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!isSearching && hasResults && (
              <View style={styles.resultsContainer}>
                {filteredResults.map((item) => (
                  <TouchableOpacity
                    key={`${item.type}-${item.id}`}
                    style={styles.resultItem}
                    onPress={() => handleResultSelect(item)}
                    activeOpacity={0.75}
                  >
                    {item.type === 'profile' ? (
                      <View style={styles.profileResult}>
                        <Image
                          source={item.image ? { uri: item.image } : AVATAR_PLACEHOLDER}
                          style={styles.avatar}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                          transition={120}
                        />
                        <View style={styles.profileInfo}>
                          <View style={styles.profileHeader}>
                            <Text style={styles.profileName} numberOfLines={1}>
                              {item.title}
                            </Text>
                            {item.data?.isVerified ? <BadgeCheck size={14} color={PURPLE_PRIMARY} /> : null}
                            {item.data?.isDeveloper ? <Code size={12} color="#3b82f6" /> : null}
                          </View>
                          <Text style={styles.profileUsername} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                        </View>
                        <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                      </View>
                    ) : item.type === 'reel' ? (
                      <View style={styles.reelResult}>
                        <Image
                          source={{ uri: item.image }}
                          style={styles.reelThumbnail}
                          contentFit="cover"
                          cachePolicy="memory-disk"
                        />
                        <View style={styles.reelInfo}>
                          <Text style={styles.reelTitle} numberOfLines={2}>
                            {item.title}
                          </Text>
                          <Text style={styles.reelSubtitle} numberOfLines={1}>
                            {item.subtitle}
                          </Text>
                        </View>
                        <Play size={18} color={PURPLE_PRIMARY} />
                      </View>
                    ) : (
                      <View style={styles.hashtagResult}>
                        <View style={styles.hashtagIcon}>
                          <Hash size={18} color={PURPLE_PRIMARY} />
                        </View>
                        <View style={styles.hashtagInfo}>
                          <Text style={styles.hashtagTitle}>{item.title}</Text>
                          <Text style={styles.hashtagSubtitle}>{item.subtitle}</Text>
                        </View>
                        <ChevronRight size={18} color="rgba(255,255,255,0.35)" />
                      </View>
                    )}
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {!isSearching && searchQuery.length > 0 && !hasResults && !showSuggestions && (
              <View style={styles.noResultsContainer}>
                <Search size={40} color="#555" />
                <Text style={styles.noResultsText}>{tSearch.noResults}</Text>
              </View>
            )}

            {showRecentSearches && (
              <View style={styles.recentContainer}>
                <View style={styles.recentHeader}>
                  <Text style={styles.recentTitle}>{tSearch.recentSearches}</Text>
                  <TouchableOpacity onPress={handleClearRecent}>
                    <Text style={styles.clearRecentText}>{tSearch.clear}</Text>
                  </TouchableOpacity>
                </View>
                {recentSearches.map((search, index) => (
                  <TouchableOpacity
                    key={`${search}-${index}`}
                    style={styles.recentItem}
                    onPress={() => handleSuggestionSelect(search)}
                    activeOpacity={0.7}
                  >
                    <Clock size={16} color="#666" />
                    <Text style={styles.recentText}>{search}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}

            {showTrending && (
              <View style={styles.trendingContainer}>
                <View style={styles.trendingHeader}>
                  <TrendingUp size={18} color={PURPLE_PRIMARY} />
                  <Text style={styles.trendingTitle}>{tSearch.trending}</Text>
                </View>
                <View style={styles.trendingGrid}>
                  {trendingHashtags.slice(0, 10).map((hashtag) => (
                    <TouchableOpacity
                      key={hashtag.id}
                      style={styles.trendingItem}
                      onPress={() => handleSuggestionSelect(`#${hashtag.name}`)}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.trendingText}>#{hashtag.name}</Text>
                      <Text style={styles.trendingCount}>{hashtag.reelCount}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {!isSearching && searchQuery.length === 0 && !showRecentSearches && !showTrending && (
              <View style={styles.emptyContainer}>
                <Users size={44} color="#555" />
                <Text style={styles.emptyText}>{tSearch.tabUsers}</Text>
                <Text style={styles.emptySubtext}>{tSearch.placeholder}</Text>
              </View>
            )}
          </ScrollView>
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  keyboardRoot: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 56,
    paddingBottom: 12,
    gap: 10,
  },
  searchContainer: {
    flex: 1,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 11,
    borderWidth: 1,
    borderColor: 'rgba(168,85,247,0.35)',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
    paddingVertical: 0,
  },
  clearButton: {
    padding: 4,
  },
  closeButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  tabsContainer: {
    paddingHorizontal: 16,
    paddingBottom: 10,
  },
  tabsScroll: {
    gap: 8,
  },
  tab: {
    borderRadius: 20,
    marginRight: 8,
    overflow: 'hidden',
  },
  tabActive: {},
  tabGradient: {
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  tabText: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
  },
  tabTextActive: {
    color: '#0a0a0a',
    fontWeight: '800',
  },
  content: {
    flex: 1,
    paddingHorizontal: 16,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#888',
    fontSize: 14,
    marginTop: 10,
  },
  suggestionsContainer: {
    paddingVertical: 8,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
  },
  resultsContainer: {
    paddingVertical: 4,
    paddingBottom: 24,
  },
  resultItem: {
    marginBottom: 8,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  profileResult: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  profileInfo: {
    flex: 1,
    minWidth: 0,
  },
  profileHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 2,
  },
  profileName: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
    flexShrink: 1,
  },
  profileUsername: {
    color: '#999',
    fontSize: 13,
  },
  reelResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    gap: 12,
  },
  reelThumbnail: {
    width: 56,
    height: 56,
    borderRadius: 10,
    backgroundColor: '#333',
  },
  reelInfo: {
    flex: 1,
    minWidth: 0,
  },
  reelTitle: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 3,
  },
  reelSubtitle: {
    color: '#888',
    fontSize: 12,
  },
  hashtagResult: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  hashtagIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(168,85,247,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hashtagInfo: {
    flex: 1,
  },
  hashtagTitle: {
    color: PURPLE_PRIMARY,
    fontSize: 15,
    fontWeight: '700',
    marginBottom: 2,
  },
  hashtagSubtitle: {
    color: '#888',
    fontSize: 12,
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    marginTop: 14,
  },
  recentContainer: {
    paddingVertical: 12,
  },
  recentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  recentTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  clearRecentText: {
    color: PURPLE_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
  },
  recentItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  recentText: {
    color: '#fff',
    fontSize: 14,
  },
  trendingContainer: {
    paddingVertical: 12,
  },
  trendingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  trendingTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  trendingGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  trendingItem: {
    backgroundColor: 'rgba(168,85,247,0.12)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  trendingText: {
    color: PURPLE_PRIMARY,
    fontSize: 13,
    fontWeight: '600',
  },
  trendingCount: {
    color: '#888',
    fontSize: 12,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  emptyText: {
    color: '#fff',
    fontSize: 17,
    fontWeight: '700',
    marginTop: 14,
    marginBottom: 6,
  },
  emptySubtext: {
    color: '#666',
    fontSize: 13,
    textAlign: 'center',
  },
});

export default AdvancedSearchBar;
