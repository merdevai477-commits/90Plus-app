import React from 'react';
import { View, Image, Text, StyleSheet, Dimensions, FlatList, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';

const { width } = Dimensions.get('window');
const COLUMN_COUNT = 3;
const SPACING = 2;
const ITEM_SIZE = (width - (SPACING * (COLUMN_COUNT - 1))) / COLUMN_COUNT;

interface VideoItem {
    id: string;
    thumbnail: any;
    views: string;
    duration: string;
}

interface VideoGridProps {
    videos: VideoItem[];
}

export default function VideoGrid({ videos }: VideoGridProps) {
    const renderItem = ({ item }: { item: VideoItem }) => (
        <TouchableOpacity activeOpacity={0.8} style={styles.itemContainer}>
            <Image source={item.thumbnail} style={styles.thumbnail} resizeMode="cover" />
            <LinearGradient
                colors={['transparent', 'rgba(0,0,0,0.8)']}
                style={styles.overlay}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 0, y: 1 }}
            >
                <View style={styles.statsRow}>
                    <Ionicons name="play" size={10} color="#FFF" />
                    <Text style={styles.statsText}>{item.views}</Text>
                </View>
                <Text style={styles.duration}>{item.duration}</Text>
            </LinearGradient>
        </TouchableOpacity>
    );

    return (
        <FlatList
            data={videos}
            renderItem={renderItem}
            keyExtractor={(item) => item.id}
            numColumns={COLUMN_COUNT}
            scrollEnabled={false}
            contentContainerStyle={styles.grid}
            columnWrapperStyle={{ gap: SPACING }}
        />
    );
}

const styles = StyleSheet.create({
    grid: {
        paddingBottom: 100,
    },
    itemContainer: {
        width: ITEM_SIZE,
        height: ITEM_SIZE * 1.5,
        marginBottom: SPACING,
        backgroundColor: ProfileTheme.colors.glassBlack,
    },
    thumbnail: {
        width: '100%',
        height: '100%',
    },
    overlay: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: 8,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'flex-end',
    },
    statsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    statsText: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
    },
    duration: {
        color: '#FFF',
        fontSize: 10,
        fontWeight: '600',
        backgroundColor: 'rgba(0,0,0,0.5)',
        paddingHorizontal: 4,
        paddingVertical: 2,
        borderRadius: 4,
        overflow: 'hidden',
    },
});
