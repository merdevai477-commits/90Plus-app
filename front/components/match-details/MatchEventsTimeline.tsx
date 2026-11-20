import { View, StyleSheet, Pressable } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Text } from './MatchText';
import { MatchEventIcon } from './MatchEventIcon';
import TeamBadge from '../common/TeamBadge';
import type { FixtureEvent } from '../../services/apiFootball';
import { getLocalizedEventLabel } from '../../utils/i18nHelpers';
import { displayMatchTeamName, presentTeamLogo } from '../../utils/maskedNationalTeam';
import { assignGoalClips, type GoalClipMedia } from '../../utils/assignGoalClips';
import { buildGoalClipPlaybackCandidates } from '../../utils/goalClipPlaybackCandidates';
import type { Language } from '../../src/i18n/types';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

const SWAP_ICON = require('../../assets/images/match-events/swap.svg');
const GOAL_BALL = require('../../assets/images/match-events/goal-ball.svg');
const GOAL_PLAY = require('../../assets/images/match-events/goal-play.svg');

const DOT = 12;
const MINUTE_W = 40;
const MINUTE_GAP = 8;
const LINE_OFFSET = MINUTE_W + MINUTE_GAP + DOT / 2 - 0.5;

// Names and labels mix Arabic and Latin scripts; without explicit isolation the
// bidi algorithm reorders "label - team" and "in x out" unpredictably.
const LRM = '\u200E';
const RLM = '\u200F';
const isolate = (s: string) => `\u2068${s}\u2069`;

