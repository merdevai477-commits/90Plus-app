/**
 * Premium match-performance analytics for the 365 player match report.
 * Data mapping lives in utils/playerMatchStatsMap — this file is presentation only.
 */

import React, { memo, useCallback, useMemo, useState } from 'react';
import {
  View,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Text } from '../match-details/MatchText';
import { SectionHeader } from './PlayerProfileView';
import { PP_ICON } from './assets';
import { ratingTone, type PPColors } from './theme';
import type { Language } from '../../src/i18n/types';
import {
  buildMatchStatsDashboard,
  type MatchStatItem,
  type MatchStatSectionId,
  type MatchStatsDashboardModel,
} from '../../utils/playerMatchStatsMap';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export type MatchStatsLabels = {
  matchStats: string;
  performanceOverview: string;
  keyStatistics: string;
  rating: string;
  goals: string;
  assists: string;
  minutes: string;
  sectionAttack: string;
  sectionPassing: string;
  sectionDribbling: string;
  sectionDefense: string;
  sectionPhysical: string;
  sectionGoalkeeper: string;
  sectionOther: string;
  eventsSection: string;
  empty: string;
};

type Props = {
  stats: unknown[] | null | undefined;
  position: string | null | undefined;
  language: Language;
  rtl: boolean;
  colors: PPColors;
  labels: MatchStatsLabels;
  fontBold: string;
  fontSemi: string;
  fontReg: string;
  loading?: boolean;
  events?: string[];
};

function sectionTitle(id: MatchStatSectionId, labels: MatchStatsLabels): string {
  switch (id) {
    case 'attack':
      return labels.sectionAttack;
    case 'passing':
      return labels.sectionPassing;
    case 'dribbling':
      return labels.sectionDribbling;
    case 'defense':
      return labels.sectionDefense;
    case 'physical':
      return labels.sectionPhysical;
    case 'goalkeeper':
      return labels.sectionGoalkeeper;
    default:
      return labels.sectionOther;
  }
}

const PlayerRatingBadge = memo(function PlayerRatingBadge({
  rating,
  label,
  fontBold,
  fontSemi,
}: {
  rating: number;
  label: string;
  fontBold: string;
  fontSemi: string;
}) {
  const tone = ratingTone(rating);
  return (
    <View style={[styles.ratingCard, { backgroundColor: tone }]}>
      <Text style={[styles.ratingValue, { fontFamily: fontBold }]} allowFontScaling={false}>
        {rating.toFixed(1)}
      </Text>
      <Text style={[styles.ratingLabel, { fontFamily: fontSemi }]} numberOfLines={1}>
        {label}
      </Text>
    </View>
  );
});

const OverviewStatCard = memo(function OverviewStatCard({
  value,
  label,
  colors,
  fontBold,
  fontReg,
  rtl,
}: {
  value: string;
  label: string;
  colors: PPColors;
  fontBold: string;
  fontReg: string;
  rtl: boolean;
}) {
  return (
    <View
      style={[
        styles.overviewCard,
        {
          backgroundColor: colors.card,
          borderColor: colors.border,
          alignItems: rtl ? 'flex-end' : 'flex-start',
        },
      ]}
    >
      <View style={[styles.overviewAccent, { backgroundColor: colors.primary }]} />
      <Text style={[styles.overviewValue, { fontFamily: fontBold, color: colors.ink }]} numberOfLines={1}>
        {value}
      </Text>
      <Text
        style={[
          styles.overviewLabel,
          { fontFamily: fontReg, color: colors.muted, textAlign: rtl ? 'right' : 'left' },
        ]}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
});

const PlayerStatisticItem = memo(function PlayerStatisticItem({
  item,
  colors,
  fontBold,
  fontReg,
  rtl,
  last,
}: {
  item: MatchStatItem;
  colors: PPColors;
  fontBold: string;
  fontReg: string;
  rtl: boolean;
  last: boolean;
}) {
  return (
    <View
      style={[
        styles.statRow,
        { flexDirection: rtl ? 'row-reverse' : 'row' },
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.divider },
      ]}
    >
      <Text
        style={[styles.statLabel, { fontFamily: fontReg, color: colors.soft, textAlign: rtl ? 'right' : 'left' }]}
        numberOfLines={2}
      >
        {item.label}
      </Text>
      <Text style={[styles.statValue, { fontFamily: fontBold, color: colors.ink }]} numberOfLines={1}>
        {item.display}
      </Text>
    </View>
  );
});

