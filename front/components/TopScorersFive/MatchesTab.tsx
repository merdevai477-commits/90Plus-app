/**
 * "خماسي الهدافين" matches tab — Figma node 1288:14161.
 *
 * Lists the upcoming fixtures of whichever of the user's five is selected in the
 * chip row. Ported from the 448×925 design frame and scaled by device width;
 * the content runs past the frame, so it scrolls under the floating nav.
 */

import { useMemo, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { localeWithLatinNumerals, useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';

import { TSF_DESIGN_WIDTH, type TsfLeagueKey } from './assets';
import {
  tsfClubInitials,
  tsfInitials,
  tsfMockFixtures,
  tsfShortName,
  type TsfFixture,
  type TsfPlayer,
} from './mockData';
import { TsfHeader } from './TsfHeader';
import { tsfNavBottom } from './TsfNav';

const ACTIVE = '#8C5CF5';
const CHIP_IDLE = '#0D081A';
const CHIP_IDLE_STROKE = 'rgba(51,48,51,0.43)';
const CHIP_NAME = '#D9D9D9';
const ROW_BG = '#080510';
const ROW_STROKE = '#1C1C1C';
const DATE = '#E6CFFC';
const PLACEHOLDER = '#2A1361';

const CHIP = { width: 77, height: 93, radius: 10, gap: 4, photo: { width: 68, height: 57 } };
const ROW = { height: 78, radius: 14, gap: 8, crest: 60 };

/**
 * Gaps between the stacked blocks, read off the design's centres: title at 158.5,
 * the chip row at 251.5 (93 tall) and the fixtures block at 599.
 */
const GAP = { title: 14, chips: 30, fixtures: 32 };

type Picked = { league: TsfLeagueKey; player: TsfPlayer };

type MatchesTabProps = {
  picked: readonly Picked[];
  onBack: () => void;
  onGoToPitch: () => void;
};

export function MatchesTab({ picked, onBack, onGoToPitch }: MatchesTabProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { t, language } = useTranslation();
  const copy = t.topScorersFive.matches;
  const isAr = language === 'ar';

  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMedium = useAppFont(500);

  const scale = width / TSF_DESIGN_WIDTH;
  const s = (value: number) => value * scale;

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const active = picked.find((entry) => entry.player.id === selectedId) ?? picked[0];

  const fixtures = useMemo(
    () => (active ? tsfMockFixtures(active.league, active.player) : []),
    [active],
  );

  return (
    <View style={styles.root}>
      <TsfHeader onBack={onBack} s={s} testID="tsf-matches-back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          paddingHorizontal: s((TSF_DESIGN_WIDTH - 404) / 2),
          paddingBottom: tsfNavBottom(insets.bottom) + s(83 + 16),
        }}
      >
        <Text
          style={[styles.title, { fontFamily: fontBold, fontSize: s(24), marginTop: s(GAP.title) }]}
          maxFontSizeMultiplier={1.15}
        >
          {copy.title}
        </Text>

        {active == null ? (
          <View style={[styles.empty, { marginTop: s(64) }]}>
            <Ionicons name="calendar-outline" size={s(64)} color="#4A3A6B" />
            <Text
              style={[styles.emptyTitle, { fontFamily: fontSemi, fontSize: s(18), marginTop: s(16) }]}
            >
              {copy.emptyTitle}
            </Text>
            <Text
              style={[
                styles.emptyBody,
                { fontFamily: fontMedium, fontSize: s(14), lineHeight: s(22), marginTop: s(8) },
              ]}
            >
              {copy.emptyBody}
            </Text>
            <TouchableOpacity
              onPress={onGoToPitch}
              activeOpacity={0.85}
              accessibilityRole="button"
              style={[
                styles.emptyCta,
                { height: s(52), borderRadius: s(16), paddingHorizontal: s(23), marginTop: s(24) },
              ]}
            >
              <Text style={[styles.emptyCtaLabel, { fontFamily: fontBold, fontSize: s(16) }]}>
                {copy.emptyCta}
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.chips,
                {
                  columnGap: s(CHIP.gap),
                  marginTop: s(GAP.chips),
                  flexDirection: isAr ? 'row-reverse' : 'row',
                },
              ]}
            >
              {picked.map(({ player }) => {
                const selected = player.id === active.player.id;
                return (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => setSelectedId(player.id)}
                    activeOpacity={0.85}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={copy.selectPlayerA11y.replace('{name}', player.name)}
                    style={[
                      styles.chip,
                      {
                        width: s(CHIP.width),
                        height: s(CHIP.height),
                        borderRadius: s(CHIP.radius),
                        // The export's 10pt inset cannot hold a 57pt photo plus
                        // two lines inside 93, so only the sides keep their gap.
                        paddingHorizontal: s((CHIP.width - CHIP.photo.width) / 2),
                      },
                      selected
                        ? { backgroundColor: ACTIVE }
                        : {
                            backgroundColor: CHIP_IDLE,
                            borderWidth: 0.5,
                            borderColor: CHIP_IDLE_STROKE,
                            opacity: 0.5,
                          },
                    ]}
                  >
                    <View
                      style={[
                        styles.chipPhoto,
                        {
                          width: s(CHIP.photo.width),
                          height: s(CHIP.photo.height),
                          borderRadius: s(6),
                        },
                      ]}
                    >
                      <Text
                        style={[styles.chipPhotoText, { fontFamily: fontBold, fontSize: s(20) }]}
                        allowFontScaling={false}
                      >
                        {tsfInitials(player)}
                      </Text>
                    </View>
                    <Text
                      numberOfLines={1}
                      style={[styles.chipName, { fontFamily: fontSemi, fontSize: s(10) }]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {tsfShortName(player)}
                    </Text>
                    <Text
                      numberOfLines={1}
                      style={[styles.chipPosition, { fontFamily: fontSemi, fontSize: s(13) }]}
                      maxFontSizeMultiplier={1.1}
                    >
                      {player.position}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text
              style={[
                styles.sectionTitle,
                {
                  fontFamily: fontBold,
                  fontSize: s(16),
                  marginTop: s(GAP.fixtures),
                  textAlign: isAr ? 'right' : 'left',
                },
              ]}
              maxFontSizeMultiplier={1.15}
            >
              {copy.playerFixtures.replace('{name}', tsfShortName(active.player))}
            </Text>

            <View style={{ marginTop: s(8), rowGap: s(ROW.gap) }}>
              {fixtures.map((fixture) => (
                <FixtureRow
                  key={fixture.id}
                  fixture={fixture}
                  s={s}
                  isAr={isAr}
                  language={language}
                  fontBold={fontBold}
                  fontMedium={fontMedium}
                  label={copy.versus
                    .replace('{home}', fixture.home)
                    .replace('{away}', fixture.away)}
                />
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

type FixtureRowProps = {
  fixture: TsfFixture;
  s: (value: number) => number;
  isAr: boolean;
  language: string;
  fontBold: string;
  fontMedium: string;
  label: string;
};

function FixtureRow({ fixture, s, isAr, language, fontBold, fontMedium, label }: FixtureRowProps) {
  const kickoff = formatKickoff(fixture.kickoffISO, language);

  return (
    <View
      style={[
        styles.row,
        {
          height: s(ROW.height),
          borderRadius: s(ROW.radius),
          paddingHorizontal: s(16),
          flexDirection: isAr ? 'row-reverse' : 'row',
        },
      ]}
    >
      <View
        style={[
          styles.rowLead,
          { columnGap: s(5), flexDirection: isAr ? 'row-reverse' : 'row' },
        ]}
      >
        <Crest name={fixture.home} size={s(ROW.crest)} s={s} fontBold={fontBold} />
        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[
              styles.rowTitle,
              { fontFamily: fontMedium, fontSize: s(16), textAlign: isAr ? 'right' : 'left' },
            ]}
            maxFontSizeMultiplier={1.1}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[
              styles.rowDate,
              {
                fontFamily: fontMedium,
                fontSize: s(11),
                marginTop: s(9),
                textAlign: isAr ? 'right' : 'left',
              },
            ]}
            maxFontSizeMultiplier={1.1}
          >
            {kickoff}
          </Text>
        </View>
      </View>

      <View
        style={[styles.rowTrail, { columnGap: s(8), flexDirection: isAr ? 'row-reverse' : 'row' }]}
      >
        <Crest name={fixture.away} size={s(44)} s={s} fontBold={fontBold} />
        <Ionicons
          name={isAr ? 'chevron-back' : 'chevron-forward'}
          size={s(24)}
          color="#FFFFFF"
        />
      </View>
    </View>
  );
}

/** Club badges do not ship yet, so initials stand in at the design's box size. */
function Crest({
  name,
  size,
  s,
  fontBold,
}: {
  name: string;
  size: number;
  s: (value: number) => number;
  fontBold: string;
}) {
  return (
    <View style={[styles.crest, { width: size, height: size, borderRadius: s(8) }]}>
      <Text
        style={[styles.crestText, { fontFamily: fontBold, fontSize: size * 0.34 }]}
        allowFontScaling={false}
      >
        {tsfClubInitials(name)}
      </Text>
    </View>
  );
}

/** Arabic keeps Arabic weekday and month names; digits stay Latin app-wide. */
function formatKickoff(iso: string, language: string): string {
  const date = new Date(iso);
  const locale = localeWithLatinNumerals(language);
  const day = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} ${time}`;
}

const styles = StyleSheet.create({
  root: { flex: 1 },

  title: { color: '#FFFFFF', textAlign: 'center' },
  sectionTitle: { color: '#FFFFFF' },

  chips: { justifyContent: 'center' },
  chip: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLACEHOLDER,
    overflow: 'hidden',
  },
  chipPhotoText: { color: 'rgba(255,255,255,0.55)' },
  chipName: { color: CHIP_NAME, textAlign: 'center' },
  chipPosition: { color: '#FFFFFF', textAlign: 'center' },

  row: {
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ROW_BG,
    borderWidth: 0.5,
    borderColor: ROW_STROKE,
  },
  rowLead: { flex: 1, alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF' },
  rowDate: { color: DATE },
  rowTrail: { alignItems: 'center' },

  crest: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLACEHOLDER,
    overflow: 'hidden',
  },
  crestText: { color: 'rgba(255,255,255,0.72)' },

  empty: { alignItems: 'center', paddingHorizontal: 16 },
  emptyTitle: { color: '#FFFFFF', textAlign: 'center' },
  emptyBody: { color: '#858585', textAlign: 'center' },
  emptyCta: { alignItems: 'center', justifyContent: 'center', backgroundColor: ACTIVE },
  emptyCtaLabel: { color: '#FFFFFF' },
});
