/**
 * "اختر فئة الجائزة" grid — Figma `665:5767` (screen `658:5475`).
 *
 * 412 wide at x17, 2 columns × 5 rows, gap-x 8 / gap-y 16, cell 202×99.
 * Cell: gradient #0c051a → #07040d, 1px #1a0b28, radius 16, px 15, py 16,
 * gap 9, text column (w104, Bold 13 white + Regular 10 #cbcbcb) with a 64px
 * medallion (radius 42, #2b0450 → #120320, 1px #4b0989) holding a 49px
 * illustration.
 *
 * The ten illustrations are the Figma exports, bundled under
 * `assets/images/prize-categories` and keyed by `PrizeCategory.key` so the list
 * stays server-driven; a category whose `icon` is a URL renders that instead.
 */

import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';

import type { PrizeCategoryInfo } from '../../services/competitions.service';
import { usePWLocalize } from './localize';
import { PW, PW_GRADIENTS, PW_RADII, usePWDirection, usePWFonts, usePWScale } from './theme';

/** Figma category artwork, keyed by `PrizeCategory.key`. */
const CATEGORY_ART: Record<string, ImageSourcePropType> = {
  sportswear: require('../../assets/images/prize-categories/sportswear.png'),
  tickets: require('../../assets/images/prize-categories/tickets.png'),
  cash: require('../../assets/images/prize-categories/cash.png'),
  food: require('../../assets/images/prize-categories/food.png'),
  vouchers: require('../../assets/images/prize-categories/vouchers.png'),
  electronics: require('../../assets/images/prize-categories/electronics.png'),
  fitness: require('../../assets/images/prize-categories/fitness.png'),
  'football-gear': require('../../assets/images/prize-categories/football-gear.png'),
  gaming: require('../../assets/images/prize-categories/gaming.png'),
  other: require('../../assets/images/prize-categories/other.png'),
};

