import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface MatchEventIconProps {
  type: string;
  detail: string;
  size?: number;
}

export function getMatchEventColor(type: string, detail: string): string {
  if (type === 'Goal') {
    if (/own/i.test(detail)) return '#f97316';
    return '#22c55e';
  }
  if (type === 'Card') {
    if (/red/i.test(detail)) return '#ef4444';
    return '#f59e0b';
  }
  if (type === 'subst') return '#3b82f6';
  if (type === 'Var') return '#a855f7';
  return '#888';
}

export const MatchEventIcon: React.FC<MatchEventIconProps> = ({ type, detail, size = 20 }) => {
  const color = getMatchEventColor(type, detail);

  if (type === 'Card') {
    const isRed = /red/i.test(detail);
    return (
      <View
        style={[
          styles.cardIcon,
          {
            width: size * 0.65,
            height: size * 0.9,
            backgroundColor: isRed ? '#ef4444' : '#facc15',
          },
        ]}
      />
    );
  }

  if (type === 'subst') {
    return (
      <View style={styles.subIcon}>
        <Ionicons name="arrow-down" size={size * 0.55} color="#ef4444" />
        <Ionicons name="arrow-up" size={size * 0.55} color="#22c55e" />
      </View>
    );
  }

  if (type === 'Goal') {
    const isOwn = /own/i.test(detail);
    const isPenalty = /penalty/i.test(detail);
    return (
      <View style={styles.goalWrap}>
        <Ionicons name="football" size={size} color={color} />
        {(isOwn || isPenalty) && (
          <View style={[styles.goalBadge, isOwn && styles.ogBadge]}>
            <Text style={styles.goalBadgeText}>{isOwn ? 'OG' : 'P'}</Text>
          </View>
        )}
      </View>
    );
  }

  if (type === 'Var') {
    return <Ionicons name="tv-outline" size={size} color={color} />;
  }

  return <Ionicons name="ellipse" size={size * 0.5} color={color} />;
};

const styles = StyleSheet.create({
  cardIcon: {
    borderRadius: 2,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.25)',
  },
  subIcon: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 0,
  },
  goalWrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  goalBadge: {
    position: 'absolute',
    bottom: -4,
    right: -8,
    backgroundColor: '#3b82f6',
    borderRadius: 4,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
  ogBadge: {
    backgroundColor: '#f97316',
  },
  goalBadgeText: {
    color: '#fff',
    fontSize: 7,
    fontWeight: '800',
  },
});
