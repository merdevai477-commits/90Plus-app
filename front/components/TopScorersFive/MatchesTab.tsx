/**
 * "خماسي الهدافين" matches tab — Figma node 1288:14161.
 *
 * Lists this gameweek's fixtures of whichever of the user's five is selected in
 * the chip row — only matches of the picked players' clubs, from one
 * `/me/fixtures` read — with the player's line once the match is scored.
 * Ported from the 448×925 design frame and scaled by device width; the content
 * runs past the frame, so it scrolls under the floating nav.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '@clerk/clerk-expo';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { topScorersFiveService, type TsfApiMyFixtures } from '../../services/topScorersFive.service';
import { localeWithLatinNumerals, useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { logger } from '../../utils/logger';
import { KingEmptyState } from '../KingOfPredictions/KingBoardList';

import { TSF_DESIGN_WIDTH, type TsfLeagueKey } from './assets';
import { tsfMyFixtureFor } from './liveData';
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

const ACTIVE = '#8B5CF6';
const ACTIVE_GRADIENT = [ACTIVE, '#513590'] as const;
const CHIP_IDLE = '#0C0718';
const CHIP_IDLE_STROKE = 'rgba(50,49,51,0.43)';
const CHIP_NAME = '#D9D9D9';
const ROW_BG = '#08050E';
const ROW_STROKE = '#1B1B1B';
const DATE = '#E6CEFD';
const CHEVRON = 'rgba(255,255,255,0.7)';
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

  const { getToken, isSignedIn } = useAuth();
  const getTokenRef = useRef(getToken);
  getTokenRef.current = getToken;
  const [mine, setMine] = useState<TsfApiMyFixtures | null>(null);
  const hasLivePick = picked.some((entry) => entry.player.live);

  useEffect(() => {
    if (!isSignedIn || !hasLivePick) return;
    let cancelled = false;
    (async () => {
      const token = await getTokenRef.current().catch(() => null);
      if (!token || cancelled) return;
      try {
        const data = await topScorersFiveService.getMyFixtures(token, language);
        if (!cancelled) setMine(data);
      } catch (error) {
        logger.warn('[TopScorersFive] my fixtures load failed', error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hasLivePick, isSignedIn, language]);

  const fixtures = useMemo<readonly TsfFixture[]>(() => {
    if (!active) return [];
    if (!active.player.live) return tsfMockFixtures(active.league, active.player);
    return (mine?.fixtures ?? [])
      .filter((fixture) => fixture.players.some((p) => p.playerId === active.player.id))
      .map((fixture) => tsfMyFixtureFor(fixture, active.player.id));
  }, [active, mine]);

  const activeState = active?.player.live
    ? mine?.leagues.find((entry) => entry.leagueKey === active.league)?.state
    : undefined;

  return (
    <View style={styles.root}>
      <TsfHeader onBack={onBack} s={s} testID="tsf-matches-back" />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          flexGrow: 1,
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
          <View style={styles.emptyBody}>
            <KingEmptyState
              title={copy.emptyTitle}
              actionLabel={copy.emptyCta}
              onAction={onGoToPitch}
            />
          </View>
        ) : (
          <>
            <View
              style={[
                styles.chips,
                { columnGap: s(CHIP.gap), marginTop: s(GAP.chips) },
              ]}
            >
              {picked.map(({ player }) => {
                const selected = player.id === active.player.id;
                const body = [
                  styles.chip,
                  {
                    borderRadius: s(CHIP.radius),
                    // The export's 10pt inset cannot hold a 57pt photo plus
                    // two lines inside 93, so only the sides keep their gap.
                    paddingHorizontal: s((CHIP.width - CHIP.photo.width) / 2),
                  },
                ];
                const content = (
                  <>
                    <View
                      style={[
                        styles.chipPhoto,
                        {
                          width: s(CHIP.photo.width),
                          height: s(CHIP.photo.height),
                          borderRadius: s(6),
                        },
                        player.photo ? null : { backgroundColor: PLACEHOLDER },
                      ]}
                    >
                      {player.photo ? (
                        <Image
                          source={{ uri: player.photo }}
                          style={StyleSheet.absoluteFill}
                          contentFit="cover"
                          contentPosition="top"
                          transition={150}
                        />
                      ) : (
                        <Text
                          style={[styles.chipPhotoText, { fontFamily: fontBold, fontSize: s(20) }]}
                          allowFontScaling={false}
                        >
                          {tsfInitials(player)}
                        </Text>
                      )}
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
                  </>
                );
                // Fading or painting the touchable itself drops the chip that
                // turns selected on Android, so the body below carries both.
                return (
                  <TouchableOpacity
                    key={player.id}
                    onPress={() => setSelectedId(player.id)}
                    activeOpacity={0.85}
                    accessibilityRole="tab"
                    accessibilityState={{ selected }}
                    accessibilityLabel={copy.selectPlayerA11y.replace('{name}', player.name)}
                    style={{ width: s(CHIP.width), height: s(CHIP.height) }}
                  >
                    {selected ? (
                      <LinearGradient colors={ACTIVE_GRADIENT} style={body}>
                        {content}
                      </LinearGradient>
                    ) : (
                      <View style={[body, styles.chipIdle]}>{content}</View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>

            <View
              style={[
                styles.sectionHead,
                {
                  marginTop: s(GAP.fixtures),
                  columnGap: s(12),
                  flexDirection: isAr ? 'row-reverse' : 'row',
                },
              ]}
            >
              <View style={[styles.sectionBar, { width: s(3), height: s(30), borderRadius: s(2) }]} />
              <Text
                style={[
                  styles.sectionTitle,
                  { fontFamily: fontBold, fontSize: s(16), textAlign: isAr ? 'right' : 'left' },
                ]}
                maxFontSizeMultiplier={1.15}
              >
                {copy.playerFixtures.replace('{name}', tsfShortName(active.player))}
              </Text>
            </View>
            {activeState ? (
              <Text
                style={[
                  styles.stateLine,
                  { fontFamily: fontMedium, fontSize: s(12), marginTop: s(4), textAlign: isAr ? 'right' : 'left' },
                ]}
                maxFontSizeMultiplier={1.15}
              >
                {copy.states[activeState]}
              </Text>
            ) : null}

            {fixtures.length === 0 ? (
              <KingEmptyState
                title={copy.noFixtures.replace('{name}', tsfShortName(active.player))}
                style={{ marginTop: s(32) }}
              />
            ) : (
              <View style={{ marginTop: s(8), rowGap: s(ROW.gap) }}>
                {fixtures.map((fixture) => (
                  <FixtureRow
                    key={fixture.id}
                    fixture={fixture}
                    s={s}
                    language={language}
                    fontBold={fontBold}
                    fontMedium={fontMedium}
                    label={copy.versus
                      .replace('{home}', fixture.home)
                      .replace('{away}', fixture.away)}
                    resultLabel={resultLabel(fixture, copy)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

type MatchesCopy = ReturnType<typeof useTranslation>['t']['topScorersFive']['matches'];

/** "1 G · 1 A · 4 pts", prefixed with why he scored nothing when he did not play. */
function resultLabel(fixture: TsfFixture, copy: MatchesCopy): string | null {
  const result = fixture.result;
  if (!result) return null;
  const line = copy.result
    .replace('{goals}', String(result.goals))
    .replace('{assists}', String(result.assists))
    .replace('{points}', String(result.points));
  const didNotPlay = result.participation === 'BENCH' || result.participation === 'UNAVAILABLE' || result.participation === 'NOT_IN_SQUAD';
  return didNotPlay ? `${copy.participation[result.participation as keyof MatchesCopy['participation']]} · ${line}` : line;
}

