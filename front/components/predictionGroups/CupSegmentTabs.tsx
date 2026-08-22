/**
 * In-page segmented tabs: Matches | Standings.
 */

import { MaterialCommunityIcons } from '@expo/vector-icons';
import { BarChart3 } from 'lucide-react-native';
import React from 'react';
import { Pressable, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { PG, PG_GRADIENTS, PG_RADII, usePGFonts } from './theme';

export type CupTabKey = 'matches' | 'standings';

export function CupSegmentTabs({
  isRTL,
  active,
  matchesLabel,
  standingsLabel,
  onChange,
}: {
  isRTL: boolean;
  active: CupTabKey;
  matchesLabel: string;
  standingsLabel: string;
  onChange: (key: CupTabKey) => void;
}) {
  const { bold } = usePGFonts();
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const item = (key: CupTabKey, label: string, icon: React.ReactNode) => {
    const on = active === key;
    const inner = (
      <View style={[styles.itemInner, row]}>
        {icon}
        <Text style={[styles.label, { fontFamily: bold, color: on ? '#fff' : PG.textMuted }]}>{label}</Text>
      </View>
    );
    return (
      <Pressable key={key} onPress={() => onChange(key)} style={styles.item}>
        {on ? (
          <LinearGradient colors={[...PG_GRADIENTS.purple]} style={styles.active}>
            {inner}
          </LinearGradient>
        ) : (
          inner
        )}
      </Pressable>
    );
  };

  return (
    <View style={[styles.shell, row]}>
      {item(
        'matches',
        matchesLabel,
        <MaterialCommunityIcons name="soccer" size={16} color={active === 'matches' ? '#fff' : PG.textMuted} />,
      )}
      {item(
        'standings',
        standingsLabel,
        <BarChart3 size={16} color={active === 'standings' ? '#fff' : PG.textMuted} />,
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shell: {
    marginHorizontal: 16,
    marginTop: 14,
    padding: 4,
    borderRadius: PG_RADII.lg,
    backgroundColor: PG.card,
    borderWidth: 1,
    borderColor: PG.border,
  },
  item: { flex: 1 },
  active: { borderRadius: PG_RADII.md },
  itemInner: {
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    minHeight: 40,
  },
  label: { fontSize: 13 },
});
