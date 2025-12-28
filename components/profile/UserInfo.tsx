import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ProfileTheme } from '../../constants/ProfileTheme';
import VerifiedBadge from './VerifiedBadge';
import DeveloperBadge from './DeveloperBadge';

interface UserInfoProps {
    name: string;
    username: string;
    bio: string;
    location: string;
    joinDate: string;
    role: string;
    team: string;
}

export default function UserInfo({
    name,
    username,
    bio,
    location,
    joinDate,
    role,
    team,
}: UserInfoProps) {
    return (
        <View style={styles.container}>
            <View style={styles.nameRow}>
                <Text style={styles.name}>{name}</Text>
                <View style={styles.badgeContainer}>
                    <VerifiedBadge size={24} />
                </View>
                <View style={styles.badgeContainer}>
                    <DeveloperBadge size={24} />
                </View>
            </View>
            <Text style={styles.username}>@{username}</Text>

            <Text style={styles.bio}>{bio}</Text>

            <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <Ionicons name="location-outline" size={16} color={ProfileTheme.colors.textSecondary} />
                    <Text style={styles.detailText}>{location}</Text>
                </View>
                <View style={styles.detailItem}>
                    <Ionicons name="calendar-outline" size={16} color={ProfileTheme.colors.textSecondary} />
                    <Text style={styles.detailText}>{joinDate}</Text>
                </View>
            </View>

            <View style={styles.detailsRow}>
                <View style={styles.detailItem}>
                    <Ionicons name="shield-outline" size={16} color={ProfileTheme.colors.neonPurple} />
                    <Text style={styles.detailText}>{role}</Text>
                </View>
                <View style={styles.detailItem}>
                    <Ionicons name="football-outline" size={16} color={ProfileTheme.colors.neonGreen} />
                    <Text style={styles.detailText}>{team}</Text>
                </View>
            </View>
        </View>
    );
}

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
        fontSize: 28,
        fontWeight: 'bold',
        color: ProfileTheme.colors.textPrimary,
        textShadowColor: ProfileTheme.colors.neonBlue,
        textShadowOffset: { width: 0, height: 0 },
        textShadowRadius: 10,
    },
    badgeContainer: {
        justifyContent: 'center',
        alignItems: 'center',
    },
    username: {
        fontSize: 16,
        color: ProfileTheme.colors.textSecondary,
        marginBottom: 16,
        textAlign: 'center',
        letterSpacing: 1,
    },
    bio: {
        fontSize: 16,
        color: '#DDD',
        marginBottom: 20,
        lineHeight: 24,
        textAlign: 'center',
        textShadowColor: 'rgba(0,0,0,0.5)',
        textShadowOffset: { width: 1, height: 1 },
        textShadowRadius: 2,
    },
    detailsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 12,
        gap: 20,
    },
    detailItem: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        backgroundColor: 'rgba(255,255,255,0.05)',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
    },
    detailText: {
        color: ProfileTheme.colors.textSecondary,
        fontSize: 14,
        fontWeight: '500',
    },
});
