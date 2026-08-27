/**
 * Gradient-filled text, for Figma's `bg-clip-text` runs:
 *   "VS"            #a855f7 → #633291  (`692:1703`, `640:4649`)
 *   "تعديل الجائزة"  #976bf9 → #430bc5  (`696:2398`)
 *
 * Uses the same MaskedView + LinearGradient pattern already in the app
 * (`components/chat/LimitReachedMessage.tsx`).
 */

import MaskedView from '@react-native-masked-view/masked-view';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Platform, Text, View, type StyleProp, type TextStyle } from 'react-native';

export function PWGradientText({
  children,
  colors,
  style,
}: {
  children: string;
  colors: readonly [string, string];
  style?: StyleProp<TextStyle>;
}) {
  // MaskedView + LinearGradient unmounts have crashed Android Fabric with
  // `addViewAt: failed to insert view` / "child already has a parent" — the
  // exact overlay shown when Publish left the review screen. Solid fill on
  // Android keeps the same type color without that native view.
  if (Platform.OS === 'android') {
    return <Text style={[style, { color: colors[0] }]}>{children}</Text>;
  }

  const label = <Text style={style}>{children}</Text>;
  return (
    <View collapsable={false}>
      <MaskedView maskElement={label} androidRenderingMode="software">
        <LinearGradient colors={[...colors]} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}>
          <Text style={[style, { opacity: 0 }]}>{children}</Text>
        </LinearGradient>
      </MaskedView>
    </View>
  );
}
