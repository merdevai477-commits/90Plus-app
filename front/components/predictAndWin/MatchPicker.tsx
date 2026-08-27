/**
 * `اختر المباراة` — Figma `Component 22` (`692:1621`).
 *
 * Three variants, all implemented here:
 *  - `692:1620` **closed** — 404×83, gradient #07040d→#0c051a, 1px #2b2539,
 *    r16, px24, chevron 32 on the trailing edge, Medium 18 #9b9b9b placeholder.
 *  - `692:1618` **open** — the same box with a #5404a0 top/side border and a
 *    gradient (#a44af9→#6c05cf) title, expanding *inline* into h83 rows
 *    (bg #0c051a, 1px #20162a) whose foot is r25.
 *  - `692:1619` **selected** — 404×83, 1px #6512b3, r16, holding the match row.
 *
 * Row internals: a flex-1 h64 row, px12, `justify-between` —
 * crest 26×35 + name SemiBold 12 / VS SemiBold 21 gradient + time Medium 13
 * #777 (w105) / crest 35×35 + name SemiBold 12.
 *
 * This replaced a full-screen bottom-sheet `Modal`, which was neither the
 * designed interaction nor the designed row.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import TeamBadge from '../common/TeamBadge';
import { useTranslation } from '../../src/i18n';
import type { MatchPoolEntry } from '../../services/competitions.service';
import { PWGradientText } from './GradientText';
import { PWChevronDown } from './fields';
import {
  PW,
  PW_GRADIENTS,
  PW_RADII,
  usePWContentWidth,
  usePWDirection,
  usePWFonts,
  usePWScale,
} from './theme';

/** Large VS block above the picker — Figma `692:1657` (402×148, gap 54). */
export function SelectedMatchHero({ match }: { match: MatchPoolEntry }) {
  const { s, f } = usePWScale();
  const { bold, medium, semibold } = usePWFonts();
  const dir = usePWDirection();
  const { contentWidth } = usePWContentWidth();

  return (
    <View
      style={{
        width: contentWidth,
        alignSelf: 'center',
        // Figma is drawn in Arabic: the home side sits on the left of the VS.
        // Mirroring keeps home on the reading-order start in both languages.
        flexDirection: dir.isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s(24),
      }}
    >
      <View style={{ flex: 1, alignItems: 'center', gap: s(8) }}>
        <TeamBadge
          name={match.home.name}
          logo={match.home.logo ?? undefined}
          size={s(84)}
          color="transparent"
        />
        <Text
          style={{ fontFamily: bold, fontSize: f(20), color: PW.text, textAlign: 'center' }}
          numberOfLines={2}
        >
          {match.home.name}
        </Text>
      </View>

      <View style={{ width: s(105), alignItems: 'center', gap: s(4) }}>
        <PWGradientText
          colors={[PW.vsTop, PW.vsBottom]}
          style={{ fontFamily: semibold, fontSize: f(48), textAlign: 'center' }}
        >
          VS
        </PWGradientText>
        <Text
          style={{ fontFamily: medium, fontSize: f(20), color: PW.textVsTime, textAlign: 'center' }}
        >
          {match.time}
        </Text>
      </View>

      <View style={{ flex: 1, alignItems: 'center', gap: s(8) }}>
        <TeamBadge
          name={match.away.name}
          logo={match.away.logo ?? undefined}
          size={s(84)}
          color="transparent"
        />
        <Text
          style={{ fontFamily: bold, fontSize: f(20), color: PW.text, textAlign: 'center' }}
          numberOfLines={2}
        >
          {match.away.name}
        </Text>
      </View>
    </View>
  );
}

/** The h64 inner row shared by the open list and the selected box. */
function MatchRowBody({ match }: { match: MatchPoolEntry }) {
  const { s, f } = usePWScale();
  const { semibold, medium } = usePWFonts();
  const dir = usePWDirection();

  const side = (team: { name: string; logo: string | null }, size: number) => (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: s(3) }}>
      <TeamBadge name={team.name} logo={team.logo ?? undefined} size={s(size)} color="transparent" />
      <Text
        style={{ fontFamily: semibold, fontSize: f(12), color: PW.text, textAlign: 'center' }}
        numberOfLines={1}
      >
        {team.name}
      </Text>
    </View>
  );

  return (
    <View
      style={{
        flex: 1,
        flexDirection: dir.isRTL ? 'row' : 'row-reverse',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: s(12),
        gap: s(6),
      }}
    >
      {side(match.home, 30)}
      <View style={{ width: s(88), alignItems: 'center', gap: s(4) }}>
        <PWGradientText
          colors={[PW.vsTop, PW.vsBottom]}
          style={{ fontFamily: semibold, fontSize: f(21), textAlign: 'center' }}
        >
          VS
        </PWGradientText>
        <Text
          style={{ fontFamily: medium, fontSize: f(13), color: PW.textVsTime, textAlign: 'center' }}
          numberOfLines={1}
        >
          {match.time}
        </Text>
      </View>
      {side(match.away, 35)}
    </View>
  );
}

