/**
 * Hub 2×2 marketing tiles — Figma `624:4364` (Frame 349).
 *
 * 404 wide, two rows of 52 with an 8 gap; each tile 198×52, bg #0c051a,
 * 1px #1a052d, radius 10, px 24, gap 12, icon (30) on the right of a
 * right-aligned two-line label (Medium 14 white / Regular 10 #868686).
 *
 * Figma draws these as static marketing tiles with no press or filter wiring.
 */

import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

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

/**
 * Figma `624:4364` visual order (Arabic, RTL): row 1 right = تحديات اليوم,
 * left = مئات المشاركين; row 2 right = رعاة موثوقون, left = سهل ومجاني.
 */
const ROWS: TileKey[][] = [
  ['daily', 'popular'],
  ['sponsored', 'free'],
];

function TileIcon({ tile, size }: { tile: TileKey; size: number }) {
  const props = { width: size, height: size };
  if (tile === 'popular') return <IconUsers {...props} />;
  if (tile === 'daily') return <IconGift {...props} />;
  if (tile === 'free') return <IconStar {...props} />;
  return <IconStore {...props} />;
}

export function InfoTiles() {
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
          {row.map((tile) => (
            <View
              key={tile}
              style={[
                styles.tile,
                {
                  minHeight: s(52),
                  paddingVertical: s(6),
                  borderRadius: s(PW_RADII.tile),
                  paddingHorizontal: s(24),
                  gap: s(12),
                  flexDirection: dir.rowReverse,
                },
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
            </View>
          ))}
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
});