export function CategoryMedallion({
  category,
  size = 64,
  artSize = 49,
}: {
  category: PrizeCategoryInfo;
  size?: number;
  artSize?: number;
}) {
  const { s } = usePWScale();

  /**
   * Artwork resolution, in order:
   *
   *  1. `PrizeCategory.icon` — an absolute URL, normally one produced by
   *     `POST /api/upload/competition-asset` and stored through the admin
   *     category endpoint. This is the whole mechanism: category art reuses the
   *     app's one upload surface and its R2 URLs, and needs nothing of its own.
   *  2. the bundled Figma illustration for the row's `key`;
   *  3. the generic `other` illustration.
   *
   * A relative path is deliberately *not* treated as remote — the native image
   * loaders cannot resolve one, and Android renders nothing at all rather than
   * failing visibly, which is exactly how a medallion ends up empty.
   */
  const bundled = CATEGORY_ART[category.key] ?? CATEGORY_ART.other;
  const remote =
    category.icon && /^https?:\/\//i.test(category.icon.trim()) ? category.icon.trim() : null;

  /**
   * A remote URL that 404s, times out, or is served over cleartext on a device
   * that blocks it would otherwise leave a permanently blank medallion. Falling
   * back keeps the grid readable instead of hiding the failure behind a hole.
   */
  const [remoteFailed, setRemoteFailed] = React.useState(false);
  React.useEffect(() => setRemoteFailed(false), [remote]);

  const useRemote = remote !== null && !remoteFailed;
  const art = useRemote ? { uri: remote as string } : bundled;

  return (
    <LinearGradient
      colors={[...PW_GRADIENTS.medallion]}
      style={{
        width: s(size),
        height: s(size),
        borderRadius: s(PW_RADII.medallion),
        borderWidth: 1,
        borderColor: PW.medallionBorder,
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <Image
        source={art}
        style={{ width: s(artSize), height: s(artSize) }}
        // The illustrations are transparent PNGs that carry their own padding;
        // `cover` cropped their edges inside the medallion.
        contentFit="contain"
        transition={120}
        // The bundled art is the placeholder while a remote icon loads, so the
        // medallion is never empty even on a slow connection.
        placeholder={useRemote ? bundled : undefined}
        placeholderContentFit="contain"
        onError={useRemote ? () => setRemoteFailed(true) : undefined}
        // Keyed on what is actually being drawn: recycling a row that swapped
        // from remote to bundled art must not reuse the failed remote texture.
        recyclingKey={`${category.key}:${useRemote ? 'remote' : 'bundled'}`}
        accessibilityIgnoresInvertColors
      />
    </LinearGradient>
  );
}

/**
 * Figma lays the grid out at a fixed 412 inside the 448 artboard. Below the
 * `MIN_SCALE` clamp (≈320pt viewports) that scales to 321pt and would overflow,
 * so the width is capped to what the viewport actually offers and the cells are
 * derived from it — keeping the designed 2-up proportions at every size.
 */
export function usePWGridMetrics() {
  const { s, width } = usePWScale();
  const gridWidth = Math.min(s(412), width - s(34));
  const cellWidth = (gridWidth - s(8)) / 2;
  return { gridWidth, cellWidth };
}

export function PrizeCategoryGrid({
  categories,
  selectedId,
  onSelect,
}: {
  categories: PrizeCategoryInfo[];
  selectedId: string | null;
  onSelect: (category: PrizeCategoryInfo) => void;
}) {
  const { s, f } = usePWScale();
  const { bold, regular } = usePWFonts();
  const dir = usePWDirection();
  const { categoryName, categoryDescription } = usePWLocalize();
  const { gridWidth, cellWidth } = usePWGridMetrics();

  return (
    <View
      style={[
        styles.grid,
        // Figma's DOM order is Arabic reading order, so the first category is
        // the top-*right* cell. Reversing in LTR puts it top-left instead.
        { width: gridWidth, columnGap: s(8), rowGap: s(16), flexDirection: dir.row },
      ]}
    >
      {categories.map((category) => {
        const isSelected = category.id === selectedId;
        return (
          <Pressable
            key={category.id}
            onPress={() => onSelect(category)}
            accessibilityRole="button"
            accessibilityLabel={categoryName(category)}
            accessibilityState={{ selected: isSelected }}
            style={{ width: cellWidth }}
          >
            <LinearGradient
              colors={[...PW_GRADIENTS.cell]}
              style={{
                // English copy runs longer than the Arabic the 99pt cell was
                // sized against, so the design height is a floor — a fixed
                // height clipped the third description line.
                minHeight: s(99),
                borderRadius: s(PW_RADII.cell),
                borderWidth: 1,
                borderColor: isSelected ? PW.medallionBorder : PW.cellBorder,
                paddingHorizontal: s(15),
                paddingVertical: s(16),
                flexDirection: dir.rowReverse,
                alignItems: 'flex-start',
                justifyContent: 'flex-end',
                gap: s(9),
              }}
            >
              {/* Figma fixes this column at 104; flexing it keeps the medallion
                  intact when the cell narrows on small viewports. */}
              <View style={{ flex: 1, gap: s(6), alignItems: dir.alignStart }}>
                <Text
                  style={{
                    fontFamily: bold,
                    fontSize: f(13),
                    color: PW.text,
                    textAlign: dir.textAlign,
                    width: '100%',
                  }}
                  numberOfLines={2}
                >
                  {categoryName(category)}
                </Text>
                <Text
                  style={{
                    fontFamily: regular,
                    fontSize: f(10),
                    lineHeight: f(10) * 1.25,
                    color: PW.textCellDesc,
                    textAlign: dir.textAlign,
                    width: '100%',
                  }}
                  numberOfLines={3}
                >
                  {categoryDescription(category)}
                </Text>
              </View>

              <CategoryMedallion category={category} />
            </LinearGradient>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { alignSelf: 'center', flexWrap: 'wrap' },
});
