import React, { useRef } from 'react';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { Play, Eye, Heart } from 'lucide-react-native';
import { Video } from './types';
import { styles } from './homeStyles';
import { isValidThumbnail, VIDEO_THUMBNAIL_PLACEHOLDER } from '../../constants/VideoPlaceholder';

interface VideoCardProps {
  item: Video;
  onPress: () => void;
  imageError: boolean;
  onImageError: () => void;
}

export const VideoCard = React.memo<VideoCardProps>(({ 
  item, 
  onPress, 
  imageError, 
  onImageError 
}) => {
  const scaleAnim = useRef(new Animated.Value(1)).current;

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

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
        style={styles.videoCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={styles.videoThumbnailContainer}>
          {imageError || !isValidThumbnail(item.thumbnail) ? (
            <View style={[styles.videoThumbnail, styles.errorPlaceholder, { backgroundColor: VIDEO_THUMBNAIL_PLACEHOLDER.backgroundColor }]}>
              <Play color="#666" size={24} />
              <Text style={{ color: '#999', fontSize: 10, marginTop: 4 }}>No Preview</Text>
            </View>
          ) : (
            <Image
              source={{ uri: item.thumbnail }}
              style={styles.videoThumbnail}
              onError={onImageError}
            />
          )}
          <View style={styles.playButton}>
            <Play color="#fff" size={16} fill="#fff" />
          </View>
          <Text style={styles.videoDuration}>{item.duration}</Text>
        </View>
        <Text style={styles.videoTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={styles.videoStats}>
          <View style={styles.statItem}>
            <Eye color="#666" size={12} />
            <Text style={styles.statText}>{formatNumber(item.views)}</Text>
          </View>
          <View style={styles.statItem}>
            <Heart color="#666" size={12} />
            <Text style={styles.statText}>{formatNumber(item.likes)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});