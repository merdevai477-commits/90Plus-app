/**
 * Pre-kickoff / Information tab: fan 1-X-2 vote, stadium photo card and the
 * kickoff / capacity / broadcast / referee grid (Figma 1347:18834).
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { GOLD_PRIMARY, PURPLE_SOFT, TEXT_MUTED, TEXT_PRIMARY, TEXT_SECONDARY } from '../../constants/tokens';
import { MatchCrowdVote, type CrowdVoteTeam } from './MatchCrowdVote';
import type { MatchKickoffInfo } from '../../utils/extractMatchKickoffInfo';
import {
  fetchStadiumImageByName,
  isUnverifiedStadiumCdnUrl,
} from '../../utils/fetchStadiumImage';

/**
 * Kept in module scope so Fast Refresh does not crash with
 * `Property 'STADIUM_PLACEHOLDER' doesn't exist` after the Highlights hero
 * stopped using a real stadium photo as the miss fallback.
 * Branded logo only — never a venue photograph.
 */
const STADIUM_PLACEHOLDER = require('../../assets/images/splash/splash-logo.png');

const ICON = {
  time: require('../../assets/images/match-vote/time.svg'),
  capacity: require('../../assets/images/match-vote/capacity.svg'),
  whistle: require('../../assets/images/match-vote/whistle.svg'),
  location: require('../../assets/images/match-vote/location.svg'),
};

const ACCENT = '#BC7BFA';

type InfoItem = {
  key: string;
  label: string;
  value: string;
  icon: React.ReactNode;
};

