import React, { memo } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image'; // ✅ Use expo-image for better performance
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 450; // Extended to wrap around card

interface ProfileHeaderProps {
    coverImage?: { uri: string };
    onPress?: () => void;
}

// ✅ PERFORMANCE: Memoize to prevent unnecessary re-renders
const ProfileHeader = memo(function ProfileHeader({ coverImage, onPress }: ProfileHeaderProps) {
    // ✅ Default cover image as constant
    const defaultCoverUri = 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2070&auto=format&fit=crop';
    
    return (
        <View style={styles.container}>
            {/* Cover Image with Gradient Overlay */}
            <TouchableOpacity
                style={[styles.coverContainer, !coverImage && { backgroundColor: ProfileTheme.colors.glassWhite }]}
                onPress={onPress}
                activeOpacity={0.9}
            >
                <Image 
                    source={coverImage || { uri: defaultCoverUri }}
                    style={styles.coverImage} 
                    contentFit="cover"
                    // ✅ OPTIMIZATION: Enable caching and transitions
                    cachePolicy="memory-disk"
                    priority="high"
                    transition={300}
                />
                <LinearGradient
                    colors={ProfileTheme.gradients.darkOverlay}
                    style={styles.gradientOverlay}
                />
            </TouchableOpacity>
        </View>
    );
});

export default ProfileHeader;

const styles = StyleSheet.create({
    container: {
        // No margin - allow overlap
    },
    coverContainer: {
        height: COVER_HEIGHT,
        width: width,
        position: 'relative',
    },
    coverImage: {
        width: '100%',
        height: '100%',
    },
    gradientOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '60%',
    },
});