const PlayerStatisticsSection = memo(function PlayerStatisticsSection({
  title,
  items,
  colors,
  labelsFont,
  rtl,
  defaultOpen,
}: {
  title: string;
  items: MatchStatItem[];
  colors: PPColors;
  labelsFont: { bold: string; semi: string; reg: string };
  rtl: boolean;
  defaultOpen: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const toggle = useCallback(() => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setOpen((v) => !v);
  }, []);

  if (items.length === 0) return null;

  return (
    <View style={[styles.sectionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <TouchableOpacity
        onPress={toggle}
        activeOpacity={0.75}
        style={[styles.sectionHeader, { flexDirection: rtl ? 'row-reverse' : 'row' }]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <Text style={[styles.sectionTitle, { fontFamily: labelsFont.semi, color: colors.ink }]} numberOfLines={1}>
          {title}
        </Text>
        <View style={[styles.sectionMeta, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          <Text style={[styles.sectionCount, { fontFamily: labelsFont.reg, color: colors.muted }]}>
            {items.length}
          </Text>
          <Ionicons
            name={open ? 'chevron-up' : 'chevron-down'}
            size={18}
            color={colors.primary}
          />
        </View>
      </TouchableOpacity>
      {open ? (
        <View style={styles.sectionBody}>
          {items.map((item, idx) => (
            <PlayerStatisticItem
              key={item.key}
              item={item}
              colors={colors}
              fontBold={labelsFont.bold}
              fontReg={labelsFont.reg}
              rtl={rtl}
              last={idx === items.length - 1}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
});

function PlayerPerformanceOverview({
  model,
  labels,
  colors,
  fontBold,
  fontSemi,
  fontReg,
  rtl,
}: {
  model: MatchStatsDashboardModel;
  labels: MatchStatsLabels;
  colors: PPColors;
  fontBold: string;
  fontSemi: string;
  fontReg: string;
  rtl: boolean;
}) {
  const cards: Array<{ key: string; value: string; label: string }> = [];
  if (model.overview.minutes) {
    cards.push({
      key: 'minutes',
      value: model.overview.minutes.display,
      label: labels.minutes,
    });
  }
  if (model.overview.goals) {
    cards.push({ key: 'goals', value: model.overview.goals.display, label: labels.goals });
  }
  if (model.overview.assists) {
    cards.push({
      key: 'assists',
      value: model.overview.assists.display,
      label: labels.assists,
    });
  }

  if (model.rating == null && cards.length === 0) return null;

  return (
    <View style={styles.block}>
      <Text
        style={[
          styles.blockEyebrow,
          { fontFamily: fontSemi, color: colors.muted, textAlign: rtl ? 'right' : 'left' },
        ]}
      >
        {labels.performanceOverview}
      </Text>
      <View style={[styles.overviewRow, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {model.rating != null ? (
          <PlayerRatingBadge
            rating={model.rating}
            label={labels.rating}
            fontBold={fontBold}
            fontSemi={fontSemi}
          />
        ) : null}
        <View style={[styles.overviewGrid, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
          {cards.map((c) => (
            <OverviewStatCard
              key={c.key}
              value={c.value}
              label={c.label}
              colors={colors}
              fontBold={fontBold}
              fontReg={fontReg}
              rtl={rtl}
            />
          ))}
        </View>
      </View>
    </View>
  );
}

function PlayerKeyStatistics({
  items,
  labels,
  colors,
  fontBold,
  fontReg,
  rtl,
}: {
  items: MatchStatItem[];
  labels: MatchStatsLabels;
  colors: PPColors;
  fontBold: string;
  fontReg: string;
  rtl: boolean;
}) {
  if (items.length === 0) return null;
  return (
    <View style={styles.block}>
      <Text
        style={[
          styles.blockEyebrow,
          { fontFamily: fontBold, color: colors.ink, textAlign: rtl ? 'right' : 'left' },
        ]}
      >
        {labels.keyStatistics}
      </Text>
      <View style={[styles.keyGrid, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
        {items.map((item) => (
          <View
            key={item.key}
            style={[
              styles.keyCard,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                alignItems: rtl ? 'flex-end' : 'flex-start',
              },
            ]}
          >
            <Text style={[styles.keyValue, { fontFamily: fontBold, color: colors.primary }]} numberOfLines={1}>
              {item.display}
            </Text>
            <Text
              style={[
                styles.keyLabel,
                { fontFamily: fontReg, color: colors.muted, textAlign: rtl ? 'right' : 'left' },
              ]}
              numberOfLines={2}
            >
              {item.label}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export const MatchStatsDashboard = memo(function MatchStatsDashboard({
  stats,
  position,
  language,
  rtl,
  colors,
  labels,
  fontBold,
  fontSemi,
  fontReg,
  loading,
  events = [],
}: Props) {
  const model = useMemo(
    () => buildMatchStatsDashboard(stats, language, position),
    [stats, language, position],
  );

  const fonts = useMemo(
    () => ({ bold: fontBold, semi: fontSemi, reg: fontReg }),
    [fontBold, fontSemi, fontReg],
  );

  if (loading) {
    return (
      <View style={styles.block}>
        <SectionHeader icon={PP_ICON.seasonStats} title={labels.matchStats} rtl={rtl} colors={colors} />
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator size="small" color={colors.primary} />
        </View>
      </View>
    );
  }

  if (model.totalRaw === 0) {
    return (
      <View style={styles.block}>
        <SectionHeader icon={PP_ICON.seasonStats} title={labels.matchStats} rtl={rtl} colors={colors} />
        <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name="stats-chart-outline" size={28} color={colors.primary} />
          <Text style={[styles.emptyText, { fontFamily: fontReg, color: colors.soft }]}>{labels.empty}</Text>
        </View>
      </View>
    );
  }

  return (
    <View>
      <SectionHeader icon={PP_ICON.seasonStats} title={labels.matchStats} rtl={rtl} colors={colors} />
      <PlayerPerformanceOverview
        model={model}
        labels={labels}
        colors={colors}
        fontBold={fontBold}
        fontSemi={fontSemi}
        fontReg={fontReg}
        rtl={rtl}
      />
      <PlayerKeyStatistics
        items={model.keyStats}
        labels={labels}
        colors={colors}
        fontBold={fontBold}
        fontReg={fontReg}
        rtl={rtl}
      />
      {model.sections.map((section, idx) => (
        <PlayerStatisticsSection
          key={section.id}
          title={sectionTitle(section.id, labels)}
          items={section.items}
          colors={colors}
          labelsFont={fonts}
          rtl={rtl}
          defaultOpen={idx === 0}
        />
      ))}
      {model.uncategorized.length > 0 ? (
        <PlayerStatisticsSection
          title={labels.sectionOther}
          items={model.uncategorized}
          colors={colors}
          labelsFont={fonts}
          rtl={rtl}
          defaultOpen={false}
        />
      ) : null}
      {events.length > 0 ? (
        <>
          <SectionHeader icon={PP_ICON.time} title={labels.eventsSection} rtl={rtl} colors={colors} />
          <View style={[styles.eventsWrap, { flexDirection: rtl ? 'row-reverse' : 'row' }]}>
            {events.map((line, idx) => (
              <View
                key={`${line}-${idx}`}
                style={[
                  styles.eventChip,
                  { backgroundColor: colors.pale, borderColor: colors.border },
                ]}
              >
                <Text style={[styles.eventText, { fontFamily: fontSemi, color: colors.ink }]}>{line}</Text>
              </View>
            ))}
          </View>
        </>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  block: { marginBottom: 14 },
  blockEyebrow: { fontSize: 13, marginBottom: 10 },
  overviewRow: { gap: 10, alignItems: 'stretch' },
  overviewGrid: { flex: 1, flexWrap: 'wrap', gap: 8 },
  ratingCard: {
    width: 88,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ratingValue: { fontSize: 28, color: '#0b0518', lineHeight: 32 },
  ratingLabel: { fontSize: 11, color: 'rgba(11,5,24,0.72)', marginTop: 2 },
  overviewCard: {
    width: '47%',
    flexGrow: 1,
    minWidth: 96,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingTop: 14,
    paddingBottom: 12,
    overflow: 'hidden',
  },
  overviewAccent: { position: 'absolute', top: 0, left: 0, right: 0, height: 3 },
  overviewValue: { fontSize: 22 },
  overviewLabel: { fontSize: 12, marginTop: 4 },
  keyGrid: { flexWrap: 'wrap', gap: 8 },
  keyCard: {
    width: '48%',
    flexGrow: 1,
    borderRadius: 14,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
  keyValue: { fontSize: 20 },
  keyLabel: { fontSize: 12, marginTop: 4 },
  sectionCard: {
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
    overflow: 'hidden',
  },
  sectionHeader: {
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 13,
  },
  sectionTitle: { fontSize: 15, flex: 1 },
  sectionMeta: { alignItems: 'center', gap: 6 },
  sectionCount: { fontSize: 12 },
  sectionBody: { paddingHorizontal: 14, paddingBottom: 4 },
  statRow: {
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingVertical: 12,
  },
  statLabel: { flex: 1, fontSize: 14 },
  statValue: { fontSize: 15 },
  emptyCard: {
    borderRadius: 16,
    borderWidth: 1,
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 16,
    gap: 10,
  },
  emptyText: { fontSize: 14, textAlign: 'center' },
  eventsWrap: { flexWrap: 'wrap', gap: 8, marginBottom: 8 },
  eventChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
  },
  eventText: { fontSize: 12 },
});
