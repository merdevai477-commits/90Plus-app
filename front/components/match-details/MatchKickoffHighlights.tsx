/**
 * Pre-kickoff / Information tab: fan vote + stadium + fact grid (Figma 1700:10690).
 */
import React, { useCallback, useEffect, useState } from 'react';
import { View, StyleSheet, Pressable, type ImageSourcePropType } from 'react-native';
import { Text } from './MatchText';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { PURPLE_SOFT } from '../../constants/tokens';
import { MatchCrowdVote, type MatchCrowdVoteData } from './MatchCrowdVote';
import ImageViewerModal from '../common/ImageViewerModal';
import type { MatchKickoffInfo } from '../../utils/extractMatchKickoffInfo';
import {
  fetchStadiumImageByName,
  isUnverifiedStadiumCdnUrl,
} from '../../utils/fetchStadiumImage';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';

const STADIUM_PLACEHOLDER = require('../../assets/images/splash/splash-logo-v3.png');

const ICON = {
  pin: require('../../assets/images/match-info/icon-pin.svg'),
  clock: require('../../assets/images/match-info/icon-clock.svg'),
  tv: require('../../assets/images/match-info/icon-tv.svg'),
  whistle: require('../../assets/images/match-info/icon-whistle.svg'),
  weather: require('../../assets/images/match-info/icon-weather.svg'),
  capacity: require('../../assets/images/match-vote/capacity.svg'),
};

const CARD_SHADOW = {
  shadowColor: '#4B1FA3',
  shadowOffset: { width: 0, height: 1 },
  shadowOpacity: 0.2,
  shadowRadius: 2,
  elevation: 2,
} as const;

type FactCard = {
  key: string;
  label: string;
  value: string;
  subtitle?: string | null;
  icon: ImageSourcePropType;
};

type Props = {
  info: MatchKickoffInfo;
  kickoffTime?: string | null;
  rtl: boolean;
  autoUpdateTitle: string;
  autoUpdateHint: string;
  sectionTitle: string;
  sectionHint: string;
  refereeLabel: string;
  staffLabel: string;
  stadiumLabel: string;
  capacityLabel: string;
  broadcastLabel: string;
  matchTimeLabel: string;
  weatherLabel: string;
  kickoffTimezoneHint: string;
  broadcastRegionHint: string;
  emptyHint: string;
  weatherValue?: string | null;
  weatherHint?: string | null;
  crowd?: MatchCrowdVoteData | null;
  showAutoUpdate?: boolean;
};

function isUsableRemotePhoto(url?: string | null): boolean {
  const value = (url ?? '').trim();
  if (!/^https?:\/\//i.test(value)) return false;
  if (/Football_pitch_pv/i.test(value)) return false;
  if (/stadium-placeholder\.svg/i.test(value)) return false;
  if (isUnverifiedStadiumCdnUrl(value)) return false;
  return true;
}

function StadiumPlaceholder() {
  const { colors, isDark } = useMatchDetailsTheme();
  return (
    <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} accessibilityLabel="Stadium photo loading">
      <LinearGradient
        colors={
          isDark
            ? ['rgba(18,8,28,0.96)', 'rgba(28,15,46,0.92)', 'rgba(12,6,20,0.96)']
            : ['#EDE6FA', '#F4F1FA', '#E8E0F5']
        }
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons name="stadium-outline" size={40} color={isDark ? PURPLE_SOFT : colors.primary} />
    </View>
  );
}

