import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Dimensions,
  FlatList,
  Image,
} from 'react-native';
import { 
  Search, 
  X, 
  Filter, 
  Users,
  Video,
  Trophy,
  Star,
  TrendingUp
} from 'lucide-react-native';
import { useFadeIn, useSlideIn, usePulse } from '../leagues/Animations';
import { useHapticFeedback } from '../leagues/HapticFeedback';
import { allProfiles, searchProfiles } from '../Profile/MockProfiles';
import { globalState } from '../../globalState';

const { width } = Dimensions.get('window');

export interface SearchResult {
  id: string;
  type: 'profile' | 'video' | 'match' | 'team';
  title: string;
  subtitle: string;
  image?: string;
  data: any;
}

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
  const [activeFilter, setActiveFilter] = useState<'all' | 'profiles' | 'videos' | 'matches'>('all');

  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(600);
  const slideAnim = useSlideIn('down', 500);
  const pulseAnim = usePulse(1, 1.02, 1000);

  useEffect(() => {
    if (searchQuery.length > 0) {
      setIsSearching(true);
      const results = performSearch(searchQuery);
      setSearchResults(results);
      setTimeout(() => setIsSearching(false), 500);
    } else {
      setSearchResults([]);
    }
  }, [searchQuery]);

  const performSearch = (query: string): SearchResult[] => {
    const results: SearchResult[] = [];
    
    // البحث في البروفايلات مع إضافة البروفايل المرتبط بالحساب
    if (activeFilter === 'all' || activeFilter === 'profiles') {
      let profiles = searchProfiles(query);
      
      // إضافة البروفايل المرتبط بالحساب إذا كان متوفراً
      if (globalState.userProfile) {
        const userProfile = globalState.userProfile as any;
        if (userProfile.displayName.toLowerCase().includes(query.toLowerCase()) || 
            userProfile.username.toLowerCase().includes(query.toLowerCase())) {
          profiles = [userProfile, ...profiles];
        }
      }
      
      profiles.forEach(profile => {
        results.push({
          id: profile.id,
          type: 'profile',
          title: profile.displayName,
          subtitle: `@${profile.username} • ${profile.favoriteClub.name}`,
          image: profile.avatar,
          data: profile
        });
      });
    }

    // البحث في الفيديوهات (بيانات تجريبية)
    if (activeFilter === 'all' || activeFilter === 'videos') {
      const mockVideos = [
        {
          id: 'video1',
          title: 'تحليل مباراة الأهلي والزمالك',
          subtitle: 'فيديو تحليلي • 15.6K مشاهدة',
          image: 'https://images.unsplash.com/photo-1574629810360-7efbbe195018?w=100&h=100&fit=crop'
        },
        {
          id: 'video2',
          title: 'توقعات مباريات هذا الأسبوع',
          subtitle: 'توقعات شخصية • 8.9K مشاهدة',
          image: 'https://images.unsplash.com/photo-1431324155629-1a6deb1dec8d?w=100&h=100&fit=crop'
        }
      ];

      mockVideos.forEach(video => {
        if (video.title.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: video.id,
            type: 'video',
            title: video.title,
            subtitle: video.subtitle,
            image: video.image,
            data: video
          });
        }
      });
    }

    // البحث في المباريات (بيانات تجريبية)
    if (activeFilter === 'all' || activeFilter === 'matches') {
      const mockMatches = [
        {
          id: 'match1',
          title: 'الأهلي vs الزمالك',
          subtitle: 'الكلاسيكو المصري • اليوم 22:00',
          image: 'https://upload.wikimedia.org/wikipedia/ar/9/9e/Al_Ahly_SC_logo.png'
        },
        {
          id: 'match2',
          title: 'ريال مدريد vs برشلونة',
          subtitle: 'الكلاسيكو الإسباني • غداً 21:00',
          image: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg'
        }
      ];

      mockMatches.forEach(match => {
        if (match.title.toLowerCase().includes(query.toLowerCase())) {
          results.push({
            id: match.id,
            type: 'match',
            title: match.title,
            subtitle: match.subtitle,
            image: match.image,
            data: match
          });
        }
      });
    }

    return results.slice(0, 10); // حد أقصى 10 نتائج
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    haptic.search();
  };

  const handleFilterChange = (filter: 'all' | 'profiles' | 'videos' | 'matches') => {
    setActiveFilter(filter);
    haptic.filter();
  };

  const handleResultSelect = (result: SearchResult) => {
    haptic.cardTap();
    onResultSelect(result);
  };

  const handleClear = () => {
    setSearchQuery('');
    setSearchResults([]);
    haptic.light();
  };

  const getResultIcon = (type: string) => {
    switch (type) {
      case 'profile': return <Users size={16} color="#22c55e" />;
      case 'video': return <Video size={16} color="#3b82f6" />;
      case 'match': return <Trophy size={16} color="#f59e0b" />;
      case 'team': return <Star size={16} color="#8b5cf6" />;
      default: return <Search size={16} color="#666" />;
    }
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

      {/* Filters */}
      <View style={styles.filtersContainer}>
        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'all' && styles.activeFilter]}
          onPress={() => handleFilterChange('all')}
        >
          <TrendingUp size={16} color={activeFilter === 'all' ? '#fff' : '#666'} />
          <Text style={[styles.filterText, activeFilter === 'all' && styles.activeFilterText]}>
            الكل
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'profiles' && styles.activeFilter]}
          onPress={() => handleFilterChange('profiles')}
        >
          <Users size={16} color={activeFilter === 'profiles' ? '#fff' : '#666'} />
          <Text style={[styles.filterText, activeFilter === 'profiles' && styles.activeFilterText]}>
            اللاعبين
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'videos' && styles.activeFilter]}
          onPress={() => handleFilterChange('videos')}
        >
          <Video size={16} color={activeFilter === 'videos' ? '#fff' : '#666'} />
          <Text style={[styles.filterText, activeFilter === 'videos' && styles.activeFilterText]}>
            الفيديوهات
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.filterButton, activeFilter === 'matches' && styles.activeFilter]}
          onPress={() => handleFilterChange('matches')}
        >
          <Trophy size={16} color={activeFilter === 'matches' ? '#fff' : '#666'} />
          <Text style={[styles.filterText, activeFilter === 'matches' && styles.activeFilterText]}>
            المباريات
          </Text>
        </TouchableOpacity>
      </View>

      {/* Search Results */}
      <View style={styles.resultsContainer}>
        {isSearching ? (
          <Animated.View style={[styles.loadingContainer, { transform: [{ scale: pulseAnim }] }]}>
            <Text style={styles.loadingText}>جاري البحث...</Text>
          </Animated.View>
        ) : searchResults.length > 0 ? (
          <FlatList
            data={searchResults}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => (
              <TouchableOpacity
                style={styles.resultItem}
                onPress={() => handleResultSelect(item)}
                activeOpacity={0.8}
              >
                <View style={styles.resultImageContainer}>
                  {item.image && (
                    <Image source={{ uri: item.image }} style={styles.resultImage} />
                  )}
                  <View style={styles.resultIcon}>
                    {getResultIcon(item.type)}
                  </View>
                </View>
                
                <View style={styles.resultContent}>
                  <Text style={styles.resultTitle}>{item.title}</Text>
                  <Text style={styles.resultSubtitle}>{item.subtitle}</Text>
                </View>
              </TouchableOpacity>
            )}
            showsVerticalScrollIndicator={false}
          />
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
            <Text style={styles.suggestionsTitle}>اقتراحات البحث</Text>
            <View style={styles.suggestionsList}>
              <TouchableOpacity style={styles.suggestionItem}>
                <Users size={16} color="#22c55e" />
                <Text style={styles.suggestionText}>اللاعبين المشهورين</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.suggestionItem}>
                <Video size={16} color="#3b82f6" />
                <Text style={styles.suggestionText}>فيديوهات التحليل</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.suggestionItem}>
                <Trophy size={16} color="#f59e0b" />
                <Text style={styles.suggestionText}>مباريات اليوم</Text>
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
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 15,
    gap: 10,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#1a1a1a',
    borderWidth: 1,
    borderColor: '#333',
    gap: 6,
  },
  activeFilter: {
    backgroundColor: '#22c55e',
    borderColor: '#22c55e',
  },
  filterText: {
    color: '#666',
    fontSize: 12,
    fontWeight: '600',
  },
  activeFilterText: {
    color: '#fff',
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
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 15,
    padding: 15,
    marginBottom: 10,
  },
  resultImageContainer: {
    position: 'relative',
    marginRight: 15,
  },
  resultImage: {
    width: 50,
    height: 50,
    borderRadius: 25,
  },
  resultIcon: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    backgroundColor: '#0a0a0a',
    borderRadius: 10,
    padding: 2,
  },
  resultContent: {
    flex: 1,
  },
  resultTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  resultSubtitle: {
    color: '#666',
    fontSize: 14,
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
