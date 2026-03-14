import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { FlashList } from '@shopify/flash-list';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { BRANDS } from '../../data/brands';

interface BrandPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (brand: any) => void;
    selectedBrandId?: string;
}

export default function BrandPickerModal({ visible, onClose, onSelect, selectedBrandId }: BrandPickerModalProps) {
    const renderBrandItem = ({ item }: { item: typeof BRANDS[0] }) => {
        const isSelected = selectedBrandId === item.id;
        const hasLogo = item.logo && item.logo.length > 0;
        
        return (
            <TouchableOpacity
                style={[
                    styles.item,
                    { backgroundColor: item.color },
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
                    <Text style={styles.brandName}>{item.name}</Text>
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

                    <FlashList
                        data={BRANDS}
                        keyExtractor={(item) => item.id}
                        numColumns={3}
                        contentContainerStyle={styles.listContent}
                        renderItem={renderBrandItem}
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
        height: '50%',
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
});