export function MatchPicker({
  matches,
  loading,
  error,
  selected,
  onSelect,
  onRetry,
}: {
  matches: MatchPoolEntry[];
  loading: boolean;
  /** Set when the pool request failed — distinct from "the pool is empty". */
  error?: boolean;
  selected: MatchPoolEntry | null;
  onSelect: (match: MatchPoolEntry) => void;
  onRetry?: () => void;
}) {
  const { s, f } = usePWScale();
  const { medium, regular, semibold } = usePWFonts();
  const dir = usePWDirection();
  const { t } = useTranslation();
  const wizard = t.predictAndWin.wizard;
  const [open, setOpen] = React.useState(false);

  const rowHeight = s(83);

  const header = (
    <Pressable
      onPress={() => setOpen((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={wizard.chooseMatch}
      accessibilityState={{ expanded: open }}
    >
      <LinearGradient
        colors={[...PW_GRADIENTS.input]}
        style={{
          height: rowHeight,
          borderWidth: 1,
          borderColor: open ? PW.dropdownOpenBorder : PW.inputBorder,
          // The open header loses its bottom rounding into the list below it.
          borderTopLeftRadius: s(PW_RADII.input),
          borderTopRightRadius: s(PW_RADII.input),
          borderBottomLeftRadius: open ? 0 : s(PW_RADII.input),
          borderBottomRightRadius: open ? 0 : s(PW_RADII.input),
          borderBottomWidth: open ? 0 : 1,
          paddingHorizontal: s(24),
          flexDirection: dir.rowReverse,
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <PWChevronDown size={s(32)} up={open} color={open ? PW.dropdownTitleTop : PW.textSelect} />
        {open ? (
          <PWGradientText
            colors={[PW.dropdownTitleTop, PW.dropdownTitleBottom]}
            style={{ fontFamily: medium, fontSize: f(18), textAlign: dir.textAlign }}
          >
            {wizard.chooseMatch}
          </PWGradientText>
        ) : (
          <Text
            style={{
              fontFamily: medium,
              fontSize: f(18),
              color: PW.textSelect,
              textAlign: dir.textAlign,
              flexShrink: 1,
            }}
            numberOfLines={1}
          >
            {wizard.chooseMatch}
          </Text>
        )}
      </LinearGradient>
    </Pressable>
  );

  /** Empty / error / loading all render inside the expanded body, not instead
   *  of it — collapsing the dropdown on failure hid the retry affordance. */
  const body = () => {
    if (loading) {
      return (
        <View style={[styles.state, { height: rowHeight }]}>
          <ActivityIndicator color={PW.ctaTop} />
        </View>
      );
    }
    if (error) {
      return (
        <View style={[styles.state, { minHeight: rowHeight, gap: s(6), paddingVertical: s(14) }]}>
          <Text style={{ fontFamily: medium, fontSize: f(14), color: PW.text, textAlign: 'center' }}>
            {wizard.matchesError}
          </Text>
          {onRetry ? (
            <Pressable onPress={onRetry} hitSlop={8} accessibilityRole="button">
              <Text style={{ fontFamily: semibold, fontSize: f(13), color: PW.vsTop }}>
                {t.predictAndWin.errorState.retry}
              </Text>
            </Pressable>
          ) : null}
        </View>
      );
    }
    if (matches.length === 0) {
      return (
        <View style={[styles.state, { minHeight: rowHeight, gap: s(4), paddingVertical: s(14) }]}>
          <Text style={{ fontFamily: medium, fontSize: f(14), color: PW.text, textAlign: 'center' }}>
            {wizard.noMatches}
          </Text>
          <Text
            style={{
              fontFamily: regular,
              fontSize: f(11),
              color: PW.textTileSub,
              textAlign: 'center',
            }}
          >
            {wizard.noMatchesHint}
          </Text>
        </View>
      );
    }
    return matches.map((match, index) => {
      const isLast = index === matches.length - 1;
      const isOn = selected?.apiMatchId === match.apiMatchId;
      return (
        <Pressable
          key={match.apiMatchId}
          onPress={() => {
            onSelect(match);
            setOpen(false);
          }}
          accessibilityRole="button"
          accessibilityState={{ selected: isOn }}
          style={{
            height: rowHeight,
            backgroundColor: PW.surface,
            borderWidth: 1,
            borderColor: isOn ? PW.dropdownSelectedBorder : PW.dropdownRowBorder,
            borderBottomLeftRadius: isLast ? s(PW_RADII.dropdownFoot) : 0,
            borderBottomRightRadius: isLast ? s(PW_RADII.dropdownFoot) : 0,
            paddingHorizontal: s(24),
            justifyContent: 'center',
          }}
        >
          <MatchRowBody match={match} />
        </Pressable>
      );
    });
  };

  return (
    <View style={{ width: '100%' }}>
      {/* Selected state (`692:1619`) doubles as the collapsed control once a
          match is chosen — Figma's own variant for "a match is picked". */}
      {selected && !open ? (
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={wizard.chooseMatch}
          accessibilityState={{ expanded: false }}
        >
          <LinearGradient
            colors={[...PW_GRADIENTS.input]}
            style={{
              height: rowHeight,
              borderRadius: s(PW_RADII.input),
              borderWidth: 1,
              borderColor: PW.dropdownSelectedBorder,
              paddingHorizontal: s(24),
              justifyContent: 'center',
            }}
          >
            <MatchRowBody match={selected} />
          </LinearGradient>
        </Pressable>
      ) : (
        <>
          {header}
          {open ? <View style={{ width: '100%' }}>{body()}</View> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  state: {
    width: '100%',
    backgroundColor: PW.surface,
    borderWidth: 1,
    borderColor: PW.dropdownRowBorder,
    borderBottomLeftRadius: PW_RADII.dropdownFoot,
    borderBottomRightRadius: PW_RADII.dropdownFoot,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
});