function useStadiumPhotoUri(uri: string | null, stadiumName: string | null) {
  const initial = isUsableRemotePhoto(uri) ? uri : null;
  const [remote, setRemote] = useState<string | null>(initial);

  useEffect(() => {
    setRemote(isUsableRemotePhoto(uri) ? uri : null);
  }, [uri]);

  useEffect(() => {
    const name = (stadiumName ?? '').trim();
    if (!name) return;
    if (isUsableRemotePhoto(uri)) return;

    let cancelled = false;
    void fetchStadiumImageByName(name)
      .then((next) => {
        if (cancelled || !next || !isUsableRemotePhoto(next)) return;
        setRemote((current) => (isUsableRemotePhoto(current) ? current : next));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [stadiumName, uri]);

  const onError = useCallback(() => setRemote(null), []);
  return { remote, onError };
}

function StadiumPhoto({ remote, onError }: { remote: string | null; onError: () => void }) {
  if (!remote) return <StadiumPlaceholder />;

  return (
    <ExpoImage
      source={{ uri: remote }}
      placeholder={STADIUM_PLACEHOLDER}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={onError}
    />
  );
}

function IconBox({ source, isDark }: { source: ImageSourcePropType; isDark: boolean }) {
  return (
    <LinearGradient
      colors={isDark ? ['rgba(168,85,247,0.22)', 'rgba(106,43,217,0.28)'] : ['#F2E6FF', '#E7D3FF']}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.iconBox}
    >
      <ExpoImage source={source} style={styles.icon18} contentFit="contain" />
    </LinearGradient>
  );
}

function FactTile({
  item,
  ink,
  muted,
  cardBg,
  isDark,
}: {
  item: FactCard;
  ink: string;
  muted: string;
  cardBg: string;
  isDark: boolean;
}) {
  return (
    <View style={[styles.factCard, CARD_SHADOW, { backgroundColor: cardBg }]}>
      <View style={styles.factHeader}>
        <Text style={[styles.factLabel, { color: muted }]} numberOfLines={1}>
          {item.label}
        </Text>
        <IconBox source={item.icon} isDark={isDark} />
      </View>
      <View style={styles.factBody}>
        <Text style={[styles.factValue, { color: ink }]} numberOfLines={2}>
          {item.value}
        </Text>
        {item.subtitle ? (
          <Text style={[styles.factSubtitle, { color: muted }]} numberOfLines={1}>
            {item.subtitle}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

export function MatchKickoffHighlights({
  info,
  kickoffTime,
  rtl,
  autoUpdateTitle,
  autoUpdateHint,
  sectionTitle,
  sectionHint,
  refereeLabel,
  staffLabel: _staffLabel,
  stadiumLabel,
  capacityLabel,
  broadcastLabel,
  matchTimeLabel,
  weatherLabel,
  kickoffTimezoneHint,
  broadcastRegionHint,
  emptyHint,
  weatherValue = null,
  weatherHint = null,
  crowd = null,
  showAutoUpdate = true,
}: Props) {
  void _staffLabel;

  const { colors, isDark } = useMatchDetailsTheme();
  const ink = isDark ? colors.textPrimary : '#24104E';
  const muted = isDark ? colors.textMuted : '#6B7280';
  const cardBg = isDark ? colors.elevatedBg : '#FFFFFF';
  const accent = isDark ? colors.primarySoft : '#6A2BD9';

  // LTR grid order matches Figma: [broadcast, kickoff] / [weather|capacity, referee]
  const facts: FactCard[] = [];
  if (info.broadcast) {
    facts.push({
      key: 'broadcast',
      label: broadcastLabel,
      value: info.broadcast,
      subtitle: broadcastRegionHint,
      icon: ICON.tv,
    });
  }
  const time = (kickoffTime ?? '').trim();
  if (time) {
    facts.push({
      key: 'time',
      label: matchTimeLabel,
      value: time,
      subtitle: kickoffTimezoneHint,
      icon: ICON.clock,
    });
  }
  const weather = (weatherValue ?? '').trim();
  if (weather) {
    facts.push({
      key: 'weather',
      label: weatherLabel,
      value: weather,
      subtitle: weatherHint,
      icon: ICON.weather,
    });
  } else if (info.capacity) {
    facts.push({
      key: 'capacity',
      label: capacityLabel,
      value: info.capacity.toLocaleString('en-US'),
      subtitle: info.attendance ? info.attendance.toLocaleString('en-US') : null,
      icon: ICON.capacity,
    });
  }
  if (info.referee) {
    facts.push({
      key: 'referee',
      label: refereeLabel,
      value: info.referee,
      subtitle: info.refereeCountry,
      icon: ICON.whistle,
    });
  }

  const hasStadium = Boolean(info.stadiumName || info.stadiumImage);
  const hasCard = hasStadium || facts.length > 0;
  const stadiumPhoto = useStadiumPhotoUri(info.stadiumImage, info.stadiumName);
  const [stadiumViewerOpen, setStadiumViewerOpen] = useState(false);

  return (
    <View style={styles.wrap}>
      {showAutoUpdate ? (
        <View
          style={[
            styles.strip,
            {
              borderColor: isDark ? 'rgba(167,139,250,0.35)' : colors.primaryBorder,
              backgroundColor: isDark ? 'transparent' : colors.primaryMuted,
            },
          ]}
        >
          {isDark ? (
            <LinearGradient
              colors={['rgba(124,58,237,0.42)', 'rgba(59,130,246,0.22)', 'rgba(91,33,182,0.18)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
          ) : null}
          <View style={[styles.stripDot, { backgroundColor: accent }]} />
          <View style={styles.stripCopy}>
            <Text style={[styles.stripTitle, { color: ink }]}>{autoUpdateTitle}</Text>
            <Text style={[styles.stripHint, { color: muted }]}>{autoUpdateHint}</Text>
          </View>
        </View>
      ) : null}

      {crowd ? <MatchCrowdVote {...crowd} rtl={rtl} /> : null}

      {hasCard ? (
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionHint, { color: accent }]} numberOfLines={1}>
              {sectionHint}
            </Text>
            <Text style={[styles.sectionTitle, { color: ink }]} numberOfLines={1}>
              {sectionTitle}
            </Text>
          </View>

          {hasStadium ? (
            <View style={[styles.venueCard, CARD_SHADOW, { backgroundColor: cardBg }]}>
              <Pressable
                style={styles.hero}
                disabled={!stadiumPhoto.remote}
                onPress={() => setStadiumViewerOpen(true)}
                accessibilityRole="imagebutton"
                accessibilityLabel={info.stadiumName ?? stadiumLabel}
              >
                <StadiumPhoto remote={stadiumPhoto.remote} onError={stadiumPhoto.onError} />
                <LinearGradient
                  colors={['#B26BFFBA', '#6A2BD9BA']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.venuePill}
                >
                  <Text style={styles.venuePillText}>{stadiumLabel}</Text>
                </LinearGradient>
              </Pressable>
              <View style={styles.venueBody}>
                {info.stadiumName ? (
                  <Text style={[styles.venueName, { color: ink }]} numberOfLines={2}>
                    {info.stadiumName}
                  </Text>
                ) : null}
                {info.city ? (
                  <View style={styles.venueLocation}>
                    <Text style={[styles.venueCity, { color: muted }]} numberOfLines={1}>
                      {info.city}
                    </Text>
                    <ExpoImage source={ICON.pin} style={styles.icon18} contentFit="contain" />
                  </View>
                ) : null}
              </View>
            </View>
          ) : null}

          {facts.length > 0 ? (
            <View style={styles.factGrid}>
              {facts.map((item) => (
                <FactTile
                  key={item.key}
                  item={item}
                  ink={ink}
                  muted={muted}
                  cardBg={cardBg}
                  isDark={isDark}
                />
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={[styles.empty, { color: muted }]}>{emptyHint}</Text>
      )}

      {stadiumPhoto.remote ? (
        <ImageViewerModal
          visible={stadiumViewerOpen}
          imageUrl={stadiumPhoto.remote}
          onClose={() => setStadiumViewerOpen(false)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 2,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 22,
  },
  strip: {
    minHeight: 58,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    gap: 10,
  },
  stripDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  stripCopy: {
    flex: 1,
    gap: 2,
  },
  stripTitle: {
    fontSize: 13,
    fontWeight: '700',
  },
  stripHint: {
    fontSize: 12,
    lineHeight: 16,
  },
  section: {
    width: '100%',
    gap: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    direction: 'ltr',
  },
  sectionHint: {
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'left',
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  venueCard: {
    width: '100%',
    borderRadius: 21,
    overflow: 'hidden',
  },
  hero: {
    height: 174,
    width: '100%',
    backgroundColor: '#000000',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  venuePill: {
    position: 'absolute',
    top: 13,
    right: 13,
    minWidth: 61,
    height: 25,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 12,
    shadowColor: '#4B1FA3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 10,
    elevation: 2,
  },
  venuePillText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '600',
    textAlign: 'center',
  },
  venueBody: {
    minHeight: 77,
    width: '100%',
    paddingHorizontal: 16,
    paddingVertical: 10,
    alignItems: 'flex-end',
    justifyContent: 'center',
    gap: 2,
  },
  venueName: {
    fontSize: 15,
    fontWeight: '700',
    lineHeight: 22,
    textAlign: 'right',
    writingDirection: 'rtl',
    width: '100%',
  },
  venueLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 8,
    width: '100%',
    direction: 'ltr',
  },
  venueCity: {
    flexShrink: 1,
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  factGrid: {
    width: '100%',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    rowGap: 12,
    columnGap: 13,
    direction: 'ltr',
  },
  factCard: {
    width: '47.5%',
    flexGrow: 1,
    flexBasis: '47%',
    minHeight: 88,
    borderRadius: 16,
    paddingLeft: 16,
    paddingRight: 16,
    paddingVertical: 9,
    gap: 8,
    justifyContent: 'center',
  },
  factHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: 6,
    width: '100%',
    direction: 'ltr',
  },
  factLabel: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon18: {
    width: 18,
    height: 18,
  },
  factBody: {
    width: '100%',
    gap: 3,
    alignItems: 'flex-end',
  },
  factValue: {
    fontSize: 14,
    fontWeight: '700',
    lineHeight: 20,
    textAlign: 'right',
    width: '100%',
  },
  factSubtitle: {
    fontSize: 10,
    lineHeight: 15,
    textAlign: 'right',
    width: '100%',
    writingDirection: 'rtl',
  },
  empty: {
    fontSize: 13,
    lineHeight: 18,
  },
});
