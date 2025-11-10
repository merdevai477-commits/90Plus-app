import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  FlatList,
  RefreshControl,
  StatusBar,
} from 'react-native';
import { 
  Trophy,
  Target,
  TrendingUp,
  Filter,
  Globe,
  Star,
  Zap,
  Calendar,
  Clock,
  Award,
  ChevronRight
} from 'lucide-react-native';

// Import our custom components
import {
  SearchBar,
  MatchCard,
  PredictionSystem,
  useHapticFeedback,
  useFadeIn,
  useSlideIn,
  useStagger,
  Match,
  Prediction,
  UserStats
} from '../../components/leagues';

const { width } = Dimensions.get('window');

// Enhanced Tab Component with animations
const TabSelector = ({ activeTab, onTabChange }: { activeTab: string; onTabChange: (tab: string) => void }) => {
  const slideAnim = useRef(new Animated.Value(0)).current;
  const haptic = useHapticFeedback();

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: activeTab === 'results' ? 0 : width / 2 - 40,
      useNativeDriver: true,
      tension: 50,
      friction: 8,
    }).start();
  }, [activeTab]);

  const handleTabChange = (tab: string) => {
    haptic.tabSwitch();
    onTabChange(tab);
  };

  return (
    <View style={styles.tabContainer}>
      <Animated.View 
        style={[
          styles.tabIndicator,
          { transform: [{ translateX: slideAnim }] }
        ]} 
      />
      
      <TouchableOpacity
        style={[styles.tab, activeTab === 'results' && styles.activeTab]}
        onPress={() => handleTabChange('results')}
        activeOpacity={0.8}
      >
        <Trophy size={20} color={activeTab === 'results' ? '#fff' : '#666'} />
        <Text style={[styles.tabText, activeTab === 'results' && styles.activeTabText]}>
          النتائج
        </Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.tab, activeTab === 'predictions' && styles.activeTab]}
        onPress={() => handleTabChange('predictions')}
        activeOpacity={0.8}
      >
        <Target size={20} color={activeTab === 'predictions' ? '#fff' : '#666'} />
        <Text style={[styles.tabText, activeTab === 'predictions' && styles.activeTabText]}>
          التوقعات
        </Text>
      </TouchableOpacity>
    </View>
  );
};

// Enhanced Header Component
const Header = () => {
  const fadeAnim = useFadeIn(800);
  const slideAnim = useSlideIn('down', 600);

  return (
    <Animated.View 
      style={[
        styles.header,
        {
          opacity: fadeAnim,
          transform: [{ translateY: slideAnim }]
        }
      ]}
    >
      <View style={styles.headerContent}>
        <View style={styles.titleContainer}>
          <Text style={styles.title}>⚽ المباريات العالمية</Text>
          <Text style={styles.subtitle}>تابع النتائج وتوقع المباريات من جميع أنحاء العالم</Text>
        </View>

        <View style={styles.headerStats}>
          <View style={styles.statItem}>
            <Globe size={16} color="#22c55e" />
            <Text style={styles.statText}>50+ دوري</Text>
          </View>
          <View style={styles.statItem}>
            <Clock size={16} color="#3b82f6" />
            <Text style={styles.statText}>مباشر</Text>
          </View>
        </View>
      </View>
    </Animated.View>
  );
};

