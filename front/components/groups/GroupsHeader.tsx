import React from 'react';
import { Pressable, Text, View } from 'react-native';
import { ArrowLeft, ArrowRight, Crown } from 'lucide-react-native';

interface GroupsHeaderProps {
  isRTL: boolean;
  title: string;
  subtitle: string;
  coins: number;
  onBack: () => void;
  styles: any;
}

export function GroupsHeader({ isRTL, title, subtitle, coins, onBack, styles }: GroupsHeaderProps) {
  return (
    <View style={[styles.headerRow, isRTL && styles.rowReverse]}>
      <View style={styles.xpChip}><Text style={styles.xpChipText}>XP {coins}</Text></View>
      <View style={styles.titleWrap}>
        <Crown size={18} color="#F4C542" fill="#F4C542" />
        <Text style={[styles.title, isRTL && styles.rtlText]}>{title}</Text>
        <Text style={[styles.subtitle, isRTL && styles.rtlText]}>{subtitle}</Text>
      </View>
      <Pressable style={styles.backBtn} onPress={onBack}>
        {isRTL ? <ArrowRight size={16} color="#fff" /> : <ArrowLeft size={16} color="#fff" />}
      </Pressable>
    </View>
  );
}
