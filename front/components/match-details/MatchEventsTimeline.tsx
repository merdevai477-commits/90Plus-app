import React from 'react';
import { View, StyleSheet } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Text } from './MatchText';
import { MatchEventIcon } from './MatchEventIcon';
import TeamBadge from '../common/TeamBadge';
import type { FixtureEvent } from '../../services/apiFootball';
import { getLocalizedEventLabel, getTeamDisplayName } from '../../utils/i18nHelpers';
import type { Language } from '../../src/i18n/types';

const SWAP_ICON = require('../../assets/images/match-events/swap.svg');

const DOT = 12;
const MINUTE_W = 40;
const MINUTE_GAP = 8;
const LINE_OFFSET = MINUTE_W + MINUTE_GAP + DOT / 2 - 0.5;

type Props = {
  events: FixtureEvent[];
  language: Language;
  goalForLabel: string;
  detailsUnavailableLabel: string;
};

function formatMinute(event: FixtureEvent): string {
  const isSynthetic = event._synthetic === true;
  if (isSynthetic && event._minuteKnown === false) return '—';
  const extra = event.time?.extra ? `+${event.time.extra}` : '';
  return `${event.time?.elapsed ?? 0}${extra}’`;
}

function EventGlyph({ event, language }: { event: FixtureEvent; language: Language }) {
  if (event.type === 'Goal') {
    return (
      <View style={styles.goalGlyph}>
        <TeamBadge
          name={getTeamDisplayName(event.team.name, language)}
          logo={event.team.logo}
          size={28}
          color="transparent"
        />
      </View>
    );
  }
  if (event.type === 'Card') {
    const isRed = /red/i.test(event.detail);
    return <View style={[styles.cardGlyph, isRed && styles.cardGlyphRed]} />;
  }
  if (event.type === 'subst') {
    return <ExpoImage source={SWAP_ICON} style={styles.swapGlyph} contentFit="contain" />;
  }
  return (
    <View style={styles.genericGlyph}>
      <MatchEventIcon type={event.type} detail={event.detail} size={22} />
    </View>
  );
}

export function MatchEventsTimeline({
  events,
  language,
  goalForLabel,
  detailsUnavailableLabel,
}: Props) {
  const rtl = language === 'ar';
  const rowDirection = rtl ? 'row' : 'row-reverse';
  const textAlign = rtl ? 'right' : 'left';
  const lastIndex = events.length - 1;

  return (
    <View style={styles.card}>
      <View style={styles.list}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(139,92,246,0)', '#2C253D', '#422F6E', '#513690']}
          locations={[0, 0.49, 0.79, 1]}
          style={[styles.line, rtl ? { right: LINE_OFFSET } : { left: LINE_OFFSET }]}
        />
        {events.map((event, index) => {
          const active = index === lastIndex;
          const teamName = getTeamDisplayName(event.team.name, language);
          const isSynthetic = event._synthetic === true;

          let title: string;
          let subtitle: string;
          if (isSynthetic) {
            title = goalForLabel.replace('{team}', teamName);
            subtitle = detailsUnavailableLabel;
          } else {
            title = `${getLocalizedEventLabel(event.type, event.detail, language)} - ${teamName}`;
            subtitle = event.type === 'subst'
              ? [event.player?.name, event.assist?.name].filter(Boolean).join(' x ')
              : String(event.player?.name ?? '');
          }

          return (
            <View
              key={`${event.time.elapsed}-${event.type}-${event.player?.id ?? index}`}
              style={[styles.row, { flexDirection: rowDirection }]}
            >
              <View
                style={[
                  styles.cluster,
                  { flexDirection: rowDirection },
                  !active && styles.dimmed,
                ]}
              >
                <View style={[styles.textCol, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
                  <Text
                    style={[styles.title, active && styles.titleActive, { textAlign }]}
                    numberOfLines={2}
                  >
                    {title}
                  </Text>
                  {!!subtitle && (
                    <Text
                      style={[styles.subtitle, active && styles.subtitleActive, { textAlign }]}
                      numberOfLines={2}
                    >
                      {subtitle}
                    </Text>
                  )}
                </View>
                <EventGlyph event={event} language={language} />
              </View>

              <View
                style={[
                  styles.timelineCell,
                  active && styles.timelineCellActive,
                  { flexDirection: rowDirection },
                ]}
              >
                {active ? (
                  <LinearGradient colors={['#8B5CF6', '#513690']} style={styles.dot} />
                ) : (
                  <View style={[styles.dot, styles.dotIdle]} />
                )}
                <Text
                  style={[
                    styles.minute,
                    active && styles.minuteActive,
                    { textAlign: rtl ? 'left' : 'right' },
                  ]}
                  numberOfLines={1}
                >
                  {formatMinute(event)}
                </Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#0B0518',
    borderRadius: 24,
    borderWidth: 0.5,
    borderColor: '#281359',
    paddingHorizontal: 24,
    paddingVertical: 12,
  },
  list: {
    position: 'relative',
  },
  line: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    width: 1,
  },
  row: {
    alignItems: 'flex-start',
    gap: 24,
    paddingVertical: 20,
  },
  cluster: {
    flex: 1,
    alignItems: 'flex-start',
    justifyContent: 'flex-end',
    gap: 12,
  },
  dimmed: {
    opacity: 0.5,
  },
  textCol: {
    flexShrink: 1,
    gap: 2,
  },
  title: {
    color: '#FFFFFF',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  titleActive: {
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
    color: '#999999',
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  subtitleActive: {
    fontSize: 15,
    lineHeight: 20,
  },
  goalGlyph: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardGlyph: {
    width: 20,
    height: 26,
    borderRadius: 3,
    backgroundColor: '#FDAC0C',
  },
  cardGlyphRed: {
    backgroundColor: '#EF4444',
  },
  swapGlyph: {
    width: 32,
    height: 32,
  },
  genericGlyph: {
    width: 28,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  timelineCell: {
    height: 16,
    alignItems: 'center',
    gap: MINUTE_GAP,
  },
  timelineCellActive: {
    height: 22,
  },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
  },
  dotIdle: {
    backgroundColor: '#1E0F40',
  },
  minute: {
    width: MINUTE_W,
    color: '#818181',
    fontSize: 12,
    fontWeight: '500',
  },
  minuteActive: {
    color: '#FFFFFF',
  },
});
