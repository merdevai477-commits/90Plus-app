import React from 'react';
import { View, Image, StyleSheet, Dimensions, TouchableOpacity } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 450; // Extended to wrap around card

interface ProfileHeaderProps {
    coverImage?: { uri: string };
    onPress?: () => void;
}

export default function ProfileHeader({ coverImage, onPress }: ProfileHeaderProps) {
    return (
        <View style={styles.container}>
            {/* Cover Image with Gradient Overlay */}
            <TouchableOpacity
                style={[styles.coverContainer, !coverImage && { backgroundColor: ProfileTheme.colors.glassWhite }]}
                onPress={onPress}
                activeOpacity={0.9}
            >
                {coverImage ? (
                    <Image source={coverImage} style={styles.coverImage} resizeMode="cover" />
                ) : (
                    // Default Stadium Background if no image
                    <Image
                        source={{ uri: 'https://images.unsplash.com/photo-1522778119026-d647f0565c6a?q=80&w=2070&auto=format&fit=crop' }}
                        style={styles.coverImage}
                        resizeMode="cover"
                    />
                )}
                <LinearGradient
                    colors={ProfileTheme.gradients.darkOverlay}
                    style={styles.gradientOverlay}
                />
            </TouchableOpacity>
        </View>
    );
}

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
