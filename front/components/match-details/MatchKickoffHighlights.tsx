/**
 * Pre-kickoff / waiting Events tab: stadium, referee, TV, and an auto-update strip.
 */
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image as ExpoImage } from 'expo-image';
import { GlassWrapper, glassProps } from '../../constants/ui';
import {
  BLUE_ELECTRIC,
  GLASS_BORDER_BOTTOM,
  GLASS_BORDER_SIDE,
  GLASS_BORDER_TOP,
  GOLD_PRIMARY,
  PURPLE_SOFT,
  TEXT_MUTED,
  TEXT_PRIMARY,
  TEXT_SECONDARY,
} from '../../constants/tokens';
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

type Row = {
  key: string;
  label: string;
  value: string;
  icon:
    | { set: 'ion'; name: React.ComponentProps<typeof Ionicons>['name'] }
    | { set: 'mci'; name: React.ComponentProps<typeof MaterialCommunityIcons>['name'] };
};

type Props = {
  info: MatchKickoffInfo;
  title: string;
  autoUpdateTitle: string;
  autoUpdateHint: string;
  refereeLabel: string;
  staffLabel: string;
  stadiumLabel: string;
  capacityLabel: string;
  broadcastLabel: string;
  emptyHint: string;
};

function formatCapacity(value: number): string {
  return value.toLocaleString();
}

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
    <View style={styles.hero} accessibilityLabel="Stadium photo loading">
      <LinearGradient
        colors={['rgba(18,8,28,0.96)', 'rgba(28,15,46,0.92)', 'rgba(12,6,20,0.96)']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.heroSkeletonMark} />
      <MaterialCommunityIcons name="stadium-outline" size={36} color={PURPLE_SOFT} />
    </View>
  );
}

function StadiumHero({ uri, stadiumName }: { uri: string | null; stadiumName: string | null }) {
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
      style={styles.hero}
      contentFit="cover"
      cachePolicy="memory-disk"
      onError={() => setRemote(null)}
    />
  );
}

function RowIcon({ icon }: { icon: Row['icon'] }) {
  if (icon.set === 'mci') {
    return <MaterialCommunityIcons name={icon.name} size={16} color={PURPLE_SOFT} />;
  }
  return <Ionicons name={icon.name} size={16} color={PURPLE_SOFT} />;
}

export function MatchKickoffHighlights({
  info,
  title,
  autoUpdateTitle,
  autoUpdateHint,
  refereeLabel,
  staffLabel,
  stadiumLabel,
  capacityLabel,
  broadcastLabel,
  emptyHint,
}: Props) {
  const stadiumValue = [info.stadiumName, info.city].filter(Boolean).join(' · ');
  const rows: Row[] = [];
  if (info.referee) {
    rows.push({
      key: 'referee',
      label: refereeLabel,
      value: info.referee,
      icon: { set: 'mci', name: 'whistle' },
    });
  }
  if (info.staff) {
    rows.push({
      key: 'staff',
      label: staffLabel,
      value: info.staff,
      icon: { set: 'ion', name: 'people-outline' },
    });
  }
  if (stadiumValue) {
    rows.push({
      key: 'stadium',
      label: stadiumLabel,
      value: stadiumValue,
      icon: { set: 'ion', name: 'business-outline' },
    });
  }
  if (info.capacity) {
    rows.push({
      key: 'capacity',
      label: capacityLabel,
      value: formatCapacity(info.capacity),
      icon: { set: 'ion', name: 'people-circle-outline' },
    });
  }
  if (info.broadcast) {
    rows.push({
      key: 'broadcast',
      label: broadcastLabel,
      value: info.broadcast,
      icon: { set: 'ion', name: 'tv-outline' },
    });
  }

  return (
    <View style={styles.wrap}>
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

      <View style={styles.cardOuter}>
        <GlassWrapper {...(glassProps.card as object)} style={StyleSheet.absoluteFill} />
        <LinearGradient
          colors={['rgba(124,58,237,0.16)', 'rgba(59,130,246,0.08)', 'rgba(10,6,18,0.20)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />

        <Text style={styles.title}>{title}</Text>

        <StadiumHero uri={info.stadiumImage} stadiumName={info.stadiumName} />

        {rows.length === 0 ? (
          <Text style={styles.empty}>{emptyHint}</Text>
        ) : (
          rows.map((row, index) => (
            <View
              key={row.key}
              style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
            >
              <View style={styles.iconWrap}>
                <RowIcon icon={row.icon} />
              </View>
              <View style={styles.rowText}>
                <Text style={styles.rowLabel}>{row.label}</Text>
                <Text style={styles.rowValue}>{row.value}</Text>
              </View>
            </View>
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 24,
    gap: 12,
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
  cardOuter: {
    borderRadius: 20,
    overflow: 'hidden',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: GLASS_BORDER_SIDE,
    borderTopColor: GLASS_BORDER_TOP,
    borderBottomColor: GLASS_BORDER_BOTTOM,
    padding: 16,
    gap: 12,
  },
  title: {
    color: TEXT_PRIMARY,
    fontSize: 18,
    fontWeight: '700',
  },
  hero: {
    width: '100%',
    height: 132,
    borderRadius: 14,
    backgroundColor: 'rgba(8,4,16,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  heroSkeletonMark: {
    position: 'absolute',
    width: '70%',
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(167,139,250,0.16)',
    top: 28,
  },
  empty: {
    color: TEXT_MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
  },
  rowDivider: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255,255,255,0.08)',
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(124,58,237,0.22)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(96,165,250,0.28)',
  },
  rowText: {
    flex: 1,
    gap: 2,
  },
  rowLabel: {
    color: BLUE_ELECTRIC,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  rowValue: {
    color: TEXT_PRIMARY,
    fontSize: 15,
    fontWeight: '600',
    lineHeight: 20,
  },
});
