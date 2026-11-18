/**
 * King of Coaches fixtures — branded match cards for the squad's leagues.
 */

import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkFixture } from '../../services/coachKing.service';
import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { useAppFont } from '../../utils/fontSetup';
import { getCoachKingTheme, type CoachKingTheme } from './theme';

type Props = {
  fixtures: CkFixture[];
  isAr: boolean;
  language: string;
  vsLabel: string;
  statusLabel: (status: string) => string;
};

export function CoachKingMatches({ fixtures, language, vsLabel, statusLabel }: Props) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getCoachKingTheme(isDark), [isDark]);

  return (
    <View style={styles.list}>
      {fixtures.map((fixture) => {
        const kickoff = formatKickoff(fixture.kickoffAt, language);
        const scored = fixture.homeScore != null && fixture.awayScore != null;
        const live = isLive(fixture.status);
        const center = scored ? `${fixture.homeScore} - ${fixture.awayScore}` : vsLabel;
        const badge = statusLabel(fixture.status);

        return (
          <View
            key={fixture.fixtureId}
            style={[styles.card, { backgroundColor: theme.matchCardBg, borderColor: theme.matchCardBorder }]}
            testID={`ck-match-${fixture.fixtureId}`}
          >
            <LinearGradient
              colors={[...theme.matchGlow]}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.cardGlow}
              pointerEvents="none"
            />

            <View style={styles.meta}>
              <Text style={[styles.date, { fontFamily: fontMed, color: theme.matchDate }]} numberOfLines={1}>
                {kickoff}
              </Text>
              {badge ? (
                <View
                  style={[
                    styles.badge,
                    { backgroundColor: theme.matchBadgeBg, borderColor: theme.matchBadgeBorder },
                    live && styles.badgeLive,
                  ]}
                >
                  <Text
                    style={[
                      styles.badgeTxt,
                      { fontFamily: fontSemi, color: theme.matchBadgeText },
                      live && styles.badgeTxtLive,
                    ]}
                    numberOfLines={1}
                  >
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>

            {/* Keep home | score | away in visual LTR order so the score string
                (homeScore - awayScore) always lines up with the team logos. */}
            <View style={[styles.teams, { flexDirection: 'row' }]}>
              <Team
                name={fixture.homeName}
                logo={fixture.homeLogo}
                fontSemi={fontSemi}
                fontBold={fontBold}
                align="left"
                theme={theme}
              />

              <View
                style={[
                  styles.center,
                  { backgroundColor: theme.matchCenterBg, borderColor: theme.matchCenterBorder },
                  live && !scored && styles.centerLive,
                ]}
              >
                <Text
                  style={[
                    styles.centerTxt,
                    { fontFamily: fontBold, color: theme.matchCenterText },
                    scored && { color: theme.matchScore, fontSize: 18 },
                    live && !scored && styles.liveTxt,
                  ]}
                  numberOfLines={1}
                >
                  {center}
                </Text>
              </View>

              <Team
                name={fixture.awayName}
                logo={fixture.awayLogo}
                fontSemi={fontSemi}
                fontBold={fontBold}
                align="right"
                theme={theme}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

function Team({
  name,
  logo,
  fontSemi,
  fontBold,
  align,
  theme,
}: {
  name: string;
  logo: string;
  fontSemi: string;
  fontBold: string;
  align: 'left' | 'right';
  theme: CoachKingTheme;
}) {
  return (
    <View style={[styles.team, { alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" cachePolicy="memory-disk" />
      ) : (
        <View style={[styles.logoFallback, { backgroundColor: theme.chipBg, borderColor: theme.chipBorder }]}>
          <Text style={[styles.logoFallbackTxt, { fontFamily: fontBold, color: theme.matchBadgeText }]} allowFontScaling={false}>
            {initials(name)}
          </Text>
        </View>
      )}
      <Text
        style={[styles.teamName, { fontFamily: fontSemi, textAlign: align, color: theme.matchTeam }]}
        numberOfLines={2}
      >
        {name}
      </Text>
    </View>
  );
}

function isLive(status: string): boolean {
  const code = status.trim().toUpperCase();
  return ['LIVE', '1H', '2H', 'HT', 'ET', 'BT', 'P', 'SUSP', 'INT'].includes(code);
}

function formatKickoff(iso: string, language: string): string {
  const date = new Date(iso);
  const locale = language === 'ar' ? 'ar' : 'en';
  const day = date.toLocaleDateString(locale, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
  });
  const time = date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: language === 'ar',
  });
  return `${day} · ${time}`;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join('')
    .toUpperCase();
}

const styles = StyleSheet.create({
  list: {
    gap: 12,
  },
  card: {
    borderRadius: 18,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
    overflow: 'hidden',
  },
  cardGlow: {
    ...StyleSheet.absoluteFillObject,
    height: 56,
  },
  meta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    columnGap: 10,
  },
  date: {
    fontSize: 12,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 0.5,
  },
  badgeLive: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(248,113,113,0.55)',
  },
  badgeTxt: {
    fontSize: 11,
  },
  badgeTxtLive: {
    color: '#FCA5A5',
  },
  teams: {
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  team: {
    flex: 1,
    minWidth: 0,
    rowGap: 8,
  },
  logo: {
    width: 40,
    height: 40,
  },
  logoFallback: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  logoFallbackTxt: {
    fontSize: 12,
  },
  teamName: {
    fontSize: 13,
    lineHeight: 18,
    width: '100%',
  },
  center: {
    minWidth: 64,
    height: 36,
    paddingHorizontal: 10,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 0.5,
  },
  centerLive: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderColor: 'rgba(248,113,113,0.5)',
  },
  centerTxt: {
    fontSize: 14,
  },
  liveTxt: {
    color: '#FCA5A5',
    fontSize: 13,
  },
});