type FixtureRowProps = {
  fixture: TsfFixture;
  s: (value: number) => number;
  language: string;
  fontBold: string;
  fontMedium: string;
  label: string;
  resultLabel?: string | null;
};

/** Left to right in both languages, as the Arabic frame draws it. */
function FixtureRow({ fixture, s, language, fontBold, fontMedium, label, resultLabel: result }: FixtureRowProps) {
  const kickoff = result
    ? `${formatKickoff(fixture.kickoffISO, language)} · ${result}`
    : formatKickoff(fixture.kickoffISO, language);

  return (
    <View
      style={[
        styles.row,
        {
          height: s(ROW.height),
          borderRadius: s(ROW.radius),
          paddingHorizontal: s(16),
          columnGap: s(8),
        },
      ]}
    >
      <View style={[styles.rowLead, { columnGap: s(5) }]}>
        <Crest name={fixture.home} logo={fixture.homeLogo} size={s(ROW.crest)} s={s} fontBold={fontBold} />
        <View style={styles.rowText}>
          <Text
            numberOfLines={1}
            style={[styles.rowTitle, { fontFamily: fontMedium, fontSize: s(16) }]}
            maxFontSizeMultiplier={1.1}
          >
            {label}
          </Text>
          <Text
            numberOfLines={1}
            style={[styles.rowDate, { fontFamily: fontMedium, fontSize: s(11), marginTop: s(9) }]}
            maxFontSizeMultiplier={1.1}
          >
            {kickoff}
          </Text>
        </View>
      </View>

      <View style={[styles.rowTrail, { columnGap: s(8) }]}>
        <Crest name={fixture.away} logo={fixture.awayLogo} size={s(ROW.crest)} s={s} fontBold={fontBold} />
        <Ionicons name="chevron-forward" size={s(24)} color={CHEVRON} />
      </View>
    </View>
  );
}

/** Initials stand in at the design's box size when 365 has no badge for the club. */
function Crest({
  name,
  logo,
  size,
  s,
  fontBold,
}: {
  name: string;
  logo?: string | null;
  size: number;
  s: (value: number) => number;
  fontBold: string;
}) {
  if (logo) {
    return (
      <Image
        source={{ uri: logo }}
        style={{ width: size, height: size }}
        contentFit="contain"
        transition={150}
        accessibilityLabel={name}
      />
    );
  }
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
  sectionHead: { alignItems: 'center' },
  sectionBar: { backgroundColor: ACTIVE },
  sectionTitle: { flex: 1, color: '#FFFFFF' },
  stateLine: { color: DATE },

  chips: { flexDirection: 'row', justifyContent: 'center' },
  chip: { flex: 1, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  chipIdle: {
    backgroundColor: CHIP_IDLE,
    borderWidth: 1,
    borderColor: CHIP_IDLE_STROKE,
    opacity: 0.5,
  },
  chipPhoto: {
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  chipPhotoText: { color: 'rgba(255,255,255,0.55)' },
  chipName: { color: CHIP_NAME, textAlign: 'center' },
  chipPosition: { color: '#FFFFFF', textAlign: 'center' },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: ROW_BG,
    borderWidth: 1,
    borderColor: ROW_STROKE,
  },
  rowLead: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  rowText: { flex: 1 },
  rowTitle: { color: '#FFFFFF' },
  rowDate: { color: DATE },
  rowTrail: { flexDirection: 'row', alignItems: 'center' },

  crest: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: PLACEHOLDER,
    overflow: 'hidden',
  },
  crestText: { color: 'rgba(255,255,255,0.72)' },

  emptyBody: { flex: 1, alignItems: 'center', justifyContent: 'center' },
});
