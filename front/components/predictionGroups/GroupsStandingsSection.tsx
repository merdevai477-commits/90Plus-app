/**
 * Standings tab — global groups leaderboard with العالم / الأسبوعي / الشهري filters.
 */

import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Platform, StyleSheet, Text, View, ViewStyle } from 'react-native';

import { AnimatedTabs } from './AnimatedTabs';
import type { RankedGroup } from './data';
import { GroupRankingRow } from './GroupRankingRow';
import { PurpleTrophyIcon } from './PurpleTrophyIcon';
import { PG, usePGFonts } from './theme';
import { useTranslation } from '../../src/i18n';

const PERIOD_TAB_KEYS = ['all', 'week', 'month'] as const;
type PeriodKey = (typeof PERIOD_TAB_KEYS)[number];

export function GroupsStandingsSection({
  isRTL,
  groups,
  onPeriodChange,
  myGroupId,
}: {
  isRTL: boolean;
  groups: RankedGroup[];
  onPeriodChange?: (period: PeriodKey) => void;
  myGroupId?: string;
}) {
  const { medium, extra } = usePGFonts();
  const { t } = useTranslation();
  const gs = t.predictionGroups.globalStandings;
  const periodTabs = useMemo(
    () => [
      { key: 'all' as const, label: gs.periodAll },
      { key: 'week' as const, label: gs.periodWeek },
      { key: 'month' as const, label: gs.periodMonth },
    ],
    [gs.periodAll, gs.periodMonth, gs.periodWeek],
  );
  const [period, setPeriod] = useState<PeriodKey>('all');
  const row: ViewStyle = { flexDirection: isRTL ? 'row-reverse' : 'row' };

  const handlePeriod = (key: string) => {
    const p = key as PeriodKey;
    setPeriod(p);
    onPeriodChange?.(p);
  };

  const list = useMemo(
    () => groups.map((g) => ({ ...g, isMine: g.isMine ?? g.id === myGroupId })),
    [groups, myGroupId],
  );

  const shellGlow = Platform.select({
    ios: {
      shadowColor: PG.primary,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 18,
    },
    android: { elevation: 5 },
    default: {},
  });

  return (
    <View style={[styles.wrap, shellGlow]}>
      <View style={styles.darkBase}>
        <LinearGradient
          colors={['rgba(4,3,8,0.99)', 'rgba(2,2,5,0.99)', 'rgba(8,5,14,0.98)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.5, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
        <LinearGradient
          colors={['rgba(124,58,237,0.08)', 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />

        <View style={styles.content}>
          <View style={[styles.cardHeader, row]}>
            <View style={[styles.titleBlock, row]}>
              <PurpleTrophyIcon size={38} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.title, { fontFamily: extra }]}>{gs.title}</Text>
                <Text style={[styles.subtitle, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
                  {gs.subtitle}
                </Text>
              </View>
            </View>
          </View>

          <AnimatedTabs
            tabs={periodTabs}
            activeKey={period}
            onChange={handlePeriod}
            isRTL={isRTL}
          />

          <View style={styles.list}>
            {list.length === 0 ? (
              <Text style={[styles.emptyText, { fontFamily: medium, textAlign: isRTL ? 'right' : 'left' }]}>
                {t.predictionGroups.screen.emptyStandings}
              </Text>
            ) : (
              list.map((group) => (
                <GroupRankingRow key={`${period}-${group.rank}-${group.name}`} group={group} isRTL={isRTL} />
              ))
            )}
          </View>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 8,
  },
  darkBase: {
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(124,58,237,0.18)',
  },
  content: {
    padding: 16,
    gap: 14,
  },
  cardHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  titleBlock: {
    alignItems: 'center',
    gap: 12,
    flex: 1,
  },
  title: {
    fontSize: 17,
    color: PG.text,
  },
  subtitle: {
    fontSize: 12,
    color: PG.textMuted,
    marginTop: 2,
  },
  list: {
    gap: 2,
    marginTop: 2,
  },
  emptyText: {
    fontSize: 13,
    color: PG.textMuted,
    textAlign: 'center',
    paddingVertical: 24,
    paddingHorizontal: 8,
    lineHeight: 20,
  },
});
