/**
 * Hub sort dropdown + sponsor add-prize CTA — Figma `630:4450` + `953:2463`.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Modal,
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import type { CompetitionSort } from '../../services/competitions.service';
import { COMPETITION_SORTS } from '../../services/competitions.service';
import { AddPrizeButton, type AddPrizeButtonVariant } from './AddPrizeFab';
import { IconSortArrow } from './icons';
import {
  PW,
  PW_GRADIENTS,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

/** Window-space box of the control the menu hangs off. */
interface Anchor {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function SortFilterRow({
  sort,
  onSortChange,
  onAddPrize,
  addPrizeVariant = 'add',
  addPrizeLoading = false,
}: {
  sort: CompetitionSort;
  onSortChange: (sort: CompetitionSort) => void;
  onAddPrize: () => void;
  addPrizeVariant?: AddPrizeButtonVariant;
  addPrizeLoading?: boolean;
}) {
  const { t } = useTranslation();
  const { s, f } = usePWScale();
  const { semibold, regular } = usePWFonts();
  const dir = usePWDirection();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { contentWidth } = usePWContentWidth();
  const pw = t.predictAndWin;

  const sortRef = React.useRef<View>(null);
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const [menuHeight, setMenuHeight] = React.useState(0);

  const menuWidth = Math.max(
    s(120),
    Math.min(s(190), screenW - insets.left - insets.right - s(24)),
  );
  const gap = s(6);
  const rowGap = s(8);

  const openSort = React.useCallback(() => {
    const node = sortRef.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      if (!width || !height) return;
      setMenuHeight(0);
      setAnchor({ x, y, width, height });
    });
  }, []);

  const closeSort = React.useCallback(() => setAnchor(null), []);

  const estimatedHeight = COMPETITION_SORTS.length * s(38) + 2;
  const panelHeight = menuHeight || estimatedHeight;

  const placement = React.useMemo(() => {
    if (!anchor) return null;

    const preferredLeft = anchor.x;
    const minLeft = insets.left + s(8);
    const maxLeft = screenW - insets.right - s(8) - menuWidth;
    const left = Math.min(Math.max(preferredLeft, minLeft), Math.max(minLeft, maxLeft));

    const below = anchor.y + anchor.height + gap;
    const fitsBelow = below + panelHeight <= screenH - insets.bottom - s(8);
    const top = fitsBelow ? below : Math.max(insets.top + s(8), anchor.y - gap - panelHeight);

    return { left, top };
  }, [anchor, insets, menuWidth, panelHeight, screenH, screenW, s, gap]);

  const onMenuLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setMenuHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const sortOpen = anchor !== null;

  return (
    <View style={{ width: contentWidth, alignSelf: 'center' }}>
      <View
        style={{
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: rowGap,
        }}
      >
        <View ref={sortRef} collapsable={false}>
          <Pressable
            onPress={() => {
              if (sortOpen) closeSort();
              else openSort();
            }}
            accessibilityRole="button"
            accessibilityLabel={pw.sort[sort]}
            accessibilityState={{ expanded: sortOpen }}
          >
            <LinearGradient
              colors={[...PW_GRADIENTS.sort]}
              style={{
                minWidth: s(96),
                height: s(34),
                paddingHorizontal: s(10),
                borderRadius: s(PW_RADII.sort),
                flexDirection: dir.rowReverse,
                alignItems: 'center',
                justifyContent: 'center',
                gap: s(8),
              }}
            >
              <View style={{ transform: [{ rotate: sortOpen ? '180deg' : '0deg' }] }}>
                <IconSortArrow width={s(24)} height={s(24)} />
              </View>
              <Text
                style={{ fontFamily: semibold, fontSize: f(12), color: PW.textSort }}
                numberOfLines={1}
              >
                {pw.sort[sort]}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        <AddPrizeButton
          variant={addPrizeVariant}
          onPress={onAddPrize}
          disabled={addPrizeLoading}
        />
      </View>

      <Modal
        visible={sortOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={closeSort}
      >
        <Pressable style={{ flex: 1 }} onPress={closeSort} accessibilityRole="button">
          {placement ? (
            <View
              onLayout={onMenuLayout}
              style={{
                position: 'absolute',
                left: placement.left,
                top: placement.top,
                width: menuWidth,
                borderRadius: s(PW_RADII.sort),
                borderWidth: 1,
                borderColor: PW.dropdownRowBorder,
                backgroundColor: PW.surface,
                overflow: 'hidden',
                boxShadow: '0px 8px 20px rgba(0,0,0,0.55)',
              }}
            >
              {COMPETITION_SORTS.map((option) => {
                const isOn = option === sort;
                return (
                  <Pressable
                    key={option}
                    onPress={() => {
                      closeSort();
                      onSortChange(option);
                    }}
                    accessibilityRole="button"
                    accessibilityState={{ selected: isOn }}
                    style={{
                      paddingVertical: s(10),
                      paddingHorizontal: s(14),
                      backgroundColor: isOn ? 'rgba(107,17,212,0.16)' : 'transparent',
                    }}
                  >
                    <Text
                      style={{
                        fontFamily: isOn ? semibold : regular,
                        fontSize: f(13),
                        color: isOn ? PW.text : PW.textSort,
                        textAlign: dir.textAlign,
                      }}
                      numberOfLines={1}
                    >
                      {pw.sort[option]}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
}
