/**
 * Disclaimer Banner Component
 * Apple Compliance: Show disclaimer about trademarks and coins
 */

import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export default function DisclaimerBanner() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>
        90Plus is an independent fan community. Not affiliated with any football clubs or organizations. Coins are free and earned through gameplay only.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF3CD',
    padding: 12,
    borderRadius: 8,
    marginHorizontal: 16,
    marginVertical: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FFC107',
  },
  text: {
    fontSize: 12,
    color: '#856404',
    textAlign: 'center',
    lineHeight: 16,
  },
});
