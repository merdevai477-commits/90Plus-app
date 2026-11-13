import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import BadgeIcon from './BadgeIcon';
import VerifiedBadge from '../profile/VerifiedBadge';
import DeveloperBadge from '../profile/DeveloperBadge';

export interface IdentityBadge {
  key: string;
  title: string;
  accent: string;
  nameAr?: string;
  nameEn?: string;
}

export interface IdentityUser {
  displayName?: string | null;
  username?: string | null;
  isVerified?: boolean;
  isDeveloper?: boolean;
  identity?: {
    isVerified: boolean;
    isDeveloper: boolean;
    badge: IdentityBadge | null;
  } | null;
}

export default function UserIdentity({
  user,
  name,
  variant = 'inline',
  nameStyle,
}: {
  user?: IdentityUser | null;
  name: string;
  variant?: 'inline' | 'comment' | 'leaderboard' | 'profile';
  nameStyle?: object;
}) {
  const verified = user?.identity?.isVerified ?? user?.isVerified;
  const developer = user?.identity?.isDeveloper ?? user?.isDeveloper;
  const badge = user?.identity?.badge ?? null;
  const iconVariant = variant === 'comment' ? 'inline' : variant === 'leaderboard' ? 'leaderboard' : variant === 'profile' ? 'profile' : 'inline';
  const showTitle = variant === 'profile' || variant === 'leaderboard';
  return (
    <View style={styles.row}>
      <Text style={nameStyle} numberOfLines={1}>{name}</Text>
      {verified ? <VerifiedBadge size={14} /> : null}
      {developer ? <DeveloperBadge size={14} /> : null}
      {badge ? <BadgeIcon badgeKey={badge.key} accent={badge.accent} variant={iconVariant as 'inline'} /> : null}
      {showTitle && badge?.title ? <Text style={styles.title} numberOfLines={1}>{badge.title}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, maxWidth: '100%' },
  title: { color: '#f5b942', fontSize: 11, flexShrink: 1 },
});
