import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface WebGradientProps {
    colors: readonly [string, string, ...string[]];
    start?: { x: number; y: number };
    end?: { x: number; y: number };
    style?: ViewStyle;
    children?: React.ReactNode;
}

const WebGradient: React.FC<WebGradientProps> = ({
    colors,
    start = { x: 0, y: 0 },
    end = { x: 1, y: 1 },
    style,
    children,
}) => {
    return (
        <LinearGradient
            colors={colors}
            start={start}
            end={end}
            style={style}
        >
            {children}
        </LinearGradient>
    );
};

export default WebGradient;