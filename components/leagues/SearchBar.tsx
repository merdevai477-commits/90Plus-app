import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  TextInput,
  TouchableOpacity,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
} from 'react-native';
import { Search, X, Filter } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';

const { width } = Dimensions.get('window');

interface SearchBarProps {
  onSearch: (query: string) => void;
  placeholder?: string;
  onFilterPress?: () => void;
}

const SearchBar: React.FC<SearchBarProps> = ({
  onSearch,
  placeholder = "ابحث عن المباريات...",
  onFilterPress
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [isFocused, setIsFocused] = useState(false);
  
  const focusAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(1)).current;
  const searchAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(focusAnim, {
        toValue: isFocused ? 1 : 0,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: isFocused ? 1.02 : 1,
        useNativeDriver: true,
        tension: 100,
        friction: 8,
      })
    ]).start();
  }, [isFocused]);

  const handleFocus = () => {
    setIsFocused(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  };

  const handleBlur = () => {
    setIsFocused(false);
  };

  const handleSearch = (text: string) => {
    setSearchQuery(text);
    onSearch(text);
  };

  const handleClear = () => {
    setSearchQuery('');
    onSearch('');
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  };

  const animatedBorderColor = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['#333', '#22c55e'],
  });

  const animatedShadowOpacity = focusAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, 0.3],
  });

  return (
    <View style={styles.container}>
      <Animated.View
        style={[
          styles.searchContainer,
          {
            transform: [{ scale: scaleAnim }],
            borderColor: animatedBorderColor,
            shadowOpacity: animatedShadowOpacity,
          }
        ]}
      >
        <View style={styles.searchIconContainer}>
          <Search size={20} color={isFocused ? '#22c55e' : '#666'} />
        </View>

        <TextInput
          style={styles.searchInput}
          value={searchQuery}
          onChangeText={handleSearch}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={placeholder}
          placeholderTextColor="#666"
          returnKeyType="search"
          autoCorrect={false}
          autoCapitalize="none"
        />

        {searchQuery.length > 0 && (
          <TouchableOpacity
            style={styles.clearButton}
            onPress={handleClear}
            activeOpacity={0.7}
          >
            <X size={16} color="#666" />
          </TouchableOpacity>
        )}

        {onFilterPress && (
          <TouchableOpacity
            style={styles.filterButton}
            onPress={() => {
              onFilterPress();
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            }}
            activeOpacity={0.7}
          >
            <Filter size={18} color="#22c55e" />
          </TouchableOpacity>
        )}
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1a1a1a',
    borderRadius: 25,
    paddingHorizontal: 15,
    paddingVertical: 12,
    borderWidth: 2,
    shadowColor: '#22c55e',
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 8,
    elevation: 8,
  },
  searchIconContainer: {
    marginRight: 10,
  },
  searchInput: {
    flex: 1,
    color: '#fff',
    fontSize: 16,
    fontWeight: '500',
  },
  clearButton: {
    padding: 4,
    marginRight: 8,
    borderRadius: 12,
    backgroundColor: '#333',
  },
  filterButton: {
    padding: 8,
    borderRadius: 12,
    backgroundColor: 'rgba(34, 197, 94, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(34, 197, 94, 0.3)',
  },
});

export default SearchBar;
