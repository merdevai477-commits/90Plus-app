import React, { useState } from 'react';
import { StyleSheet, Text, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

/** Scorer lines shown per team before the list collapses behind "View more". */
export const SCORERS_PREVIEW_COUNT = 3;

type Scorer = { name: string; minute: string };

export function useCollapsibleScorers(home: Scorer[], away: Scorer[]) {
  const [expanded, setExpanded] = useState(false);
  const collapsible = Math.max(home.length, away.length) > SCORERS_PREVIEW_COUNT;
  const showAll = expanded || !collapsible;
  return {
    home: showAll ? home : home.slice(0, SCORERS_PREVIEW_COUNT),
    away: showAll ? away : away.slice(0, SCORERS_PREVIEW_COUNT),
    collapsible,
    expanded,
    toggle: () => setExpanded((v) => !v),
  };
}

export function ScorersViewMoreButton({
  expanded,
  onPress,
  viewMoreLabel,
  viewLessLabel,
  compact = false,
}: {
  expanded: boolean;
  onPress: () => void;
  viewMoreLabel: string;
  viewLessLabel: string;
  compact?: boolean;
}) {
  return (
    <TouchableOpacity
      style={[styles.button, compact && styles.buttonCompact]}
      onPress={onPress}
      activeOpacity={0.75}
      hitSlop={8}
      accessibilityRole="button"
      accessibilityState={{ expanded }}
    >
      <Text style={[styles.label, compact && styles.labelCompact]}>
        {expanded ? viewLessLabel : viewMoreLabel}
      </Text>
      <Ionicons name={expanded ? 'chevron-up' : 'chevron-down'} size={compact ? 12 : 14} color="#b363ff" />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 12,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 41,
    borderWidth: 1,
    borderColor: '#370565',
    backgroundColor: 'rgba(55,5,101,0.25)',
  },
  buttonCompact: {
    marginTop: 0,
    marginBottom: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  label: {
    color: '#b363ff',
    fontSize: 12,
    fontWeight: '600',
  },
  labelCompact: {
    fontSize: 11,
  },
});
