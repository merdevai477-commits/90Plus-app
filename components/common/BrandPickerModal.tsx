import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ScrollView } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LOCAL_BRANDS, getBrandsByCategory } from '../../data/localBrands';

interface BrandPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (brand: any) => void;
    selectedBrandId?: string;
}

export default function BrandPickerModal({ visible, onClose, onSelect, selectedBrandId }: BrandPickerModalProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('All');
    
    const categories = ['All', 'Sports'];
    const filteredBrands = selectedCategory === 'All' 
        ? LOCAL_BRANDS 
        : getBrandsByCategory(selectedCategory);

    const renderCategoryTab = (category: string) => (
        <TouchableOpacity
            key={category}
            style={[
                styles.categoryTab,
                selectedCategory === category && styles.selectedCategoryTab
            ]}
            onPress={() => setSelectedCategory(category)}
        >
            <Text style={[
                styles.categoryText,
                selectedCategory === category && styles.selectedCategoryText
            ]}>
                {category === 'All' ? 'الكل' : 
                 category === 'Sports' ? 'رياضة' :
                 category}
            </Text>
        </TouchableOpacity>
    );

    const renderBrandItem = ({ item }: { item: typeof LOCAL_BRANDS[0] }) => {
        const isSelected = selectedBrandId === item.id;
        const hasLogo = item.logo && item.logo.length > 0;
        
        return (
            <TouchableOpacity
                style={[
                    styles.item,
                    { backgroundColor: item.color === '#FFFFFF' || item.color === '#FFF' ? '#2A2A2A' : item.color },
                    isSelected && styles.selectedItem
                ]}
                onPress={() => {
                    onSelect(item);
                    onClose();
                }}
            >
                {hasLogo ? (
                    <Image
                        source={{ uri: item.logo }}
                        style={styles.brandLogo}
                        contentFit="contain"
                        transition={200}
                    />
                ) : (
                    <Text style={[
                        styles.brandName,
                        { color: item.color === '#000000' || item.color === '#000' ? '#FFF' : '#000' }
                    ]}>
                        {item.nameAr}
                    </Text>
                )}
                {isSelected && (
                    <View style={styles.checkmark}>
                        <Ionicons name="checkmark" size={16} color="#22c55e" />
                    </View>
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            visible={visible}
            animationType="slide"
            transparent={true}
            onRequestClose={onClose}
        >
            <View style={styles.container}>
                <BlurView intensity={20} style={StyleSheet.absoluteFill} tint="dark" />

                <View style={styles.content}>
                    <View style={styles.header}>
                        <Text style={styles.title}>اختر العلامة التجارية</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Category Tabs */}
                    <ScrollView 
                        horizontal 
                        showsHorizontalScrollIndicator={false}
                        style={styles.categoryContainer}
                        contentContainerStyle={styles.categoryContent}
                    >
                        {categories.map(renderCategoryTab)}
                    </ScrollView>

                    {/* Brand Grid */}
                    <FlashList
                        data={filteredBrands}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderBrandItem}
                        ListEmptyComponent={
                            <View style={styles.emptyContainer}>
                                <Text style={styles.emptyText}>لا توجد علامات تجارية</Text>
                            </View>
                        }
                    />
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    content: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '70%',
        padding: 20,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
    },
    closeButton: {
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    categoryContainer: {
        marginBottom: 20,
        maxHeight: 50,
    },
    categoryContent: {
        paddingHorizontal: 5,
    },
    categoryTab: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        marginHorizontal: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
        minWidth: 60,
        alignItems: 'center',
    },
    selectedCategoryTab: {
        backgroundColor: '#22c55e',
    },
    categoryText: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: '600',
    },
    selectedCategoryText: {
        color: '#FFF',
        fontWeight: 'bold',
    },
    listContent: {
        paddingBottom: 20,
    },
    item: {
        flex: 1,
        margin: 5,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 16,
        borderRadius: 12,
        minHeight: 80,
        position: 'relative',
    },
    selectedItem: {
        borderWidth: 3,
        borderColor: '#22c55e',
    },
    brandLogo: {
        width: 60,
        height: 40,
        marginBottom: 8,
    },
    brandName: {
        color: '#FFF',
        fontSize: 14,
        fontWeight: 'bold',
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.7)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 3,
    },
    checkmark: {
        position: 'absolute',
        top: 4,
        right: 4,
        backgroundColor: '#FFF',
        borderRadius: 10,
        padding: 2,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingVertical: 40,
    },
    emptyText: {
        color: '#888',
        fontSize: 16,
    },
});
