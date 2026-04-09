import React, { useRef } from 'react';
import type { ImageStyle, TextStyle, ViewStyle } from 'react-native';
import { View, Text, TouchableOpacity, Image, Animated } from 'react-native';
import { Play, Eye, Heart } from 'lucide-react-native';
import { Video } from './types';
import { styles } from './homeStyles'; // Updated with video styles
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

  // homeStyles exports an untyped StyleSheet; narrow the keys we use here
  const s = styles as unknown as {
    videoCard: ViewStyle;
    videoThumbnailContainer: ViewStyle;
    videoThumbnail: ViewStyle | ImageStyle; // used on both <View> (placeholder) and <Image>
    errorPlaceholder: ViewStyle;
    playButton: ViewStyle;
    videoDuration: TextStyle;
    videoTitle: TextStyle;
    videoStats: ViewStyle;
    statItem: ViewStyle;
    statText: TextStyle;
  };

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
        style={s.videoCard}
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        onPress={onPress}
        activeOpacity={0.9}
      >
        <View style={s.videoThumbnailContainer}>
          {imageError || !isValidThumbnail(item.thumbnail) ? (
            <View style={[s.videoThumbnail as ViewStyle, s.errorPlaceholder, { backgroundColor: VIDEO_THUMBNAIL_PLACEHOLDER.backgroundColor }]}>
              <Play color="#666" size={24} />
              <Text style={{ color: '#999', fontSize: 10, marginTop: 4 }}>No Preview</Text>
            </View>
          ) : (
            <Image
              source={{ uri: item.thumbnail }}
              style={s.videoThumbnail as ImageStyle}
              onError={onImageError}
            />
          )}
          <View style={s.playButton}>
            <Play color="#fff" size={16} fill="#fff" />
          </View>
          <Text style={s.videoDuration}>{item.duration}</Text>
        </View>
        <Text style={s.videoTitle} numberOfLines={2}>
          {item.title}
        </Text>
        <View style={s.videoStats}>
          <View style={s.statItem}>
            <Eye color="#666" size={12} />
            <Text style={s.statText}>{formatNumber(item.views)}</Text>
          </View>
          <View style={s.statItem}>
            <Heart color="#666" size={12} />
            <Text style={s.statText}>{formatNumber(item.likes)}</Text>
          </View>
        </View>
      </TouchableOpacity>
    </Animated.View>
  );
});