// Filter Modal Component
const FilterModal = ({ visible, onClose, onApply }: { visible: boolean; onClose: () => void; onApply: (filters: any) => void }) => {
  const [filters, setFilters] = useState({
    leagues: [],
    status: 'all',
    dateRange: 'today'
  });

  const slideAnim = useRef(new Animated.Value(visible ? 0 : 300)).current;

  useEffect(() => {
    Animated.spring(slideAnim, {
      toValue: visible ? 0 : 300,
      useNativeDriver: true,
      tension: 100,
      friction: 8,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <View style={styles.modalOverlay}>
      <Animated.View 
        style={[
          styles.filterModal,
          { transform: [{ translateY: slideAnim }] }
        ]}
      >
        <View style={styles.modalHeader}>
          <Text style={styles.modalTitle}>تصفية المباريات</Text>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Text style={styles.closeButtonText}>✕</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView style={styles.modalContent}>
          <Text style={styles.filterSectionTitle}>الدوريات</Text>
          {/* Filter options would go here */}
          
          <Text style={styles.filterSectionTitle}>الحالة</Text>
          {/* Status filter options */}
          
          <Text style={styles.filterSectionTitle}>التاريخ</Text>
          {/* Date range options */}
        </ScrollView>
        
        <View style={styles.modalFooter}>
          <TouchableOpacity style={styles.resetButton}>
            <Text style={styles.resetButtonText}>إعادة تعيين</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={styles.applyButton}
            onPress={() => onApply(filters)}
          >
            <Text style={styles.applyButtonText}>تطبيق</Text>
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

// Main Leagues Screen
const LeaguesScreen = () => {
  const [activeTab, setActiveTab] = useState('results');
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [userPredictions, setUserPredictions] = useState<{ [key: string]: any }>({});
  
  const haptic = useHapticFeedback();
  const fadeAnim = useFadeIn(1000);
  const staggerAnimations = useStagger(10, 100);

  // Mock data for matches
  const [matches, setMatches] = useState<Match[]>([
    {
      id: '1',
      homeTeam: 'ريال مدريد',
      awayTeam: 'برشلونة',
      homeScore: 2,
      awayScore: 1,
      homeLogo: 'https://upload.wikimedia.org/wikipedia/en/5/56/Real_Madrid_CF.svg',
      awayLogo: 'https://upload.wikimedia.org/wikipedia/en/4/47/FC_Barcelona_%28crest%29.svg',
      date: 'اليوم',
      time: '22:00',
      status: 'finished',
      league: 'الدوري الإسباني',
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/9/9f/LaLiga_logo.svg',
      venue: 'سانتياغو برنابيو',
      odds: { home: 2.1, draw: 3.2, away: 2.8 },
      prediction: { 
        type: 'win', 
        homeScore: 2, 
        awayScore: 2, 
        points: 25, 
        isCorrect: true 
      }
    },
    {
      id: '2',
      homeTeam: 'ليفربول',
      awayTeam: 'مانشستر سيتي',
      homeScore: 1,
      awayScore: 1,
      homeLogo: 'https://upload.wikimedia.org/wikipedia/en/0/0c/Liverpool_FC.svg',
      awayLogo: 'https://upload.wikimedia.org/wikipedia/en/e/eb/Manchester_City_FC_badge.svg',
      date: 'الآن',
      time: '45\'',
      status: 'live',
      league: 'الدوري الإنجليزي',
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/f/f2/Premier_League_Logo.svg',
      venue: 'أنفيلد',
      odds: { home: 2.5, draw: 3.1, away: 2.3 }
    },
    {
      id: '3',
      homeTeam: 'بايرن ميونخ',
      awayTeam: 'دورتموند',
      homeLogo: 'https://upload.wikimedia.org/wikipedia/commons/1/1b/FC_Bayern_M%C3%BCnchen_logo_%282017%29.svg',
      awayLogo: 'https://upload.wikimedia.org/wikipedia/commons/6/67/Borussia_Dortmund_logo.svg',
      date: 'غداً',
      time: '21:30',
      status: 'upcoming',
      league: 'الدوري الألماني',
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/commons/d/df/Bundesliga_logo_%282017%29.svg',
      venue: 'أليانز أرينا',
      odds: { home: 1.8, draw: 3.5, away: 3.2 }
    },
    {
      id: '4',
      homeTeam: 'باريس سان جيرمان',
      awayTeam: 'أولمبيك مارسيليا',
      homeLogo: 'https://upload.wikimedia.org/wikipedia/en/a/a7/Paris_Saint-Germain_F.C..svg',
      awayLogo: 'https://upload.wikimedia.org/wikipedia/en/4/4e/Olympique_de_Marseille.svg',
      date: 'غداً',
      time: '20:00',
      status: 'upcoming',
      league: 'الدوري الفرنسي',
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/4/4e/Ligue_1_Logo.svg',
      venue: 'بارك دي برينس',
      odds: { home: 1.5, draw: 4.0, away: 4.5 }
    },
    {
      id: '5',
      homeTeam: 'يوفنتوس',
      awayTeam: 'إنتر ميلان',
      homeLogo: 'https://upload.wikimedia.org/wikipedia/commons/1/15/Juventus_FC_2017_logo.svg',
      awayLogo: 'https://upload.wikimedia.org/wikipedia/commons/0/05/FC_Internazionale_Milano_2021.svg',
      date: 'بعد غد',
      time: '21:45',
      status: 'upcoming',
      league: 'الدوري الإيطالي',
      leagueLogo: 'https://upload.wikimedia.org/wikipedia/en/f/f1/Serie_A_logo_%282019%29.svg',
      venue: 'أليانز ستاديوم',
      odds: { home: 2.2, draw: 3.0, away: 2.7 }
    }
  ]);

  // Mock user stats
  const userStats: UserStats = {
    totalPredictions: 42,
    correctPredictions: 35,
    accuracy: 83,
    totalPoints: 1250,
    streak: 7,
    rank: 15,
    level: 8
  };

  // Mock predictions data
  const [predictions, setPredictions] = useState<Prediction[]>([
    {
      id: '1',
      matchId: '1',
      userId: 'user1',
      type: 'win',
      homeScore: 2,
      awayScore: 1,
      points: 25,
      isCorrect: true,
      submittedAt: new Date('2024-01-15'),
      matchResult: { homeScore: 2, awayScore: 1 }
    },
    {
      id: '2',
      matchId: '2',
      userId: 'user1',
      type: 'draw',
      homeScore: 1,
      awayScore: 1,
      points: 15,
      isCorrect: false,
      submittedAt: new Date('2024-01-14'),
      matchResult: { homeScore: 2, awayScore: 0 }
    }
  ]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    haptic.search();
  };

  const handleFilterPress = () => {
    setShowFilters(true);
    haptic.filter();
  };

  const handlePredictionSubmit = async (matchId: string, prediction: any) => {
    haptic.predictionSubmit();
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    setUserPredictions(prev => ({
      ...prev,
      [matchId]: prediction
    }));
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    haptic.refresh();
    
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    setRefreshing(false);
  };

  const filteredMatches = matches.filter(match => {
    if (!searchQuery) return true;
    return match.homeTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
           match.awayTeam.toLowerCase().includes(searchQuery.toLowerCase()) ||
           match.league.toLowerCase().includes(searchQuery.toLowerCase());
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#0a0a0a" />
      
      <Header />
      
      <SearchBar 
        onSearch={handleSearch}
        onFilterPress={handleFilterPress}
        placeholder="ابحث عن المباريات أو الفرق..."
      />

      <TabSelector activeTab={activeTab} onTabChange={setActiveTab} />

      <ScrollView 
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor="#22c55e"
            colors={['#22c55e']}
          />
        }
      >
        {activeTab === 'predictions' && (
        <PredictionSystem
          predictions={predictions}
          userStats={userStats}
          onPredictionSubmit={(prediction) => {
            // Handle prediction submission
            console.log('Prediction submitted:', prediction);
          }}
          onPredictionUpdate={() => {}}
        />
        )}

        <View style={styles.matchesContainer}>
          {filteredMatches.map((match, index) => (
            <Animated.View
              key={match.id}
              style={{
                opacity: staggerAnimations[index] || 1,
                transform: [
                  { 
                    translateY: staggerAnimations[index]?.interpolate({
                      inputRange: [0, 1],
                      outputRange: [30, 0],
                    }) || 0
                  }
                ]
              }}
            >
          <MatchCard 
            match={match} 
                onPredictionSubmit={handlePredictionSubmit}
            showPrediction={activeTab === 'predictions'}
                userPredictions={userPredictions}
              />
            </Animated.View>
          ))}
        </View>

        {filteredMatches.length === 0 && (
          <View style={styles.emptyState}>
            <Trophy size={64} color="#666" />
            <Text style={styles.emptyStateTitle}>لا توجد مباريات</Text>
            <Text style={styles.emptyStateText}>
              {searchQuery ? 'لم نجد أي مباريات تطابق بحثك' : 'لا توجد مباريات متاحة حالياً'}
            </Text>
          </View>
        )}
      </ScrollView>

      <FilterModal 
        visible={showFilters}
        onClose={() => setShowFilters(false)}
        onApply={(filters) => {
          console.log('Applied filters:', filters);
          setShowFilters(false);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0a0a',
  },
  header: {
    padding: 20,
    paddingTop: 60,
    backgroundColor: '#1a1a1a',
    borderBottomLeftRadius: 25,
    borderBottomRightRadius: 25,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  headerContent: {
    alignItems: 'center',
  },
  titleContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
    lineHeight: 20,
  },
  headerStats: {
    flexDirection: 'row',
    gap: 20,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  statText: {
    color: '#888',
    fontSize: 12,
    fontWeight: '600',
  },
  tabContainer: {
    flexDirection: 'row',
    marginHorizontal: 20,
    marginTop: 20,
    backgroundColor: '#1a1a1a',
    borderRadius: 20,
    padding: 4,
    position: 'relative',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  tabIndicator: {
    position: 'absolute',
    width: (width - 48) / 2,
    height: '90%',
    backgroundColor: '#22c55e',
    borderRadius: 16,
    top: 4,
    left: 4,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 15,
    gap: 8,
    zIndex: 1,
  },
  activeTab: {},
  tabText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#666',
  },
  activeTabText: {
    color: '#fff',
  },
  scrollView: {
    flex: 1,
  },
  matchesContainer: {
    padding: 20,
    paddingBottom: 100,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: 60,
    paddingHorizontal: 40,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
    marginTop: 16,
    marginBottom: 8,
  },
  emptyStateText: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
    lineHeight: 20,
  },
  modalOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  filterModal: {
    backgroundColor: '#1a1a1a',
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
  },
  closeButton: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#333',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  modalContent: {
    padding: 20,
  },
  filterSectionTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
    marginBottom: 15,
    marginTop: 20,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: 20,
    gap: 15,
  },
  resetButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 25,
    backgroundColor: '#333',
    alignItems: 'center',
  },
  resetButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  applyButton: {
    flex: 1,
    paddingVertical: 15,
    borderRadius: 25,
    backgroundColor: '#22c55e',
    alignItems: 'center',
  },
  applyButtonText: {
    color: '#000',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

export default LeaguesScreen;