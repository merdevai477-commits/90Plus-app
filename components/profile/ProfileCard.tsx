import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path } from 'react-native-svg';

interface ProfileCardProps {
    playerImage: any;
    cardType?: 'gold' | 'icon' | 'toty';
    scale?: number;
}

export default function ProfileCard({
    playerImage,
    cardType = 'gold',
    scale = 0.6 // Small size: 180 x 276
}: ProfileCardProps) {
    // Calculate dimensions based on scale
    const WIDTH = 300 * scale;
    const HEIGHT = 460 * scale;

    // Get gradient colors based on card type
    const getGradientColors = () => {
        switch (cardType) {
            case 'icon':
                return ['#FF6B6B', '#FFD93D', '#6BCB77'];
            case 'toty':
                return ['#4158D0', '#C850C0', '#FFCC70'];
            case 'gold':
            default:
                return ['#FFD700', '#FFA500', '#FFD700'];
        }
    };

    const gradientColors = getGradientColors();

    return (
        <View style={[styles.container, { width: WIDTH, height: HEIGHT }]}>
            {/* FIFA Card Shape with Gradient Border */}
            <Svg width={WIDTH} height={HEIGHT} viewBox="0 0 300 460" style={styles.cardSvg}>
                <Defs>
                    <SvgLinearGradient id="borderGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor={gradientColors[0]} stopOpacity="1" />
                        <Stop offset="50%" stopColor={gradientColors[1]} stopOpacity="1" />
                        <Stop offset="100%" stopColor={gradientColors[2]} stopOpacity="1" />
                    </SvgLinearGradient>
                </Defs>

                {/* FIFA Card Border Path */}
                <Path
                    d="M150 8 L290 35 L290 380 L240 420 L150 452 L60 420 L10 380 L10 35 Z"
                    fill="url(#borderGradient)"
                />

                {/* Inner Card Background */}
                <Path
                    d="M150 12 L286 37 L286 378 L238 418 L150 448 L62 418 L14 378 L14 37 Z"
                    fill="#FFB700"
                />
            </Svg>

            {/* Player Image Container - Centered */}
            <View style={[styles.imageContainer, {
                top: 1 * scale,
                left: 1 * scale,
                width: 1 * scale,
                height: 1 * scale
            }]}>
                {/* Background Gradient */}
                <LinearGradient
                    colors={['#1a4d2e', '#0d2818']}
                    style={{ width: '100%', height: '100%', position: 'absolute' }}
                />

                {/* Player Image */}
                <Image
                    source={playerImage}
                    style={styles.playerImage}
                    resizeMode="cover"
                />

                {/* Gradient Overlay at Bottom */}
                <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.7)']}
                    style={styles.imageOverlay}
                />
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.5,
        shadowRadius: 40,
        elevation: 20,
    },
    cardSvg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    imageContainer: {
        position: 'absolute',
        overflow: 'hidden',
        justifyContent: 'center',
        alignItems: 'center',
    },
    playerImage: {
        width: '100%',
        height: '100%',
    },
    imageOverlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        height: '50%',
        backgroundColor: 'transparent',
    },
});
