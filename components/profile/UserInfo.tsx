import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Vibration, Linking } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image } from 'expo-image';
import { Ionicons, FontAwesome } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import VerifiedBadge from './VerifiedBadge';
import DeveloperBadge from './DeveloperBadge';

interface SocialLinks {
    instagram?: string;
    twitter?: string;
    facebook?: string;
}

interface UserInfoProps {
    name: string;
    username: string;
    bio?: string;
    location: string;
    team: string; // "Favorite Team"
    isVerified?: boolean;
    isDeveloper?: boolean;
    onBioLongPress?: () => void;
    onNameLongPress?: () => void;
    clubLogo?: string; // Club logo URL
    onEditPress?: () => void;
    socials?: SocialLinks; // روابط السوشيال ميديا
    consecutiveLoginDays?: number; // أيام تسجيل الدخول المتتالية
}

const UserInfo = memo(function UserInfo({
    name,
    username,
    bio,
    location,
    team,
    isVerified = false,
    isDeveloper = false,
    onBioLongPress,
    onNameLongPress,
    clubLogo,
    onEditPress,
    socials,
    consecutiveLoginDays = 0,
}: UserInfoProps) {

    const handleSocialPress = (url: string) => {
        Linking.openURL(url).catch(err => console.error("Couldn't load page", err));
    };

    // تحقق من وجود أي رابط سوشيال ميديا
    const hasSocials = socials && (socials.instagram || socials.twitter || socials.facebook);
    return (
        <View style={styles.container}>
            {/* 1. Name & Badges */}
            <TouchableOpacity
                onLongPress={() => {
                    if (onNameLongPress) {
                        Vibration.vibrate(50);
                        onNameLongPress();
                    }
                }}
                activeOpacity={0.7}
            >
                <View style={styles.nameRow}>
                    <Text style={styles.name}>{name}</Text>
                    
                    {/* Fire Streak Badge (10+ days) */}
                    {consecutiveLoginDays >= 10 && (
                        <View style={styles.fireStreakBadge}>
                            <LinearGradient
                                colors={['#ff6b35', '#ff8c42', '#ff6b35']}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 1 }}
                                style={styles.fireStreakGradient}
                            >
                                <Text style={styles.fireEmoji}>🔥</Text>
                                <Text style={styles.fireStreakNumber}>{consecutiveLoginDays}</Text>
                            </LinearGradient>
                        </View>
                    )}
                    
                    {isDeveloper && (
                        <View style={styles.badgeContainer}>
                            <DeveloperBadge size={24} />
                        </View>
                    )}
                    {isVerified && !isDeveloper && (
                        <View style={styles.badgeContainer}>
                            <VerifiedBadge size={24} />
                        </View>
                    )}

                    {/* Edit Pen Icon */}
                    <TouchableOpacity
                        onPress={onEditPress}
                        style={styles.editButton}
                        activeOpacity={0.7}
                    >
                        <Ionicons name="pencil" size={16} color="rgba(255,255,255,0.7)" />
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>

            {/* Username */}
            <Text style={styles.username}>@{username}</Text>

            {/* 2. Location & Favorite Team Row (Merged) */}
            <View style={styles.detailsRow}>
                <TouchableOpacity style={styles.detailItem} onPress={onEditPress} activeOpacity={0.7}>
                    <Ionicons name="location-outline" size={16} color={location && location !== 'مصر' ? ProfileTheme.colors.neonGreen : ProfileTheme.colors.textSecondary} />
                    <Text style={[styles.detailText, (!location || location === 'مصر') && styles.detailTextEmpty]}>
                        {location && location !== 'مصر' ? location : 'أضف مدينتك'}
                    </Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.detailItem} onPress={onEditPress} activeOpacity={0.7}>
                    {clubLogo ? (
                        <Image
                            source={{ uri: clubLogo }}
                            style={styles.clubLogo}
                            contentFit="contain"
                            cachePolicy="memory-disk"
                        />
                    ) : (
                        <Ionicons name="football-outline" size={16} color={ProfileTheme.colors.textSecondary} />
                    )}
                    <Text style={[styles.detailText, !team && styles.detailTextEmpty]}>{team || 'اختر ناديك'}</Text>
                </TouchableOpacity>
            </View>

            {/* 3. Bio with Social Links (Combined) */}
            <View style={styles.bioSection}>
                <TouchableOpacity
                    onLongPress={() => {
                        if (onBioLongPress) {
                            Vibration.vibrate(50); // Haptic feedback
                            onBioLongPress();
                        }
                    }}
                    onPress={onEditPress}
                    activeOpacity={0.7}
                    style={styles.bioContainer}
                >
                    <Text style={[styles.bio, !bio && styles.bioEmpty]}>
                        {bio || 'أضف نبذة عنك...'}
                    </Text>
                </TouchableOpacity>

                {/* Social Links - تظهر بجانب البايو */}
                {hasSocials && (
                    <View style={styles.socialRow}>
                        {socials?.instagram && (
                            <TouchableOpacity onPress={() => handleSocialPress(socials.instagram!)} style={styles.socialIcon}>
                                <LinearGradient
                                    colors={['#833AB4', '#FD1D1D', '#FCAF45']}
                                    style={styles.socialGradient}
                                >
                                    <FontAwesome name="instagram" size={16} color="white" />
                                </LinearGradient>
                            </TouchableOpacity>
                        )}

                        {socials?.twitter && (
                            <TouchableOpacity onPress={() => handleSocialPress(socials.twitter!)} style={styles.socialIcon}>
                                <View style={[styles.socialGradient, { backgroundColor: '#000' }]}>
                                    <FontAwesome name="twitter" size={16} color="#1DA1F2" />
                                </View>
                            </TouchableOpacity>
                        )}

                        {socials?.facebook && (
                            <TouchableOpacity onPress={() => handleSocialPress(socials.facebook!)} style={styles.socialIcon}>
                                <View style={[styles.socialGradient, { backgroundColor: '#1877F2' }]}>
                                    <FontAwesome name="facebook" size={16} color="white" />
                                </View>
                            </TouchableOpacity>
                        )}
                    </View>
                )}
            </View>
        </View >
    );
});

