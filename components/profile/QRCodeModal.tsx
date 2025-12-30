import React from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    StyleSheet,
    Dimensions,
    Share,
} from 'react-native';
import { Image } from 'expo-image';
import { X, Share2 } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface QRCodeModalProps {
    visible: boolean;
    onClose: () => void;
    username: string;
    displayName?: string;
    avatar?: string | null;
}

export default function QRCodeModal({
    visible,
    onClose,
    username,
    displayName,
    avatar,
}: QRCodeModalProps) {
    const { t } = useTranslation();
    const profileUrl = `https://90plus.app/@${username}`;
    
    // Use QR Server API to generate QR code
    const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(profileUrl)}&bgcolor=ffffff&color=000000`;

    const handleShare = async () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            await Share.share({
                message: `${t.profile.checkMyProfile} @${username}\n${profileUrl}`,
                url: profileUrl,
            });
        } catch (error) {
            console.error('Error sharing:', error);
        }
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.container}>
                    {/* Header */}
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                            <X size={24} color="#fff" />
                        </TouchableOpacity>
                        <Text style={styles.title}>{t.profile.qrCode}</Text>
                        <View style={{ width: 40 }} />
                    </View>

                    {/* Profile Info */}
                    <View style={styles.profileInfo}>
                        {avatar ? (
                            <Image source={{ uri: avatar }} style={styles.avatar} />
                        ) : (
                            <View style={[styles.avatar, styles.avatarPlaceholder]}>
                                <Text style={styles.avatarText}>{username[0]?.toUpperCase()}</Text>
                            </View>
                        )}
                        <Text style={styles.displayName}>{displayName || username}</Text>
                        <Text style={styles.username}>@{username}</Text>
                    </View>

                    {/* QR Code */}
                    <LinearGradient
                        colors={['rgba(255,215,0,0.2)', 'rgba(255,215,0,0.05)']}
                        style={styles.qrContainer}
                    >
                        <View style={styles.qrWrapper}>
                            <Image
                                source={{ uri: qrCodeUrl }}
                                style={styles.qrImage}
                                contentFit="contain"
                            />
                        </View>
                    </LinearGradient>

                    <Text style={styles.scanText}>{t.profile.scanToFollow}</Text>

                    {/* Actions */}
                    <View style={styles.actions}>
                        <TouchableOpacity style={styles.actionButton} onPress={handleShare}>
                            <Share2 size={20} color="#fff" />
                            <Text style={styles.actionText}>{t.profile.share}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
}

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.95)',
        justifyContent: 'center',
        alignItems: 'center',
    },
    container: {
        backgroundColor: ProfileTheme.colors.deepBlack,
        borderRadius: 24,
        width: SCREEN_WIDTH * 0.9,
        padding: 20,
        borderWidth: 1,
        borderColor: 'rgba(255,215,0,0.3)',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 20,
    },
    closeButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.1)',
        alignItems: 'center',
        justifyContent: 'center',
    },
    title: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    profileInfo: {
        alignItems: 'center',
        marginBottom: 20,
    },
    avatar: {
        width: 60,
        height: 60,
        borderRadius: 30,
        marginBottom: 8,
    },
    avatarPlaceholder: {
        backgroundColor: ProfileTheme.colors.neonGreen,
        alignItems: 'center',
        justifyContent: 'center',
    },
    avatarText: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#000',
    },
    displayName: {
        fontSize: 18,
        fontWeight: '600',
        color: '#fff',
    },
    username: {
        fontSize: 14,
        color: 'rgba(255,255,255,0.5)',
        marginTop: 2,
    },
    qrContainer: {
        alignItems: 'center',
        padding: 20,
        borderRadius: 20,
        marginBottom: 16,
    },
    qrWrapper: {
        padding: 16,
        backgroundColor: '#fff',
        borderRadius: 16,
    },
    qrImage: {
        width: SCREEN_WIDTH * 0.5,
        height: SCREEN_WIDTH * 0.5,
    },
    scanText: {
        textAlign: 'center',
        color: 'rgba(255,255,255,0.6)',
        fontSize: 14,
        marginBottom: 20,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 16,
    },
    actionButton: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.1)',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 25,
    },
    actionText: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
});
