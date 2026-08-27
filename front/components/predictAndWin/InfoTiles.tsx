/**
 * Hub 2×2 quick-filter tiles — Figma `624:4364` (Frame 349).
 *
 * 404 wide, two rows of 52 with an 8 gap; each tile 198×52, bg #0c051a,
 * 1px #1a052d, radius 10, px 24, gap 12, icon (30) on the right of a
 * right-aligned two-line label (Medium 14 white / Regular 10 #868686).
 *
 * Figma draws these as static marketing tiles with no selected variant. They
 * carry the four quick categories from the brief, so they are wired as filter
 * toggles here; the selected treatment reuses the design's own medallion
 * border + purple tint rather than inventing a new colour.
 */

import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useTranslation } from '../../src/i18n';
import type { CompetitionFilter } from '../../services/competitions.service';
import { IconGift, IconStar, IconStore, IconUsers } from './icons';
import {
  PW,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

type TileKey = CompetitionFilter;

/** Figma layout order: row 1 = [مئات المشاركين, تحديات اليوم], row 2 = [سهل ومجاني, رعاة موثوقون]. */
const ROWS: TileKey[][] = [
  ['popular', 'daily'],
  ['free', 'sponsored'],
];

function TileIcon({ tile, size }: { tile: TileKey; size: number }) {
  const props = { width: size, height: size };
  if (tile === 'popular') return <IconUsers {...props} />;
  if (tile === 'daily') return <IconGift {...props} />;
  if (tile === 'free') return <IconStar {...props} />;
  return <IconStore {...props} />;
}

export function InfoTiles({
  active,
  onChange,
}: {
  active: CompetitionFilter | undefined;
  onChange: (filter: CompetitionFilter | undefined) => void;
}) {
  const { t } = useTranslation();
  const { s, f } = usePWScale();
  const { medium, regular } = usePWFonts();
  const dir = usePWDirection();
  const { contentWidth } = usePWContentWidth();
  const tiles = t.predictAndWin.tiles;

  return (
    <View style={{ width: contentWidth, alignSelf: 'center', gap: s(8) }}>
      {ROWS.map((row, ri) => (
        <View key={ri} style={{ flexDirection: dir.row, gap: s(8) }}>
          {row.map((tile) => {
            const isOn = active === tile;
            return (
              <Pressable
                key={tile}
                onPress={() => onChange(isOn ? undefined : tile)}
                accessibilityRole="button"
                accessibilityLabel={tiles[tile].title}
                accessibilityState={{ selected: isOn }}
                style={[
                  styles.tile,
                  {
                    // Figma's 52 is a floor: the English subtitles are longer
                    // than the Arabic ones the tile was measured against.
                    minHeight: s(52),
                    paddingVertical: s(6),
                    borderRadius: s(PW_RADII.tile),
                    // 24 of padding plus a 30 icon leaves ~100pt for text at
                    // the design width, which clipped English titles.
                    paddingHorizontal: s(14),
                    gap: s(10),
                    flexDirection: dir.rowReverse,
                  },
                  isOn && styles.tileActive,
                ]}
              >
                <View style={{ flex: 1, gap: s(2), alignItems: dir.alignStart }}>
                  <Text
                    style={{
                      fontFamily: medium,
                      fontSize: f(14),
                      color: PW.text,
                      textAlign: dir.textAlign,
                      width: '100%',
                    }}
                    numberOfLines={1}
                    adjustsFontSizeToFit
                    minimumFontScale={0.8}
                  >
                    {tiles[tile].title}
                  </Text>
                  <Text
                    style={{
                      fontFamily: regular,
                      fontSize: f(10),
                      color: PW.textTileSub,
                      textAlign: dir.textAlign,
                      width: '100%',
                    }}
                    numberOfLines={1}
                  >
                    {tiles[tile].subtitle}
                  </Text>
                </View>
                <TileIcon tile={tile} size={s(30)} />
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'flex-end',
    backgroundColor: PW.surface,
    borderWidth: 1,
    borderColor: PW.surfaceBorder,
  },
  tileActive: { borderColor: PW.medallionBorder, backgroundColor: 'rgba(107,17,212,0.16)' },
});