type Props = {
  events: FixtureEvent[];
  language: Language;
  goalForLabel: string;
  detailsUnavailableLabel: string;
  goalClips?: GoalClipMedia[];
  goalClipScorerLabel?: string;
  goalClipPlayLabel?: string;
  /** Ordered candidate URLs for the selected goal (same fixture / same event). */
  onPlayClip?: (urls: string[]) => void;
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
          name={displayMatchTeamName(event.team.name, language, event.team.id, event.team.logo)}
          logo={presentTeamLogo(event.team.name, event.team.logo, event.team.id)}
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
  goalClips = [],
  goalClipScorerLabel = 'سجل الهدف: {player}',
  goalClipPlayLabel = 'Play {player} goal',
  onPlayClip,
}: Props) {
  const { colors, isDark } = useMatchDetailsTheme();
  const rtl = language === 'ar';
  const rowDirection = rtl ? 'row' : 'row-reverse';
  const textAlign = rtl ? 'right' : 'left';
  const baseMark = rtl ? RLM : LRM;
  const lastIndex = events.length - 1;
  const clipsByEvent = assignGoalClips(events, goalClips);

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#0B0518' : colors.cardBg,
          borderColor: isDark ? '#281359' : colors.cardBorder,
        },
      ]}
    >
      <View style={styles.list}>
        <LinearGradient
          pointerEvents="none"
          colors={['rgba(139,92,246,0)', '#2C253D', '#422F6E', '#513690']}
          locations={[0, 0.49, 0.79, 1]}
          style={[styles.line, rtl ? { right: LINE_OFFSET } : { left: LINE_OFFSET }]}
        />
        {events.map((event, index) => {
          const active = index === lastIndex;
          const teamName = displayMatchTeamName(event.team.name, language, event.team.id, event.team.logo);
          const isSynthetic = event._synthetic === true;

          let title: string;
          let subtitle: string;
          if (isSynthetic) {
            title = goalForLabel.replace('{team}', isolate(teamName));
            subtitle = detailsUnavailableLabel;
          } else {
            title = `${isolate(getLocalizedEventLabel(event.type, event.detail, language))} - ${isolate(teamName)}`;
            subtitle = event.type === 'subst'
              ? [event.player?.name, event.assist?.name].filter(Boolean).map((n) => isolate(String(n))).join(' x ')
              : isolate(String(event.player?.name ?? ''));
          }
          title = `${baseMark}${title}`;
          subtitle = subtitle ? `${baseMark}${subtitle}` : '';
          const clip = clipsByEvent[index];
          const playUrl = clip?.url || clip?.embedUrl || '';
          const scorerName = event.player?.name?.trim() ?? '';
          const scorerLine = clip && scorerName
            ? `${baseMark}${goalClipScorerLabel.replace('{player}', isolate(scorerName))}`
            : '';

          return (
            <View
              key={`${event.time.elapsed}-${event.type}-${event.player?.id ?? index}`}
              style={[styles.row, { flexDirection: rowDirection }]}
            >
              <View
                style={[
                  clip ? styles.clipCard : styles.cluster,
                  { flexDirection: clip ? 'column' : rowDirection },
                  !clip && !active && styles.dimmed,
                  clip && {
                    backgroundColor: isDark ? '#241447' : '#F4EBFF',
                  },
                ]}
              >
                <View style={[clip ? styles.clipHeader : styles.cluster, { flexDirection: rowDirection }]}>
                  <View style={[styles.textCol, clip && styles.clipTextCol, { alignItems: rtl ? 'flex-end' : 'flex-start' }]}>
                    <Text
                      style={[
                        styles.title,
                        (active || !!clip) && styles.titleActive,
                        clip && styles.clipTitle,
                        { textAlign, color: colors.textPrimary },
                      ]}
                      numberOfLines={2}
                    >
                      {title}
                    </Text>
                    {!!subtitle && !clip && (
                      <Text
                        style={[
                          styles.subtitle,
                          active && styles.subtitleActive,
                          { textAlign, color: colors.textMuted },
                        ]}
                        numberOfLines={2}
                      >
                        {subtitle}
                      </Text>
                    )}
                  </View>
                  {clip && event.type === 'Goal' ? (
                    <ExpoImage source={GOAL_BALL} style={styles.goalBall} contentFit="contain" />
                  ) : (
                    <EventGlyph event={event} language={language} />
                  )}
                </View>
                {clip ? (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={goalClipPlayLabel.replace('{player}', scorerName || event.team.name)}
                    onPress={() => {
                      const candidates = buildGoalClipPlaybackCandidates(events, index, goalClips);
                      const urls = candidates.length ? candidates : playUrl ? [playUrl] : [];
                      if (urls.length) onPlayClip?.(urls);
                    }}
                    style={styles.clipMedia}
                  >
                    {clip.thumbnail ? (
                      <ExpoImage
                        source={{ uri: clip.thumbnail }}
                        style={styles.clipImage}
                        contentFit="cover"
                      />
                    ) : (
                      <View style={[styles.clipImage, styles.clipFallback]} />
                    )}
                    <LinearGradient
                      colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']}
                      style={styles.clipShade}
                    />
                    <ExpoImage source={GOAL_PLAY} style={styles.clipPlay} contentFit="contain" />
                  </Pressable>
                ) : null}
                {!!scorerLine && (
                  <Text style={[styles.clipScorer, { textAlign, color: colors.textMuted }]} numberOfLines={1}>
                    {scorerLine}
                  </Text>
                )}
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
                  <View
                    style={[
                      styles.dot,
                      styles.dotIdle,
                      !isDark && { backgroundColor: colors.primaryMuted },
                    ]}
                  />
                )}
                <Text
                  style={[
                    styles.minute,
                    { textAlign: rtl ? 'left' : 'right', color: colors.textMuted },
                    active && { color: colors.textPrimary },
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
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '500',
  },
  titleActive: {
    fontSize: 17,
    lineHeight: 22,
  },
  subtitle: {
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
    fontSize: 12,
    fontWeight: '500',
  },
  clipCard: {
    flex: 1,
    gap: 4,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 11,
  },
  clipHeader: {
    width: '100%',
    alignItems: 'center',
    gap: 8,
  },
  clipTextCol: {
    flex: 1,
  },
  clipTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '700',
  },
  goalBall: {
    width: 20,
    height: 20,
  },
  clipMedia: {
    height: 122,
    width: '100%',
    borderRadius: 13,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 13,
  },
  clipFallback: {
    backgroundColor: '#111111',
  },
  clipShade: {
    ...StyleSheet.absoluteFillObject,
  },
  clipPlay: {
    width: 26,
    height: 26,
  },
  clipScorer: {
    fontSize: 9,
    lineHeight: 12,
    fontWeight: '500',
  },
});
