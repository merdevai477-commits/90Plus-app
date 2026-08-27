/**
 * "أضف جائزتك" floating action button — Figma `Component 13` (`650:5269`).
 *
 * The component set has two variants and the sponsor hub (`624:4349`)
 * instantiates the **icon-only** one, `Frame 385`: a 78×76 radius-53 button
 * carrying the 5-stop 90° gradient at 0.81 alpha, a 36px `mingcute:gift-fill`
 * glyph and an `inset 0 -3px 4px rgba(0,0,0,0.25)` shadow. Its position in that
 * frame puts it 33 from the right edge and 46 from the bottom.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import { IconGiftFill } from './icons';
import { PW_GRADIENTS, PW_RADII, usePWScale } from './theme';

const INSET_SHADOW = 'inset 0px -3px 4px rgba(0,0,0,0.25)';

/** Figma geometry, in 448-artboard units. */
const FAB = { width: 78, height: 76, icon: 36, right: 46, bottom: 90 } as const;

export function AddPrizeFab({ onPress, bottom }: { onPress: () => void; bottom?: number }) {
  const { s } = usePWScale();
  const insets = useSafeAreaInsets();
  const { t } = useTranslation();

  const edge = Math.max(s(FAB.right), insets.right + s(8));
  const bottomOffset = bottom ?? insets.bottom + s(FAB.bottom);
  const fabSize = Math.max(44, s(FAB.width));

  /**
   * Figma pins this control to the physical right in both languages. Absolute
   * `right:` alone is not enough on devices where native RTL mirroring is still
   * active — RN swaps `left`/`right` under the hood and the button lands on the
   * visual left. A full-width LTR strip with `alignItems: 'flex-end'` pins the
   * pill to the physical right regardless of `I18nManager.isRTL`.
   */
  return (
    <View
      pointerEvents="box-none"
      testID="pw-add-prize-fab-strip"
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: bottomOffset,
        direction: 'ltr',
        alignItems: 'flex-end',
        paddingRight: edge,
      }}
    >
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={t.predictAndWin.addPrize}
        hitSlop={8}
        style={({ pressed }) => ({
          opacity: pressed ? 0.9 : 1,
          transform: [{ scale: pressed ? 0.96 : 1 }],
        })}
      >
        <LinearGradient
          colors={[...PW_GRADIENTS.fab]}
          locations={[...PW_GRADIENTS.fabLocations]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            width: fabSize,
            height: Math.max(44, s(FAB.height)),
            borderRadius: s(PW_RADII.fab),
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: INSET_SHADOW,
          }}
        >
          <IconGiftFill width={s(FAB.icon)} height={s(FAB.icon)} />
        </LinearGradient>
      </Pressable>
    </View>
  );
}
