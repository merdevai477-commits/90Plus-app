import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import type { AppPage } from './pageLinks';
import { C } from './theme';

interface Props {
  pages: AppPage[];
  isAr: boolean;
  emptyLabel: string;
  fontFamily: string;
  onPick: (page: AppPage) => void;
}

export const PageSuggestions = memo(function PageSuggestions({ pages, isAr, emptyLabel, fontFamily, onPick }: Props) {
  return (
    <Animated.View entering={FadeInDown.duration(160)} exiting={FadeOutDown.duration(120)} style={styles.box}>
      {!pages.length ? (
        <Text style={[styles.empty, { fontFamily }]}>{emptyLabel}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 220 }}>
          {pages.map((page) => (
            <Pressable key={page.id} onPress={() => onPick(page)} style={[styles.row, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
              <View style={styles.token}>
                <Text style={[styles.tokenText, { fontFamily }]}>/{page.token}</Text>
              </View>
              <Text style={[styles.label, { fontFamily, textAlign: isAr ? 'right' : 'left' }]} numberOfLines={1}>
                {isAr ? page.labelAr : page.labelEn}
              </Text>
            </Pressable>
          ))}
        </ScrollView>
      )}
    </Animated.View>
  );
});

const styles = StyleSheet.create({
  box: {
    backgroundColor: C.input,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.inputBorder,
    overflow: 'hidden',
    marginBottom: 8,
  },
  empty: {
    color: C.muted,
    padding: 14,
    textAlign: 'center',
  },
  row: {
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  token: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 999,
    backgroundColor: 'rgba(139,92,246,0.16)',
  },
  tokenText: {
    color: C.accentSoft,
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    color: C.textStrong,
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
