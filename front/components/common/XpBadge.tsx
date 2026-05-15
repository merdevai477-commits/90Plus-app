import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { Zap } from 'lucide-react-native';
import { useRouter } from 'expo-router';

interface XpBadgeProps {
  xp: number;
  level: number;
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
}

export const XpBadge: React.FC<XpBadgeProps> = ({ xp, level, size = 'md', onPress }) => {
  const router = useRouter();

  const handlePress = () => {
    if (onPress) {
      onPress();
    } else {
      router.push('/(tabs)/rank');
    }
  };

  const sizeStyles = SIZE_MAP[size];

  return (
    <Pressable onPress={handlePress}>
      <View style={[styles.badge, sizeStyles.container]}>
        <Zap size={sizeStyles.iconSize} color="#A855F7" fill="#A855F7" />
        <Text style={[styles.text, sizeStyles.text]}>
          {xp.toLocaleString()} XP · Lv. {level}
        </Text>
      </View>
    </Pressable>
  );
};

const SIZE_MAP = {
  sm: {
    container: { paddingHorizontal: 8, paddingVertical: 4 },
    text: { fontSize: 12 },
    iconSize: 12,
  },
  md: {
    container: { paddingHorizontal: 10, paddingVertical: 6 },
    text: { fontSize: 14 },
    iconSize: 14,
  },
  lg: {
    container: { paddingHorizontal: 12, paddingVertical: 8 },
    text: { fontSize: 16 },
    iconSize: 16,
  },
};

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(168, 85, 247, 0.15)',
    borderRadius: 16,
    gap: 4,
    borderWidth: 1,
    borderColor: '#A855F7',
  },
  text: {
    color: '#A855F7',
    fontWeight: 'bold',
  },
});
