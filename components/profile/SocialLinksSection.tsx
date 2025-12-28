import React from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Linking,
} from 'react-native';
import { FontAwesome, Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import { useTranslation } from '../../src/i18n';
import * as Haptics from 'expo-haptics';

// Social media icons with proper FontAwesome icons
interface SocialIconConfig {
    icon: keyof typeof FontAwesome.glyphMap | keyof typeof Ionicons.glyphMap;
    iconLibrary: 'FontAwesome' | 'Ionicons';
    color: string;
}

const SOCIAL_ICONS: Record<string, SocialIconConfig> = {
    instagram: { icon: 'instagram', iconLibrary: 'FontAwesome', color: '#E4405F' },
    twitter: { icon: 'twitter', iconLibrary: 'FontAwesome', color: '#1DA1F2' },
    tiktok: { icon: 'musical-notes', iconLibrary: 'Ionicons', color: '#FFFFFF' }, // White for better visibility on dark background
    youtube: { icon: 'youtube-play', iconLibrary: 'FontAwesome', color: '#FF0000' },
    facebook: { icon: 'facebook', iconLibrary: 'FontAwesome', color: '#1877F2' },
    snapchat: { icon: 'snapchat', iconLibrary: 'FontAwesome', color: '#FFFC00' },
    linkedin: { icon: 'linkedin', iconLibrary: 'FontAwesome', color: '#0A66C2' },
    website: { icon: 'globe', iconLibrary: 'Ionicons', color: '#22c55e' },
};

interface SocialLink {
    platform: string;
    url: string;
    username?: string;
}

interface SocialLinksSectionProps {
    links: SocialLink[];
    isOwnProfile?: boolean;
    onEditPress?: () => void;
}

export default function SocialLinksSection({
    links,
    isOwnProfile = false,
    onEditPress,
}: SocialLinksSectionProps) {
    const { t } = useTranslation();

    const handleLinkPress = async (link: SocialLink) => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        try {
            const canOpen = await Linking.canOpenURL(link.url);
            if (canOpen) {
                await Linking.openURL(link.url);
            }
        } catch (error) {
            console.error('Error opening link:', error);
        }
    };

    if (links.length === 0 && !isOwnProfile) {
        return null;
    }

    return (
        <View style={styles.container}>
            {links.length > 0 ? (
                <View style={styles.linksRow}>
                    {links.map((link, index) => {
                        const social = SOCIAL_ICONS[link.platform.toLowerCase()] || SOCIAL_ICONS.website;
                        const IconComponent = social.iconLibrary === 'FontAwesome' ? FontAwesome : Ionicons;
                        return (
                            <TouchableOpacity
                                key={index}
                                style={[styles.linkButton, { borderColor: social.color }]}
                                onPress={() => handleLinkPress(link)}
                                activeOpacity={0.7}
                            >
                                <IconComponent
                                    name={social.icon as any}
                                    size={20}
                                    color={social.color}
                                />
                            </TouchableOpacity>
                        );
                    })}
                    {isOwnProfile && links.length < 5 && (
                        <TouchableOpacity
                            style={styles.addButton}
                            onPress={onEditPress}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.addIcon}>+</Text>
                        </TouchableOpacity>
                    )}
                </View>
            ) : isOwnProfile ? (
                <TouchableOpacity
                    style={styles.emptyContainer}
                    onPress={onEditPress}
                    activeOpacity={0.7}
                >
                    <Text style={styles.emptyText}>{t.profile.addSocialLinks}</Text>
                </TouchableOpacity>
            ) : null}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginTop: 4,
        marginBottom: 12,
    },
    linksRow: {
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 10,
        flexWrap: 'wrap',
        alignItems: 'center',
    },
    linkButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.08)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1.5,
    },
    addButton: {
        width: 44,
        height: 44,
        borderRadius: 22,
        backgroundColor: 'rgba(255,255,255,0.05)',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.2)',
        borderStyle: 'dashed',
    },
    addIcon: {
        fontSize: 24,
        color: 'rgba(255,255,255,0.4)',
    },
    emptyContainer: {
        alignItems: 'center',
        paddingVertical: 12,
    },
    emptyText: {
        color: 'rgba(255,255,255,0.4)',
        fontSize: 13,
    },
});
