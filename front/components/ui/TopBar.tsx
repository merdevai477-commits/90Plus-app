import React from 'react';
import { View, StyleSheet, Pressable, Text } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';

type Props = {
  title?: string;
  onSearch?: () => void;
  onBell?: () => void;
  onMenu?: () => void;
};

const IconButton: React.FC<{ onPress?: () => void; children: React.ReactNode }>
  = ({ onPress, children }) => (
  <Pressable onPress={onPress} style={({ pressed }) => [styles.iconBtn, pressed && styles.pressed]}>
    {children}
  </Pressable>
);

const TopBar: React.FC<Props> = ({ title = 'Football Hub', onSearch, onBell, onMenu }) => {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <IconButton onPress={onSearch}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path fill="#ffffff" d="M10 2a8 8 0 1 1 0 16 8 8 0 0 1 0-16zm11 19-5.1-5.1" stroke="#ffffff" strokeWidth={2} strokeLinecap="round"/>
          </Svg>
        </IconButton>
        <IconButton onPress={onBell}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path fill="#ffffff" d="M12 22a2 2 0 0 0 2-2H10a2 2 0 0 0 2 2zm7-6V11a7 7 0 1 0-14 0v5l-2 2v1h18v-1l-2-2z"/>
            <Circle cx={18} cy={6} r={3} fill="#ff3b30"/>
          </Svg>
        </IconButton>
        <IconButton onPress={onMenu}>
          <Svg width={20} height={20} viewBox="0 0 24 24">
            <Path fill="#ffffff" d="M3 4h6v6H3zM3 14h6v6H3zM13 4h8v6h-8zM13 14h8v6h-8z"/>
          </Svg>
        </IconButton>
      </View>
      <IconButton onPress={onMenu}>
        <Svg width={0} height={0} />
      </IconButton>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
  },
  title: { color: '#34C759', fontWeight: '800', fontSize: 20 },
  iconBtn: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: '#1C1C1E',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#2C2C2E',
  },
  pressed: {
    opacity: 0.9,
    transform: [{ scale: 0.98 }],
  },
});

export default TopBar;