export default UserInfo;

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 20,
        marginBottom: 20,
        alignItems: 'center',
    },
    nameRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        marginBottom: 4,
    },
    name: {
        fontSize: 26,
        fontWeight: '800', // Used 800 instead of bold
        color: ProfileTheme.colors.textPrimary,
        textShadowColor: 'rgba(255,255,255,0.2)', // Much softer glow
        textShadowOffset: { width: 0, height: 2 },
        textShadowRadius: 8,
        letterSpacing: 0.5,
    },
    badgeContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    username: {
        fontSize: 15,
        color: ProfileTheme.colors.textSecondary,
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: 0.5,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 16,
        gap: 12,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        backgroundColor: 'rgba(255,255,255,0.06)', // Glassmorphism base
        paddingHorizontal: 16, // Increased padding
        paddingVertical: 10,  // Increased padding
        borderRadius: 20, // More rounded pills
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.12)', // Subtle border
    },
    detailText: {
        color: ProfileTheme.colors.textPrimary,
        fontSize: 14,
        fontWeight: '600',
    },
    detailTextEmpty: {
        color: 'rgba(255,255,255,0.4)',
        fontWeight: '500',
    },
    clubLogo: {
        width: 18,
        height: 18,
    },
    bioSection: {
        width: '100%',
        alignItems: 'center',
        marginTop: 4,
    },
    bioContainer: {
        alignItems: 'center',
        padding: 8,
        marginBottom: 12,
        backgroundColor: 'transparent',
        borderRadius: 12,
    },
    bio: {
        fontSize: 15,
        color: 'rgba(255,255,255,0.9)',
        lineHeight: 24,
        textAlign: 'center',
        maxWidth: '90%',
    },
    bioEmpty: {
        color: 'rgba(255,255,255,0.3)',
        fontStyle: 'italic',
    },
    bioHint: {
        fontSize: 10,
        color: 'rgba(255,255,255,0.3)',
        marginTop: 4,
    },
    editButton: {
        backgroundColor: 'rgba(255,255,255,0.1)',
        padding: 6,
        borderRadius: 20,
        marginLeft: 8,
    },
    socialRow: {
        flexDirection: 'row',
        gap: 12,
        justifyContent: 'center',
        alignItems: 'center',
        flexWrap: 'wrap',
    },
    socialIcon: {
        width: 32,
        height: 32,
        borderRadius: 16,
        overflow: 'hidden',
    },
    socialGradient: {
        width: '100%',
        height: '100%',
        justifyContent: 'center',
        alignItems: 'center',
    },
    // Fire Streak Badge (10+ days)
    fireStreakBadge: {
        marginLeft: 8,
        marginRight: 8,
    },
    fireStreakGradient: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 16,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.3)',
        shadowColor: '#ff6b35',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.5,
        shadowRadius: 8,
        elevation: 6,
        gap: 4,
    },
    fireEmoji: {
        fontSize: 18,
    },
    fireStreakNumber: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '800',
        textShadowColor: 'rgba(0,0,0,0.3)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 2,
    },
});
