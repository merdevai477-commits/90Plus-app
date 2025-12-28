import React from 'react';
import { View, Image, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

const { width } = Dimensions.get('window');
const COVER_HEIGHT = 220;

interface ProfileHeaderProps {
    coverImage: { uri: string };
}

export default function ProfileHeader({ coverImage }: ProfileHeaderProps) {
    return (
        <View style={styles.container}>
            {/* Cover Image with Gradient Overlay */}
            <View style={styles.coverContainer}>
                <Image source={coverImage} style={styles.coverImage} resizeMode="cover" />
                <LinearGradient
                    colors={ProfileTheme.gradients.darkOverlay}
                    style={styles.gradientOverlay}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        marginBottom: 20,
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
