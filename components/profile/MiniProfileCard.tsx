import React from 'react';
import { View, StyleSheet, Text } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, LinearGradient as SvgLinearGradient, Stop, Path, ClipPath, Image as SvgImage } from 'react-native-svg';

interface MiniProfileCardProps {
    playerImage?: string | null;
    countryFlag?: string;
    position?: string;
    clubLogo?: string;
}

const WIDTH = 100;
const HEIGHT = 150;

export default function MiniProfileCard({
    playerImage,
    countryFlag = '🇪🇬',
    position = 'RW',
    clubLogo,
}: MiniProfileCardProps) {
    return (
        <View style={styles.container}>
            {/* Glow Effect */}
            <View style={styles.glow} />

            {/* FIFA Card Shape */}
            <Svg width={WIDTH} height={HEIGHT} viewBox="0 0 100 150" style={styles.cardSvg}>
                <Defs>
                    <SvgLinearGradient id="borderGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                        <Stop offset="0%" stopColor="#a17f37" stopOpacity="1" />
                        <Stop offset="50%" stopColor="#FFD700" stopOpacity="1" />
                        <Stop offset="100%" stopColor="#a17f37" stopOpacity="1" />
                    </SvgLinearGradient>
                    <ClipPath id="imageClip">
                        <Path d="M50 5 L95 15 L95 75 L50 75 Z" />
                    </ClipPath>
                </Defs>

                {/* Card Border */}
                <Path
                    d="M50 3 L97 13 L97 125 L80 140 L50 148 L20 140 L3 125 L3 13 Z"
                    fill="url(#borderGrad)"
                />

                {/* Inner Card */}
                <Path
                    d="M50 5 L95 15 L95 123 L79 138 L50 146 L21 138 L5 123 L5 15 Z"
                    fill="#FFB700"
                />

                {/* Player Image */}
                {playerImage && (
                    <SvgImage
                        x="50"
                        y="5"
                        width="45"
                        height="70"
                        href={{ uri: playerImage }}
                        preserveAspectRatio="xMidYMid slice"
                        clipPath="url(#imageClip)"
                    />
                )}
            </Svg>

            {/* Position */}
            <View style={styles.positionContainer}>
                <Text style={styles.position}>{position}</Text>
            </View>

            {/* Country Flag */}
            <View style={styles.flagContainer}>
                <Text style={styles.flag}>{countryFlag}</Text>
            </View>

            {/* Club Logo */}
            {clubLogo && (
                <View style={styles.clubContainer}>
                    <Image
                        source={{ uri: clubLogo }}
                        style={styles.clubLogo}
                        contentFit="contain"
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        width: WIDTH,
        height: HEIGHT,
        position: 'relative',
    },
    cardSvg: {
        position: 'absolute',
        top: 0,
        left: 0,
    },
    glow: {
        position: 'absolute',
        top: 0,
        left: 0,
        width: WIDTH,
        height: HEIGHT,
        borderRadius: 10,
        shadowColor: '#FFD700',
        shadowOffset: { width: 0, height: 0 },
        shadowOpacity: 0.5,
        shadowRadius: 15,
        elevation: 10,
        zIndex: -1,
    },
    positionContainer: {
        position: 'absolute',
        top: 15,
        left: 12,
    },
    position: {
        fontSize: 12,
        fontWeight: '900',
        color: '#000000',
    },
    flagContainer: {
        position: 'absolute',
        top: 32,
        left: 10,
    },
    flag: {
        fontSize: 16,
    },
    clubContainer: {
        position: 'absolute',
        top: 52,
        left: 12,
    },
    clubLogo: {
        width: 16,
        height: 16,
    },
});