import type { ReactNode } from 'react';
import { View, StyleSheet, Pressable, Platform } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { Text } from './MatchText';
import { MatchEventIcon } from './MatchEventIcon';
import type { FixtureEvent } from '../../services/apiFootball';
import { getLocalizedEventLabel } from '../../utils/i18nHelpers';
import { displayMatchTeamName } from '../../utils/maskedNationalTeam';
import { assignGoalClips, type GoalClipMedia } from '../../utils/assignGoalClips';
import { buildGoalClipPlaybackCandidates } from '../../utils/goalClipPlaybackCandidates';
import { isHomeSideEvent } from '../../utils/matchEventSide';
import type { Language } from '../../src/i18n/types';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

const SWAP_ICON = require('../../assets/images/match-events/swap.svg');
const SUB_IN_ICON = require('../../assets/images/match-events/sub-in.svg');
const SUB_OUT_ICON = require('../../assets/images/match-events/sub-out.svg');
const GOAL_BALL = require('../../assets/images/match-events/legend-goal.svg');
const OWN_GOAL_BALL = require('../../assets/images/match-events/legend-own-goal.svg');
const PENALTY_BALL = require('../../assets/images/match-events/legend-penalty.svg');
const MISSED_PENALTY_BALL = require('../../assets/images/match-events/legend-missed-penalty.svg');
const CORNER_ICON = require('../../assets/images/match-events/legend-corner.svg');
const VAR_ICON = require('../../assets/images/match-events/legend-var.svg');
const INJURY_SUB_ICON = require('../../assets/images/match-events/legend-injury-sub.svg');
const GOAL_PLAY = require('../../assets/images/match-events/goal-play.svg');
const HALFTIME_WHISTLE = require('../../assets/images/match-events/halftime-whistle.svg');

const GOAL_MINUTE = '#A20000';
const SPINE = '#6B7280';
const ICON = 16;
const CLIP_W = 163;
const CLIP_H = 92;

const LRM = '\u200E';
const isolate = (s: string) => `\u2068${s}\u2069`;

/** API elapsed stays ≤45 through first-half stoppage; 2H starts at 46. */
function isFirstHalfEvent(event: FixtureEvent): boolean {
  return (event.time?.elapsed ?? 0) <= 45;
}

function clipDurationLabel(clip: GoalClipMedia): string | null {
  const text = `${clip.title} ${clip.description ?? ''}`;
  const match = text.match(/\b(\d{1,2}):(\d{2})\b/);
  return match ? `${match[1]}:${match[2]}` : null;
}

