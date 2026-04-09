import React from 'react';
import type { TextStyle, ViewStyle } from 'react-native';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ImageBackground, Dimensions, DimensionValue } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

interface PositionPickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelect: (position: string) => void;
    selectedPosition?: string;
}

const POSITIONS: Array<{ code: string; name: string; x: DimensionValue; y: DimensionValue }> = [
    { code: 'ST', name: 'Striker', x: '50%', y: '15%' },
    { code: 'LW', name: 'Left Wing', x: '20%', y: '20%' },
    { code: 'RW', name: 'Right Wing', x: '80%', y: '20%' },
    { code: 'CAM', name: 'Center Attacking Mid', x: '50%', y: '35%' },
    { code: 'LM', name: 'Left Mid', x: '20%', y: '45%' },
    { code: 'RM', name: 'Right Mid', x: '80%', y: '45%' },
    { code: 'CM', name: 'Center Mid', x: '50%', y: '50%' },
    { code: 'CDM', name: 'Center Def Mid', x: '50%', y: '65%' },
    { code: 'LB', name: 'Left Back', x: '15%', y: '75%' },
    { code: 'RB', name: 'Right Back', x: '85%', y: '75%' },
    { code: 'CB', name: 'Center Back', x: '50%', y: '80%' },
    { code: 'GK', name: 'Goalkeeper', x: '50%', y: '92%' },
];

export default function PositionPickerModal({ visible, onClose, onSelect, selectedPosition }: PositionPickerModalProps) {
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
                        <Text style={styles.title}>اختر المركز</Text>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <Ionicons name="close" size={24} color="#FFF" />
                        </TouchableOpacity>
                    </View>

                    {/* Pitch Container */}
                    <View style={styles.pitchContainer}>
                        <View style={styles.pitch}>
                            {/* Grass Gradient */}
                            <LinearGradient
                                colors={['#1a4d2e', '#2d6a4f', '#1a4d2e']}
                                style={StyleSheet.absoluteFill}
                            />

                            {/* Pitch Lines */}
                            <View style={styles.pitchBorder} />
                            <View style={styles.centerLine} />
                            <View style={styles.centerCircle} />
                            <View style={[styles.penaltyArea, styles.topPenalty]} />
                            <View style={[styles.penaltyArea, styles.bottomPenalty]} />

                            {/* Position Dots */}
                            {POSITIONS.map((pos) => (
                                <TouchableOpacity
                                    key={pos.code}
                                    style={[
                                        styles.positionDot,
                                        { left: pos.x, top: pos.y },
                                        selectedPosition === pos.code && styles.selectedDot
                                    ]}
                                    onPress={() => {
                                        onSelect(pos.code);
                                        onClose();
                                    }}
                                >
                                    <View style={[
                                        styles.dotInner,
                                        selectedPosition === pos.code && { backgroundColor: '#22c55e' }
                                    ]}>
                                        <Text style={styles.positionText}>{pos.code}</Text>
                                    </View>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create<{
    container: ViewStyle;
    content: ViewStyle;
    header: ViewStyle;
    title: TextStyle;
    closeButton: ViewStyle;
    pitchContainer: ViewStyle;
    pitch: ViewStyle;
    pitchBorder: ViewStyle;
    centerLine: ViewStyle;
    centerCircle: ViewStyle;
    penaltyArea: ViewStyle;
    topPenalty: ViewStyle;
    bottomPenalty: ViewStyle;
    positionDot: ViewStyle;
    dotInner: ViewStyle;
    selectedDot: ViewStyle;
    positionText: TextStyle;
}>({
    container: {
        flex: 1,
        justifyContent: 'flex-end',
        backgroundColor: 'rgba(0,0,0,0.5)',
    },
    content: {
        backgroundColor: '#1E1E1E',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        height: '85%',
        padding: 20,
        elevation: 5,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: 'rgba(255,255,255,0.1)',
        paddingBottom: 15,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: '#FFF',
        flex: 1,
        textAlign: 'center',
    },
    closeButton: {
        padding: 4,
        backgroundColor: 'rgba(255,255,255,0.1)',
        borderRadius: 20,
    },
    pitchContainer: {
        flex: 1,
        borderRadius: 12,
        overflow: 'hidden',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    pitch: {
        flex: 1,
        position: 'relative',
    },
    pitchBorder: {
        ...StyleSheet.absoluteFillObject,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        margin: 10,
    },
    centerLine: {
        position: 'absolute',
        top: '50%',
        left: 10,
        right: 10,
        height: 2,
        backgroundColor: 'rgba(255,255,255,0.3)',
    },
    centerCircle: {
        position: 'absolute',
        top: '50%',
        left: '50%',
        width: 60,
        height: 60,
        marginLeft: -30,
        marginTop: -30,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        borderRadius: 30,
    },
    penaltyArea: {
        position: 'absolute',
        left: '30%',
        right: '30%',
        height: '15%',
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
    },
    topPenalty: {
        top: 10,
        borderTopWidth: 0,
    },
    bottomPenalty: {
        bottom: 10,
        borderBottomWidth: 0,
    },
    positionDot: {
        position: 'absolute',
        transform: [{ translateX: -20 }, { translateY: -20 }],
        width: 40,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    dotInner: {
        width: 36,
        height: 36,
        borderRadius: 18,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: '#FFF',
    },
    selectedDot: {
        transform: [{ translateX: -25 }, { translateY: -25 }, { scale: 1.2 }],
    },
    positionText: {
        color: '#FFF',
        fontWeight: 'bold',
        fontSize: 12,
    },
});
