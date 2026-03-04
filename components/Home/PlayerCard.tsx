import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { Star, Users } from 'lucide-react-native';
import { Player } from './types';
import { styles } from './homeStyles';

interface PlayerCardProps {
  item: Player;
  onPress: () => void;
  imageError?: boolean;
  onImageError?: () => void;
}

import TeamBadge from '../common/TeamBadge';

export const PlayerCard = React.memo<PlayerCardProps>(({ 
  item, 
  onPress, 
  imageError, 
  onImageError 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    Animated.spring(scaleAnim, {
      toValue: 0.95,
      useNativeDriver: true,
    }).start();
  };

  const handlePressOut = () => {
    Animated.spring(scaleAnim, {
      toValue: 1,
      useNativeDriver: true,
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale: scaleAnim }] }}>
      <TouchableOpacity
        style={styles.playerCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={{ alignItems: 'center', justifyContent: 'center', width: '100%', height: 120 }}>
          <TeamBadge name={item.name} logo={item.image} size={80} color="transparent" />
        </View>
        <View style={styles.playerInfo}>
          <Text style={styles.playerName} numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={styles.playerPosition}>{item.position}</Text>
          <Text style={styles.playerTeam} numberOfLines={1}>
            {item.team}
          </Text>
          <View style={styles.ratingContainer}>
            <Star color="#FFD700" size={12} fill="#FFD700" />
            <Text style={styles.rating}>{item.rating}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});