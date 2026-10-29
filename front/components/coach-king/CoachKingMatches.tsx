/**
 * King of Coaches fixtures — branded match cards for the squad's leagues.
 */

import { StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';

import type { CkFixture } from '../../services/coachKing.service';
import { useAppFont } from '../../utils/fontSetup';

type Props = {
  fixtures: CkFixture[];
  isAr: boolean;
  language: string;
  vsLabel: string;
  statusLabel: (status: string) => string;
};

export function CoachKingMatches({ fixtures, isAr, language, vsLabel, statusLabel }: Props) {
  const fontBold = useAppFont(700);
  const fontSemi = useAppFont(600);
  const fontMed = useAppFont(500);

  return (
    <View style={styles.list}>
      {fixtures.map((fixture) => {
        const kickoff = formatKickoff(fixture.kickoffAt, language);
        const scored = fixture.homeScore != null && fixture.awayScore != null;
        const live = isLive(fixture.status);
        const center = scored ? `${fixture.homeScore} - ${fixture.awayScore}` : vsLabel;
        const badge = statusLabel(fixture.status);

        return (
          <View key={fixture.fixtureId} style={styles.card} testID={`ck-match-${fixture.fixtureId}`}>
            <LinearGradient
              colors={['rgba(140,92,245,0.18)', 'rgba(14,6,28,0.0)']}
              start={{ x: 0.5, y: 0 }}
              end={{ x: 0.5, y: 1 }}
              style={styles.cardGlow}
              pointerEvents="none"
            />

            <View style={styles.meta}>
              <Text style={[styles.date, { fontFamily: fontMed }]} numberOfLines={1}>
                {kickoff}
              </Text>
              {badge ? (
                <View style={[styles.badge, live && styles.badgeLive]}>
                  <Text style={[styles.badgeTxt, { fontFamily: fontSemi }, live && styles.badgeTxtLive]} numberOfLines={1}>
                    {badge}
                  </Text>
                </View>
              ) : null}
            </View>

            <View style={[styles.teams, { flexDirection: isAr ? 'row-reverse' : 'row' }]}>
              <Team
                name={fixture.homeName}
                logo={fixture.homeLogo}
                fontSemi={fontSemi}
                fontBold={fontBold}
                align={isAr ? 'right' : 'left'}
              />

              <View style={[styles.center, live && !scored && styles.centerLive]}>
                <Text
                  style={[
                    styles.centerTxt,
                    { fontFamily: fontBold },
                    scored && styles.scoreTxt,
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
                align={isAr ? 'left' : 'right'}
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
}: {
  name: string;
  logo: string;
  fontSemi: string;
  fontBold: string;
  align: 'left' | 'right';
}) {
  return (
    <View style={[styles.team, { alignItems: align === 'left' ? 'flex-start' : 'flex-end' }]}>
      {logo ? (
        <Image source={{ uri: logo }} style={styles.logo} contentFit="contain" cachePolicy="memory-disk" />
      ) : (
        <View style={styles.logoFallback}>
          <Text style={[styles.logoFallbackTxt, { fontFamily: fontBold }]} allowFontScaling={false}>
            {initials(name)}
          </Text>
        </View>
      )}
      <Text
        style={[styles.teamName, { fontFamily: fontSemi, textAlign: align }]}
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
    backgroundColor: '#0A001C',
    borderWidth: 0.5,
    borderColor: '#3A1D7A',
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
    color: '#C2ABFC',
    fontSize: 12,
    flex: 1,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(140,92,245,0.16)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.4)',
  },
  badgeLive: {
    backgroundColor: 'rgba(239,68,68,0.18)',
    borderColor: 'rgba(248,113,113,0.55)',
  },
  badgeTxt: {
    color: '#E9D5FF',
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
    backgroundColor: 'rgba(140,92,245,0.18)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.35)',
  },
  logoFallbackTxt: {
    color: '#E9D5FF',
    fontSize: 12,
  },
  teamName: {
    color: '#FFFFFF',
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
    backgroundColor: 'rgba(140,92,245,0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(184,150,252,0.4)',
  },
  centerLive: {
    backgroundColor: 'rgba(239,68,68,0.16)',
    borderColor: 'rgba(248,113,113,0.5)',
  },
  centerTxt: {
    color: '#C2ABFC',
    fontSize: 14,
  },
  scoreTxt: {
    color: '#FFFFFF',
    fontSize: 18,
  },
  liveTxt: {
    color: '#FCA5A5',
    fontSize: 13,
  },
});