type Props = {
  info: MatchKickoffInfo;
  kickoffTime?: string | null;
  rtl: boolean;
  autoUpdateTitle: string;
  autoUpdateHint: string;
  refereeLabel: string;
  staffLabel: string;
  stadiumLabel: string;
  capacityLabel: string;
  broadcastLabel: string;
  matchTimeLabel: string;
  emptyHint: string;
  crowd?: {
    homePercent: number;
    drawPercent: number;
    awayPercent: number;
    totalVotes?: number | null;
    home: CrowdVoteTeam;
    away: CrowdVoteTeam;
    title: string;
    subtitle: string;
    drawLabel: string;
    votesUnit: string;
  } | null;
  /** The "switches to Events" note only belongs on the pre-event Highlights tab. */
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
  return (
    <View style={[StyleSheet.absoluteFill, styles.heroPlaceholder]} accessibilityLabel="Stadium photo loading">
      <LinearGradient
        colors={['rgba(18,8,28,0.96)', 'rgba(28,15,46,0.92)', 'rgba(12,6,20,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <MaterialCommunityIcons name="stadium-outline" size={40} color={PURPLE_SOFT} />
    </View>
  );
}

function StadiumPhoto({ uri, stadiumName }: { uri: string | null; stadiumName: string | null }) {
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

  if (!remote) return <StadiumPlaceholder />;

  return (
    <ExpoImage
      source={{ uri: remote }}
      placeholder={STADIUM_PLACEHOLDER}
      style={StyleSheet.absoluteFill}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setRemote(null)}
    />
  );
}

function IconCircle({ children }: { children: React.ReactNode }) {
  return <View style={styles.iconCircle}>{children}</View>;
}

function InfoCell({ item, rtl, divided }: { item: InfoItem; rtl: boolean; divided: boolean }) {
  return (
    <View style={[styles.cell, rtl && styles.rowReverse, divided && styles.cellDivided]}>
      {item.icon}
      <View style={styles.cellText}>
        <Text style={[styles.cellLabel, { textAlign: rtl ? 'right' : 'left' }]} numberOfLines={1}>
          {item.label}
        </Text>
        <Text
          style={[styles.cellValue, { textAlign: rtl ? 'right' : 'left' }]}
          numberOfLines={2}
          adjustsFontSizeToFit
          minimumFontScale={0.65}
        >
          {item.value}
        </Text>
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
  refereeLabel,
  staffLabel,
  stadiumLabel,
  capacityLabel,
  broadcastLabel,
  matchTimeLabel,
  emptyHint,
  crowd = null,
  showAutoUpdate = true,
}: Props) {
  const items: InfoItem[] = [];
  const time = (kickoffTime ?? '').trim();
  if (time) {
    items.push({
      key: 'time',
      label: matchTimeLabel,
      value: time,
      icon: (
        <IconCircle>
          <ExpoImage source={ICON.time} style={styles.icon25} contentFit="contain" />
        </IconCircle>
      ),
    });
  }
  if (info.capacity) {
    items.push({
      key: 'capacity',
      label: capacityLabel,
      value: info.capacity.toLocaleString('en-US'),
      icon: <ExpoImage source={ICON.capacity} style={styles.iconCircleSize} contentFit="contain" />,
    });
  }
  if (info.broadcast) {
    items.push({
      key: 'broadcast',
      label: broadcastLabel,
      value: info.broadcast,
      icon: (
        <IconCircle>
          <Text style={styles.tvMark}>TV</Text>
        </IconCircle>
      ),
    });
  }
  if (info.referee) {
    items.push({
      key: 'referee',
      label: refereeLabel,
      value: info.referee,
      icon: (
        <IconCircle>
          <ExpoImage source={ICON.whistle} style={styles.icon22} contentFit="contain" />
        </IconCircle>
      ),
    });
  }
  if (info.staff) {
    items.push({
      key: 'staff',
      label: staffLabel,
      value: info.staff,
      icon: (
        <IconCircle>
          <Ionicons name="people" size={20} color={ACCENT} />
        </IconCircle>
      ),
    });
  }

  const gridRows: InfoItem[][] = [];
  for (let i = 0; i < items.length; i += 2) gridRows.push(items.slice(i, i + 2));

  const hasStadium = Boolean(info.stadiumName || info.stadiumImage);
  const hasCard = hasStadium || items.length > 0;

  return (
    <View style={styles.wrap}>
      {showAutoUpdate ? (
        <View style={styles.strip}>
          <LinearGradient
            colors={['rgba(124,58,237,0.42)', 'rgba(59,130,246,0.22)', 'rgba(91,33,182,0.18)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
          <View style={styles.stripDot} />
          <View style={styles.stripCopy}>
            <Text style={styles.stripTitle}>{autoUpdateTitle}</Text>
            <Text style={styles.stripHint}>{autoUpdateHint}</Text>
          </View>
        </View>
      ) : null}

      {crowd ? <MatchCrowdVote {...crowd} rtl={rtl} /> : null}

      {hasCard ? (
        <View style={styles.card}>
          {hasStadium ? (
            <View style={styles.hero}>
              <StadiumPhoto uri={info.stadiumImage} stadiumName={info.stadiumName} />
              <LinearGradient
                colors={['rgba(0,0,0,0.32)', '#000000']}
                locations={[0, 0.91]}
                start={{ x: 0.5, y: 0 }}
                end={{ x: 0.5, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              {info.stadiumName ? (
                <View style={styles.heroCopy}>
                  <Text style={styles.heroTag}>{stadiumLabel}</Text>
                  <Text style={styles.heroName} numberOfLines={2}>
                    {info.stadiumName}
                  </Text>
                  {info.city ? (
                    <View style={[styles.heroLocation, rtl && styles.rowReverse]}>
                      <ExpoImage source={ICON.location} style={styles.icon16} contentFit="contain" />
                      <Text style={styles.heroCity} numberOfLines={1}>
                        {info.city}
                      </Text>
                    </View>
                  ) : null}
                </View>
              ) : null}
            </View>
          ) : null}

          {gridRows.length > 0 ? (
            <View style={styles.grid}>
              {gridRows.map((row) => (
                <View key={row.map((item) => item.key).join('-')} style={styles.gridRow}>
                  <View style={styles.gridCol}>
                    <InfoCell item={row[0]} rtl={rtl} divided={false} />
                  </View>
                  <View style={styles.gridCol}>
                    {row[1] ? <InfoCell item={row[1]} rtl={rtl} divided /> : null}
                  </View>
                </View>
              ))}
            </View>
          ) : null}
        </View>
      ) : (
        <Text style={styles.empty}>{emptyHint}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 2,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 24,
  },
  rowReverse: {
    flexDirection: 'row-reverse',
  },
  strip: {
    minHeight: 58,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(167,139,250,0.35)',
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
    backgroundColor: GOLD_PRIMARY,
  },
  stripCopy: {
    flex: 1,
    gap: 2,
  },
  stripTitle: {
    color: TEXT_PRIMARY,
    fontSize: 13,
    fontWeight: '700',
  },
  stripHint: {
    color: TEXT_SECONDARY,
    fontSize: 12,
    lineHeight: 16,
  },
  card: {
    borderRadius: 24,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(72,72,72,0.29)',
    backgroundColor: '#080719',
  },
  hero: {
    height: 193,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#000000',
  },
  heroPlaceholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  heroCopy: {
    position: 'absolute',
    top: 56,
    left: 24,
    right: 24,
    alignItems: 'center',
    gap: 2,
  },
  heroTag: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroName: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
    textAlign: 'center',
  },
  heroLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
    maxWidth: '100%',
  },
  heroCity: {
    flexShrink: 1,
    color: '#9A9A9A',
    fontSize: 12,
    fontWeight: '500',
  },
  grid: {
    paddingHorizontal: 19,
    paddingVertical: 30,
    gap: 20,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 12,
  },
  gridCol: {
    flex: 1,
  },
  cell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minHeight: 58,
  },
  cellDivided: {
    borderLeftWidth: 1,
    borderLeftColor: 'rgba(168,85,247,0.38)',
    paddingLeft: 12,
  },
  cellText: {
    flex: 1,
    gap: 2,
  },
  cellLabel: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '600',
  },
  cellValue: {
    color: '#FFFFFF',
    fontSize: 19,
    fontWeight: '700',
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(168,85,247,0.19)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconCircleSize: {
    width: 44,
    height: 44,
  },
  icon25: {
    width: 25,
    height: 25,
  },
  icon22: {
    width: 22,
    height: 22,
  },
  icon16: {
    width: 16,
    height: 16,
  },
  tvMark: {
    color: ACCENT,
    fontSize: 16,
    fontWeight: '700',
  },
  empty: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
});
