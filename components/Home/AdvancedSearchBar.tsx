import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  FlatList,
  Image,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { 
  Search, 
  X, 
  Users,
  BadgeCheck,
  Code
} from 'lucide-react-native';
import { useFadeIn, useSlideIn, usePulse } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';
import { useAuth } from '@clerk/clerk-expo';
import { AuthService, SearchUserResult } from '../../src/services/authService';
import { router } from 'expo-router';
import MiniProfileCard from '../profile/MiniProfileCard';

// Simple search cache (5 minutes TTL)
const searchCache = new Map<string, { results: SearchResult[]; timestamp: number }>();
const SEARCH_CACHE_TTL = 5 * 60 * 1000;

export interface SearchResult {
  id: string;
  type: 'profile' | 'video' | 'match' | 'team';
  title: string;
  subtitle: string;
  image?: string;
  data: any;
}

// Helper function to highlight matching text
const HighlightedText: React.FC<{ text: string; highlight: string; style: any; highlightStyle?: any }> = ({ 
  text, 
  highlight, 
  style,
  highlightStyle 
}) => {
  if (!highlight.trim()) {
    return <Text style={style}>{text}</Text>;
  }

  const regex = new RegExp(`(${highlight.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  const parts = text.split(regex);

  return (
    <Text style={style}>
      {parts.map((part, index) => 
        regex.test(part) ? (
          <Text key={index} style={[style, highlightStyle || { backgroundColor: 'rgba(34, 197, 94, 0.3)', color: '#22c55e' }]}>
            {part}
          </Text>
        ) : (
          <Text key={index}>{part}</Text>
        )
      )}
    </Text>
  );
};

interface AdvancedSearchBarProps {
  onResultSelect: (result: SearchResult) => void;
  onClose: () => void;
  visible: boolean;
}

const AdvancedSearchBar: React.FC<AdvancedSearchBarProps> = ({
  onResultSelect,
  onClose,
  visible
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);

  const { getToken } = useAuth();
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(600);
  const slideAnim = useSlideIn('down', 500);
  const pulseAnim = usePulse(1, 1.02, 1000);

  // Debounced search - يبدأ من أول حرف
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    const timeoutId = setTimeout(() => {
      performSearch(searchQuery);
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  const performSearch = async (query: string) => {
    // Check cache first
    const cacheKey = query.toLowerCase();
    const cached = searchCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < SEARCH_CACHE_TTL) {
      setSearchResults(cached.results);
      setIsSearching(false);
      return;
    }

    const results: SearchResult[] = [];
    
    try {
      // البحث في المستخدمين من الـ Backend
      const token = await getToken();
      if (token) {
        const users = await AuthService.searchUsers(token, query, 10);
        users.forEach((user: SearchUserResult) => {
          results.push({
            id: user.id,
            type: 'profile',
            title: user.displayName || user.username,
            subtitle: `@${user.username}${user.favoriteTeam ? ` • ${user.favoriteTeam}` : ''}`,
            image: user.avatar || undefined,
            data: user
          });
        });
      }
    } catch (error) {
      console.error('Search error:', error);
    }

    const finalResults = results.slice(0, 15);
    
    // Save to cache
    searchCache.set(cacheKey, { results: finalResults, timestamp: Date.now() });
    
    setSearchResults(finalResults);
    setIsSearching(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    haptic.search();
  };

  const handleResultSelect = (result: SearchResult) => {
    haptic.cardTap();
    
    // إذا كان النتيجة بروفايل، افتح صفحة البروفايل
    if (result.type === 'profile') {
      onClose();
      router.push({
        pathname: '/user/[username]',
        params: { username: result.data.username }
      });
      return;
    }
    
    onResultSelect(result);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    haptic.light();
  };

  if (!visible) return null;

  return (
    <Animated.View 
      style={[
        styles.container,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.searchContainer}>
          <View style={styles.searchInputContainer}>
            <Search size={20} color="#666" />
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={handleSearch}
              placeholder="ابحث عن اللاعبين، الفيديوهات، المباريات..."
              placeholderTextColor="#666"
              autoFocus
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={handleClear} style={styles.clearButton}>
                <X size={16} color="#666" />
              </TouchableOpacity>
            )}
          </View>
        </View>
        
        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
          <X size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search Results */}
      <View style={styles.resultsContainer}>
        {isSearching ? (
          <Animated.View style={[styles.loadingContainer, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.loadingText}>جاري البحث...</Text>
          </Animated.View>
        ) : searchResults.length > 0 ? (
          <>
            {/* Profiles Grid Section - FIFA Cards */}
            <View style={styles.sectionContainer}>
              <ScrollView 
                horizontal={false} 
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.profilesGrid}
              >
                {searchResults.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={styles.cardItem}
                    onPress={() => handleResultSelect(item)}
                    activeOpacity={0.8}
                  >
                    <MiniProfileCard
                      playerImage={item.image}
                      countryFlag={item.data?.countryFlag || '🇪🇬'}
                      position={item.data?.position || 'RW'}
                      clubLogo={item.data?.clubLogo}
                    />
                    <View style={styles.cardInfo}>
                      <View style={styles.cardNameRow}>
                        <Text style={styles.cardName} numberOfLines={1}>
                          {item.data?.displayName || item.title}
                        </Text>
                        {item.data?.isVerified && (
                          <BadgeCheck size={12} color="#22c55e" />
                        )}
                        {item.data?.isDeveloper && (
                          <Code size={10} color="#3b82f6" />
                        )}
                      </View>
                      <Text style={styles.cardUsername} numberOfLines={1}>
                        @{item.data?.username}
                      </Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </>
        ) : searchQuery.length > 0 ? (
          <View style={styles.noResultsContainer}>
            <Search size={48} color="#666" />
            <Text style={styles.noResultsText}>لا توجد نتائج</Text>
            <Text style={styles.noResultsSubtext}>
              جرب البحث بكلمات مختلفة
            </Text>
          </View>
        ) : (
          <View style={styles.suggestionsContainer}>
            <Text style={styles.suggestionsTitle}>ابحث عن لاعبين</Text>
            <View style={styles.suggestionsList}>
              <TouchableOpacity style={styles.suggestionItem}>
                <Users size={16} color="#22c55e" />
                <Text style={styles.suggestionText}>ابحث باسم المستخدم أو الاسم</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#0a0a0a',
    zIndex: 1000,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  searchContainer: {
    flex: 1,
    marginRight: 15,
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#0a0a0a',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 2,
    borderColor: '#333',
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    marginLeft: 10,
  },
  clearButton: {
    padding: 4,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  closeButton: {
    padding: 8,
    borderRadius: 20,
    backgroundColor: '#333',
  },
  resultsContainer: {
    flex: 1,
    paddingHorizontal: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 40,
  },
  loadingText: {
    color: '#666',
    fontSize: 16,
    marginTop: 10,
  },
  // Section styles
  sectionContainer: {
    marginBottom: 16,
  },
  sectionTitle: {
    color: '#888',
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
    textAlign: 'right',
  },
  // Grid styles for profiles - FIFA Cards
  profilesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 8,
    paddingBottom: 20,
  },
  cardItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardInfo: {
    alignItems: 'center',
    marginTop: 4,
  },
  cardNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardName: {
    color: '#fff',
    fontSize: 12,
    fontWeight: 'bold',
    textAlign: 'center',
    maxWidth: 80,
  },
  cardUsername: {
    color: '#666',
    fontSize: 10,
    textAlign: 'center',
  },
  noResultsContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  noResultsText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginTop: 15,
    marginBottom: 8,
  },
  noResultsSubtext: {
    color: '#666',
    fontSize: 14,
    textAlign: 'center',
  },
  suggestionsContainer: {
    paddingVertical: 20,
  },
  suggestionsTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
  },
  suggestionsList: {
    gap: 10,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 12,
    padding: 15,
    gap: 12,
  },
  suggestionText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
});

export default AdvancedSearchBar;
