import React from 'react';
import { View, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeIn, FadeOut } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { Search, X } from 'lucide-react-native';
import * as Haptics from 'expo-haptics';
import { COLORS } from '../reels/constants';

interface Props {
  visible: boolean;
  query: string;
  placeholder: string;
  onQueryChange: (q: string) => void;
  onClose: () => void;
}

export function NotificationSearch({ visible, query, placeholder, onQueryChange, onClose }: Props) {
  if (!visible) return null;

  return (
    <Animated.View entering={FadeIn.duration(300)} exiting={FadeOut.duration(200)} style={styles.searchContainer}>
      <BlurView intensity={20} tint="dark" style={styles.searchBarBlur}>
        <LinearGradient
          colors={['rgba(255,255,255,0.12)', 'rgba(255,255,255,0.06)']}
          style={styles.searchBar}
        >
          <View style={styles.searchIconContainer}>
            <Search size={20} color={COLORS.neonGreen} />
          </View>
          <TextInput
            style={styles.searchInput}
            placeholder={placeholder}
            placeholderTextColor="rgba(255,255,255,0.5)"
            value={query}
            onChangeText={onQueryChange}
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
          />
          <TouchableOpacity
            onPress={() => {
              onQueryChange('');
              onClose();
              Haptics.selectionAsync();
            }}
            style={styles.closeSearchButton}
          >
            <X size={20} color="rgba(255,255,255,0.7)" />
          </TouchableOpacity>
        </LinearGradient>
      </BlurView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  searchContainer: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  searchBarBlur: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  searchIconContainer: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    color: COLORS.white,
    fontSize: 16,
    paddingVertical: 0,
  },
  closeSearchButton: {
    marginLeft: 8,
    padding: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
});

