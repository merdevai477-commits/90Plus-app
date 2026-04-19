import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { colors, spacing } from './theme';

type Props = {
  title: string;
  onPressRight?: () => void;
  rightText?: string;
};

const SectionHeader: React.FC<Props> = ({ title, rightText = 'View All', onPressRight }) => {
  return (
    <View style={styles.row}>
      <Text style={styles.title}>{title}</Text>
      {onPressRight && (
        <Pressable onPress={onPressRight}>
          <Text style={styles.link}>{rightText}</Text>
        </Pressable>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.large,
    marginBottom: spacing.medium,
  },
  title: { color: colors.text, fontSize: 20, fontWeight: 'bold' },
  link: { color: colors.green, fontSize: 14, fontWeight: '600' },
});

export default SectionHeader;