type Props = {
  events: FixtureEvent[];
  language: Language;
  homeTeamId?: number | null;
  awayTeamId?: number | null;
  homeTeamName?: string | null;
  awayTeamName?: string | null;
  homeTeamLogo?: string | null;
  awayTeamLogo?: string | null;
  goalForLabel: string;
  detailsUnavailableLabel: string;
  /** Centered rest marker between 1H and 2H (e.g. استراحة / Half-time). */
  halfTimeLabel?: string;
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

function EventGlyph({ event }: { event: FixtureEvent }) {
  if (event.type === 'Goal') {
    const detail = event.detail || '';
    if (/missed/i.test(detail)) {
      return <ExpoImage source={MISSED_PENALTY_BALL} style={styles.icon16} contentFit="contain" />;
    }
    if (/own/i.test(detail)) {
      return <ExpoImage source={OWN_GOAL_BALL} style={styles.icon16} contentFit="contain" />;
    }
    if (/penalty/i.test(detail)) {
      return <ExpoImage source={PENALTY_BALL} style={styles.icon16} contentFit="contain" />;
    }
    return <ExpoImage source={GOAL_BALL} style={styles.icon16} contentFit="contain" />;
  }
  if (event.type === 'Card') {
    const isSecondYellow = /second/i.test(event.detail);
    const isRed = /red/i.test(event.detail);
    if (isSecondYellow) {
      return (
        <View style={styles.secondYellowWrap}>
          <View style={styles.secondYellowRed} />
          <View style={styles.secondYellowFront} />
        </View>
      );
    }
    return <View style={[styles.cardGlyph, isRed && styles.cardGlyphRed]} />;
  }
  if (event.type === 'subst') {
    const injured = /injur/i.test(event.detail || '') || /injur/i.test(event.comments || '');
    return (
      <ExpoImage
        source={injured ? INJURY_SUB_ICON : SWAP_ICON}
        style={styles.icon16}
        contentFit="contain"
      />
    );
  }
  if (event.type === 'Var') {
    return (
      <View style={styles.icon16}>
        <ExpoImage source={VAR_ICON} style={{ width: 12.3333, height: 11.6667 }} contentFit="contain" />
      </View>
    );
  }
  if (/corner/i.test(event.type) || /corner/i.test(event.detail || '')) {
    return <ExpoImage source={CORNER_ICON} style={styles.icon16} contentFit="contain" />;
  }
  return <MatchEventIcon type={event.type} detail={event.detail} size={ICON} />;
}

function PlayerLine({
  icon,
  name,
  towardCenter,
  color,
}: {
  icon: ReactNode;
  name: string;
  towardCenter: 'left' | 'right';
  color: string;
}) {
  // Icon sits next to the center line; name sits outward.
  const ordered =
    towardCenter === 'right' ? (
      <>
        {icon}
        <Text style={[styles.playerName, { color }]} numberOfLines={1}>
          {name}
        </Text>
      </>
    ) : (
      <>
        <Text style={[styles.playerName, { color }]} numberOfLines={1}>
          {name}
        </Text>
        {icon}
      </>
    );

  return <View style={styles.playerLine}>{ordered}</View>;
}

function EventBody({
  event,
  language,
  towardCenter,
  textColor,
  mutedColor,
  goalForLabel,
  detailsUnavailableLabel,
  clip,
  goalClipPlayLabel,
  onPlayClip,
  events,
  index,
  goalClips,
}: {
  event: FixtureEvent;
  language: Language;
  towardCenter: 'left' | 'right';
  textColor: string;
  mutedColor: string;
  goalForLabel: string;
  detailsUnavailableLabel: string;
  clip: GoalClipMedia | null;
  goalClipPlayLabel: string;
  onPlayClip?: (urls: string[]) => void;
  events: FixtureEvent[];
  index: number;
  goalClips: GoalClipMedia[];
}) {
  const isSynthetic = event._synthetic === true;
  const teamName = displayMatchTeamName(event.team.name, language, event.team.id, event.team.logo);
  const playerName = event.player?.name?.trim() ?? '';
  const outName = event.assist?.name?.trim() ?? '';
  const alignItems = towardCenter === 'right' ? 'flex-start' : 'flex-end';

  if (event.type === 'subst' && (playerName || outName)) {
    // Stacked in (green ↑) / out (red ↓) — matches Figma subst rows.
    return (
      <View style={[styles.eventCol, { alignItems }]}>
        {!!playerName && (
          <PlayerLine
            towardCenter={towardCenter}
            color={textColor}
            name={`${LRM}${isolate(playerName)}`}
            icon={<ExpoImage source={SUB_IN_ICON} style={styles.icon16} contentFit="contain" />}
          />
        )}
        {!!outName && (
          <PlayerLine
            towardCenter={towardCenter}
            color={textColor}
            name={`${LRM}${isolate(outName)}`}
            icon={<ExpoImage source={SUB_OUT_ICON} style={styles.icon16} contentFit="contain" />}
          />
        )}
      </View>
    );
  }

  let label: string;
  if (isSynthetic) {
    label = goalForLabel.replace('{team}', isolate(teamName));
  } else if (playerName) {
    label = isolate(playerName);
  } else {
    label = isolate(getLocalizedEventLabel(event.type, event.detail, language));
  }

  const playUrl = clip?.url || clip?.embedUrl || '';
  const durationLabel = clip ? clipDurationLabel(clip) : null;

  return (
    <View style={[styles.eventCol, { alignItems }]}>
      <PlayerLine
        towardCenter={towardCenter}
        color={textColor}
        name={`${LRM}${label}`}
        icon={<EventGlyph event={event} />}
      />
      {isSynthetic ? (
        <Text style={[styles.syntheticHint, { color: mutedColor, textAlign: towardCenter === 'right' ? 'left' : 'right' }]}>
          {detailsUnavailableLabel}
        </Text>
      ) : null}
      {clip ? (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={goalClipPlayLabel.replace('{player}', playerName || event.team.name)}
          onPress={() => {
            const candidates = buildGoalClipPlaybackCandidates(events, index, goalClips);
            const urls = candidates.length ? candidates : playUrl ? [playUrl] : [];
            if (urls.length) onPlayClip?.(urls);
          }}
          style={styles.clipMedia}
        >
          {clip.thumbnail ? (
            <ExpoImage source={{ uri: clip.thumbnail }} style={styles.clipImage} contentFit="cover" />
          ) : (
            <View style={[styles.clipImage, styles.clipFallback]} />
          )}
          <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.8)']} style={styles.clipShade} />
          <ExpoImage source={GOAL_PLAY} style={styles.clipPlay} contentFit="contain" />
          {durationLabel ? (
            <View style={styles.clipDuration}>
              <Text style={styles.clipDurationText}>{durationLabel}</Text>
            </View>
          ) : null}
        </Pressable>
      ) : null}
    </View>
  );
}

