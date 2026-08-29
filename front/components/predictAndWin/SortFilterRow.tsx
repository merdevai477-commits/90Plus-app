/**
 * Hub sort dropdown + filter control — Figma `Component 10` (`630:4450`) and
 * `mdi:filter` (`630:4539`), both at y383 on the 404 content column.
 *
 * Sort pill: 96×34, gradient #1a1328 (top) → #0c0c0c (bottom), radius 8, gap 8,
 * chevron 24 + SemiBold 12 #b2b2b2, default label "الأحدث".
 * Filter glyph: 34×34 (its exported asset carries its own gradient plate).
 *
 * Figma draws the pill only in its closed state, so the open menu reuses the
 * one dropdown treatment the file *does* draw open — the wizard's match
 * selector (`692:1618`): #0c051a panel, 1px #20162a, and a purple tint on the
 * selected row.
 *
 * **Positioning.** The menu is rendered into a `Modal` and placed from the
 * trigger's measured window coordinates rather than as an in-flow sibling.
 * This row lives inside the hub list's `ListHeaderComponent`, whose layout the
 * list caches: an in-flow menu changed the header's height without the cached
 * layout agreeing, so the menu drew far from the pill it belongs to. Measuring
 * at open time sidesteps the list's layout entirely, and the modal backdrop
 * stops the list scrolling out from under the menu.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  useWindowDimensions,
  View,
  type LayoutChangeEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useTranslation } from '../../src/i18n';
import type { CompetitionFilter, CompetitionSort } from '../../services/competitions.service';
import { COMPETITION_SORTS } from '../../services/competitions.service';
import { IconFilter, IconSortArrow } from './icons';
import {
  PW,
  PW_GRADIENTS,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

const FILTERS: CompetitionFilter[] = ['popular', 'daily', 'free', 'sponsored'];

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
  filter,
  onFilterChange,
}: {
  sort: CompetitionSort;
  onSortChange: (sort: CompetitionSort) => void;
  filter: CompetitionFilter | undefined;
  onFilterChange: (filter: CompetitionFilter | undefined) => void;
}) {
  const { t } = useTranslation();
  const { s, f } = usePWScale();
  const { semibold, medium, regular } = usePWFonts();
  const dir = usePWDirection();
  const insets = useSafeAreaInsets();
  const { width: screenW, height: screenH } = useWindowDimensions();
  const { contentWidth } = usePWContentWidth();
  const pw = t.predictAndWin;

  const sortRef = React.useRef<View>(null);
  const [anchor, setAnchor] = React.useState<Anchor | null>(null);
  const [menuHeight, setMenuHeight] = React.useState(0);
  const [filterOpen, setFilterOpen] = React.useState(false);

  // Floored so a very narrow viewport (or a wide inset) cannot compute a
  // zero/negative width and collapse the menu to nothing.
  const menuWidth = Math.max(
    s(120),
    Math.min(s(190), screenW - insets.left - insets.right - s(24)),
  );
  const gap = s(6);

  /**
   * `measureInWindow` reports the trigger's real on-screen box, which is the
   * only thing that stays correct while the list scrolls, the device rotates,
   * or the header's cached layout is stale.
   */
  const openSort = React.useCallback(() => {
    const node = sortRef.current;
    if (!node) return;
    node.measureInWindow((x, y, width, height) => {
      // A collapsed measurement means the node is not laid out yet; opening on
      // (0,0) is exactly the "menu is nowhere near the button" failure.
      if (!width || !height) return;
      setMenuHeight(0);
      setAnchor({ x, y, width, height });
    });
  }, []);

  const closeSort = React.useCallback(() => setAnchor(null), []);

  /** Estimated until the panel reports its real height via `onLayout`. */
  const estimatedHeight = COMPETITION_SORTS.length * s(38) + 2;
  const panelHeight = menuHeight || estimatedHeight;

  const placement = React.useMemo(() => {
    if (!anchor) return null;

    // Trailing-edge aligned, then clamped inside the safe area so a pill near
    // the screen edge cannot push the menu off it.
    const preferredLeft = dir.isRTL ? anchor.x : anchor.x + anchor.width - menuWidth;
    const minLeft = insets.left + s(8);
    const maxLeft = screenW - insets.right - s(8) - menuWidth;
    const left = Math.min(Math.max(preferredLeft, minLeft), Math.max(minLeft, maxLeft));

    // Below the pill, unless that would run off the bottom — then above it.
    const below = anchor.y + anchor.height + gap;
    const fitsBelow = below + panelHeight <= screenH - insets.bottom - s(8);
    const top = fitsBelow ? below : Math.max(insets.top + s(8), anchor.y - gap - panelHeight);

    return { left, top };
  }, [anchor, dir.isRTL, insets, menuWidth, panelHeight, screenH, screenW, s, gap]);

  const onMenuLayout = React.useCallback((e: LayoutChangeEvent) => {
    const h = e.nativeEvent.layout.height;
    setMenuHeight((prev) => (Math.abs(prev - h) > 1 ? h : prev));
  }, []);

  const activeFilterCount = filter ? 1 : 0;
  const sortOpen = anchor !== null;

  return (
    <View style={{ width: contentWidth, alignSelf: 'center' }}>
      {/* Figma pins filter on the physical right and sort to its left in both languages. */}
      <View
        style={{
          direction: 'ltr',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: s(8),
        }}
      >
        <View ref={sortRef} collapsable={false}>
          <Pressable
            onPress={() => {
              setFilterOpen(false);
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
                // 96 is the Arabic label's width; English options are longer,
                // so it is a floor and the pill grows rather than clipping.
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

        <Pressable
          onPress={() => {
            closeSort();
            setFilterOpen(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={pw.filter.title}
          hitSlop={8}
        >
          <View>
            <IconFilter width={s(34)} height={s(34)} />
            {activeFilterCount > 0 ? (
              <View
                style={{
                  position: 'absolute',
                  top: 0,
                  [dir.isRTL ? 'left' : 'right']: 0,
                  width: s(10),
                  height: s(10),
                  borderRadius: s(5),
                  backgroundColor: PW.vsTop,
                }}
              />
            ) : null}
          </View>
        </Pressable>
      </View>

      {/* Anchored menu. `Modal` takes it out of the list header's layout,
          and the backdrop keeps the list still while it is open so the pill it
          points at cannot scroll away. */}
      {/* `statusBarTranslucent` is not cosmetic here: without it Android
          starts the modal's window below the status bar, while
          `measureInWindow` reports coordinates that include it — the menu
          would land a status-bar height too low, on Android only. It is
          also what every other modal in this app already does. */}
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
                // Lifts the panel off the cards behind it.
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

      <Modal
        visible={filterOpen}
        transparent
        animationType="fade"
        statusBarTranslucent
        navigationBarTranslucent
        onRequestClose={() => setFilterOpen(false)}
      >
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' }}
          onPress={() => setFilterOpen(false)}
        >
          <Pressable onPress={(e) => e.stopPropagation()}>
            <View
              style={{
                backgroundColor: PW.surface,
                borderTopLeftRadius: s(PW_RADII.detail),
                borderTopRightRadius: s(PW_RADII.detail),
                paddingVertical: s(20),
                paddingHorizontal: s(22),
                paddingBottom: insets.bottom + s(20),
                gap: s(12),
                maxHeight: '70%',
              }}
            >
              <Text
                style={{
                  fontFamily: semibold,
                  fontSize: f(16),
                  color: PW.text,
                  textAlign: dir.textAlign,
                }}
              >
                {pw.filter.title}
              </Text>

              <ScrollView contentContainerStyle={{ gap: s(8) }}>
                {[undefined, ...FILTERS].map((option) => {
                  const isOn = option === filter;
                  const label = option ? pw.tiles[option].title : pw.filter.all;
                  return (
                    <Pressable
                      key={option ?? 'all'}
                      onPress={() => {
                        setFilterOpen(false);
                        onFilterChange(option);
                      }}
                      accessibilityRole="button"
                      accessibilityState={{ selected: isOn }}
                      style={{
                        paddingVertical: s(14),
                        paddingHorizontal: s(16),
                        borderRadius: s(PW_RADII.tile),
                        borderWidth: 1,
                        borderColor: isOn ? PW.medallionBorder : PW.surfaceBorder,
                        backgroundColor: isOn ? 'rgba(107,17,212,0.16)' : 'transparent',
                      }}
                    >
                      <Text
                        style={{
                          fontFamily: isOn ? semibold : medium,
                          fontSize: f(14),
                          color: isOn ? PW.text : PW.textSort,
                          textAlign: dir.textAlign,
                        }}
                      >
                        {label}
                      </Text>
                    </Pressable>
                  );
                })}
              </ScrollView>

              <Pressable
                onPress={() => setFilterOpen(false)}
                accessibilityRole="button"
                style={{ alignSelf: 'center', paddingVertical: s(8) }}
              >
                <Text style={{ fontFamily: regular, fontSize: f(13), color: PW.textTileSub }}>
                  {pw.filter.close}
                </Text>
              </Pressable>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}
