/**
 * Pre-kickoff / waiting Events tab: stadium, referee, TV, and an auto-update strip.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
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

type Row = {
  key: string;
  label: string;
  value: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
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
    rows.push({ key: 'referee', label: refereeLabel, value: info.referee, icon: 'flag-outline' });
  }
  if (info.staff) {
    rows.push({ key: 'staff', label: staffLabel, value: info.staff, icon: 'people-outline' });
  }
  if (stadiumValue) {
    rows.push({ key: 'stadium', label: stadiumLabel, value: stadiumValue, icon: 'business-outline' });
  }
  if (info.capacity) {
    rows.push({
      key: 'capacity',
      label: capacityLabel,
      value: formatCapacity(info.capacity),
      icon: 'people-circle-outline',
    });
  }
  if (info.broadcast) {
    rows.push({ key: 'broadcast', label: broadcastLabel, value: info.broadcast, icon: 'tv-outline' });
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

        {info.stadiumImage ? (
          <ExpoImage
            source={{ uri: info.stadiumImage }}
            style={styles.hero}
            contentFit="cover"
            cachePolicy="memory-disk"
          />
        ) : null}

        {rows.length === 0 ? (
          <Text style={styles.empty}>{emptyHint}</Text>
        ) : (
          rows.map((row, index) => (
            <View
              key={row.key}
              style={[styles.row, index < rows.length - 1 && styles.rowDivider]}
            >
              <View style={styles.iconWrap}>
                <Ionicons name={row.icon} size={16} color={PURPLE_SOFT} />
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