function HalfTimeBreak({
  label,
  isDark,
}: {
  label: string;
  isDark: boolean;
}) {
  return (
    <View style={styles.htRow} accessibilityRole="text" accessibilityLabel={label}>
      <View
        style={[
          styles.htPill,
          {
            backgroundColor: isDark ? 'rgba(188,123,250,0.14)' : 'rgba(106,43,217,0.08)',
            borderColor: isDark ? 'rgba(188,123,250,0.4)' : 'rgba(106,43,217,0.28)',
          },
        ]}
      >
        <ExpoImage source={HALFTIME_WHISTLE} style={styles.htIcon} contentFit="contain" />
        <Text style={[styles.htLabel, { color: isDark ? '#E9D5FF' : '#4B1FA3' }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </View>
  );
}

export function MatchEventsTimeline({
  events,
  language,
  homeTeamId,
  awayTeamId,
  homeTeamName,
  awayTeamName,
  homeTeamLogo,
  awayTeamLogo,
  goalForLabel,
  detailsUnavailableLabel,
  halfTimeLabel = 'Half-time',
  goalClips = [],
  goalClipPlayLabel = 'Play {player} goal',
  onPlayClip,
}: Props) {
  const { colors, isDark } = useMatchDetailsTheme();
  const clipsByEvent = assignGoalClips(events, goalClips);
  const homeTeam = { id: homeTeamId, name: homeTeamName, logo: homeTeamLogo };
  const awayTeam = { id: awayTeamId, name: awayTeamName, logo: awayTeamLogo };

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: isDark ? '#0B0518' : colors.cardBg,
          borderColor: isDark ? '#281359' : 'transparent',
          ...Platform.select({
            ios: {
              shadowColor: '#4B1FA3',
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.3,
              shadowRadius: 2,
            },
            android: { elevation: 3 },
            default: {},
          }),
        },
      ]}
    >
      <View style={styles.list}>
        {/* Figma Events list spine: muted gray axis down the center. */}
        <View pointerEvents="none" style={[styles.centerLine, { backgroundColor: isDark ? 'rgba(107,114,128,0.55)' : SPINE }]} />
        {events.map((event, index) => {
          const homeSide = isHomeSideEvent(event, homeTeam, awayTeam);
          // Scoreboard is away | home, so away events sit left and home sit right.
          const towardCenter: 'left' | 'right' = homeSide ? 'right' : 'left';
          const isGoal = event.type === 'Goal';
          const minuteColor = isGoal ? GOAL_MINUTE : colors.textMuted;
          // Latest-first list: insert rest marker when we cross from 2H down into 1H.
          const showHalfTime =
            index > 0 &&
            !isFirstHalfEvent(events[index - 1]) &&
            isFirstHalfEvent(event);

          return (
            <View key={`${event.time.elapsed}-${event.type}-${event.player?.id ?? index}-${index}`}>
              {showHalfTime ? <HalfTimeBreak label={halfTimeLabel} isDark={isDark} /> : null}
              <View style={styles.row}>
                <View style={[styles.side, styles.sideLeft]}>
                  {!homeSide ? (
                    <EventBody
                      event={event}
                      language={language}
                      towardCenter={towardCenter}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textMuted}
                      goalForLabel={goalForLabel}
                      detailsUnavailableLabel={detailsUnavailableLabel}
                      clip={clipsByEvent[index]}
                      goalClipPlayLabel={goalClipPlayLabel}
                      onPlayClip={onPlayClip}
                      events={events}
                      index={index}
                      goalClips={goalClips}
                    />
                  ) : null}
                </View>

                <Text style={[styles.minute, { color: minuteColor }]} numberOfLines={1}>
                  {formatMinute(event)}
                </Text>

                <View style={[styles.side, styles.sideRight]}>
                  {homeSide ? (
                    <EventBody
                      event={event}
                      language={language}
                      towardCenter={towardCenter}
                      textColor={colors.textPrimary}
                      mutedColor={colors.textMuted}
                      goalForLabel={goalForLabel}
                      detailsUnavailableLabel={detailsUnavailableLabel}
                      clip={clipsByEvent[index]}
                      goalClipPlayLabel={goalClipPlayLabel}
                      onPlayClip={onPlayClip}
                      events={events}
                      index={index}
                      goalClips={goalClips}
                    />
                  ) : null}
                </View>
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
    borderRadius: 24,
    borderWidth: 0.5,
    paddingHorizontal: 16,
    paddingVertical: 28,
  },
  list: {
    position: 'relative',
  },
  centerLine: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: '50%',
    width: 1.5,
    marginLeft: -0.75,
  },
  htRow: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    zIndex: 1,
  },
  htPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  htIcon: {
    width: 18,
    height: 18,
  },
  htLabel: {
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  secondYellowWrap: {
    width: 16,
    height: 16,
    position: 'relative',
  },
  secondYellowRed: {
    position: 'absolute',
    top: 0,
    left: 2,
    width: 10.233,
    height: 13.302,
    borderRadius: 2,
    backgroundColor: '#B60606',
    transform: [{ rotate: '20deg' }],
  },
  secondYellowFront: {
    position: 'absolute',
    top: 1.53,
    left: 0,
    width: 10.233,
    height: 13.302,
    borderRadius: 2,
    backgroundColor: '#FDAC0C',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingVertical: 14,
    gap: 12,
  },
  side: {
    flex: 1,
    minWidth: 0,
  },
  sideLeft: {
    alignItems: 'flex-end',
  },
  sideRight: {
    alignItems: 'flex-start',
  },
  minute: {
    width: 36,
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    lineHeight: 16,
    marginTop: 0,
  },
  eventCol: {
    gap: 5,
    maxWidth: '100%',
  },
  playerLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    maxWidth: '100%',
  },
  playerName: {
    fontSize: 12,
    fontWeight: '500',
    lineHeight: 16,
    flexShrink: 1,
  },
  syntheticHint: {
    fontSize: 10,
    fontWeight: '400',
    lineHeight: 14,
  },
  icon16: {
    width: ICON,
    height: ICON,
  },
  cardGlyph: {
    width: 14,
    height: 18.2,
    borderRadius: 2,
    backgroundColor: '#FDAC0C',
  },
  cardGlyphRed: {
    backgroundColor: '#EF4444',
  },
  clipMedia: {
    width: CLIP_W,
    height: CLIP_H,
    borderRadius: 8,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipImage: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 8,
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
  clipDuration: {
    position: 'absolute',
    top: 12,
    left: 9,
    minWidth: 32,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: '#0C0C0C',
    alignItems: 'center',
    justifyContent: 'center',
  },
  clipDurationText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '500',
    lineHeight: 12,
  },
});
