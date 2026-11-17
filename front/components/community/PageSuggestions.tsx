import React, { memo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeOutDown } from 'react-native-reanimated';

import { useCommunityTheme } from '../../hooks/useCommunityTheme';
import type { AppPage } from './pageLinks';

interface Props {
  pages: AppPage[];
  isAr: boolean;
  emptyLabel: string;
  fontFamily: string;
  onPick: (page: AppPage) => void;
}

export const PageSuggestions = memo(function PageSuggestions({ pages, isAr, emptyLabel, fontFamily, onPick }: Props) {
  const { colors } = useCommunityTheme();
  return (
    <Animated.View
      entering={FadeInDown.duration(160)}
      exiting={FadeOutDown.duration(120)}
      style={[styles.box, { backgroundColor: colors.input, borderColor: colors.inputBorder }]}
    >
      {!pages.length ? (
        <Text style={[styles.empty, { fontFamily, color: colors.muted }]}>{emptyLabel}</Text>
      ) : (
        <ScrollView keyboardShouldPersistTaps="always" style={{ maxHeight: 220 }}>
          {pages.map((page) => (
            <Pressable key={page.id} onPress={() => onPick(page)} style={[styles.row, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
              <View style={[styles.token, { backgroundColor: colors.chipBg }]}>
                <Text style={[styles.tokenText, { fontFamily, color: colors.accentSoft }]}>{page.insert ?? `/${page.token}`}</Text>
              </View>
              <Text
                style={[styles.label, { fontFamily, textAlign: isAr ? 'right' : 'left', color: colors.textStrong }]}
                numberOfLines={1}
              >
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
    borderRadius: 16,
    borderWidth: 1,
    overflow: 'hidden',
    marginBottom: 8,
  },
  empty: {
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
  },
  tokenText: {
    fontSize: 12,
    fontWeight: '700',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
});
