import React, { memo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { PROFILE_BIO_BALL } from './profileV2Assets';

interface ProfileBioCardProps {
  bio?: string | null;
  isOwnProfile?: boolean;
  addLabel: string;
  aboutLabel: string;
  onPress?: () => void;
}

const ProfileBioCard = memo(function ProfileBioCard({
  bio,
  isOwnProfile = false,
  addLabel,
  aboutLabel,
  onPress,
}: ProfileBioCardProps) {
  const trimmed = bio?.trim() ?? '';
  if (!trimmed && !isOwnProfile) return null;

  if (!trimmed) {
    return (
      <TouchableOpacity style={styles.empty} onPress={onPress} activeOpacity={0.82}>
        <Text style={styles.emptyText}>{addLabel}</Text>
        <Ionicons name="add" size={24} color="#9E9E9E" />
      </TouchableOpacity>
    );
  }

  const Card = onPress ? TouchableOpacity : View;
  return (
    <Card style={styles.filled} onPress={onPress} activeOpacity={onPress ? 0.88 : 1}>
      <Image source={PROFILE_BIO_BALL} style={styles.ball} contentFit="cover" />
      <LinearGradient
        colors={['rgba(15,8,27,0.18)', 'rgba(22,9,47,0.62)']}
        start={{ x: 1, y: 0.5 }}
        end={{ x: 0, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.copy}>
        <Text style={styles.about}>{aboutLabel}</Text>
        <Text style={styles.bio} numberOfLines={3}>
          {trimmed}
        </Text>
      </View>
    </Card>
  );
});

export default ProfileBioCard;

const styles = StyleSheet.create({
  empty: {
    marginHorizontal: 22,
    marginTop: 16,
    height: 106,
    borderRadius: 16,
    backgroundColor: 'rgba(44,39,55,0.3)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  emptyText: {
    color: '#9E9E9E',
    fontSize: 16,
    fontWeight: '600',
  },
  filled: {
    marginHorizontal: 22,
    marginTop: 16,
    height: 106,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#1B062F',
    justifyContent: 'center',
    paddingHorizontal: 22,
  },
  ball: {
    ...StyleSheet.absoluteFillObject,
  },
  copy: {
    alignSelf: 'flex-end',
    width: '58%',
    gap: 8,
  },
  about: {
    color: '#9D7AEF',
    fontSize: 19,
    fontWeight: '600',
    textAlign: 'right',
  },
  bio: {
    color: '#B1B1B1',
    fontSize: 11,
    textAlign: 'right',
    lineHeight: 16,
  },
});
