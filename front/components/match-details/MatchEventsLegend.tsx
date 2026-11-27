import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';
import { Image as ExpoImage } from 'expo-image';
import { Text } from './MatchText';
import { useMatchDetailsTheme } from '../../hooks/useMatchDetailsTheme';
import type { Language } from '../../src/i18n/types';
import { VarMonitorIcon } from './VarMonitorIcon';

const ICON_GOAL = require('../../assets/images/match-events/legend-goal.svg');
const ICON_OWN_GOAL = require('../../assets/images/match-events/legend-own-goal.svg');
const ICON_PENALTY = require('../../assets/images/match-events/legend-penalty.svg');
const ICON_MISSED_PENALTY = require('../../assets/images/match-events/legend-missed-penalty.svg');
const ICON_CORNER = require('../../assets/images/match-events/legend-corner.svg');
const ICON_ASSIST = require('../../assets/images/match-events/legend-assist.svg');
const ICON_SUB = require('../../assets/images/match-events/legend-sub.svg');
const ICON_INJURY_SUB = require('../../assets/images/match-events/legend-injury-sub.svg');

export type MatchEventsLegendLabels = {
  goal: string;
  ownGoal: string;
  substitution: string;
  injurySubstitution: string;
  penalty: string;
  corner: string;
  var: string;
  missedPenalty: string;
  secondYellow: string;
  assist: string;
};

type Props = {
  language: Language;
  labels: MatchEventsLegendLabels;
};

function SecondYellowIcon() {
  return (
    <View style={styles.secondYellowWrap}>
      <View style={styles.secondYellowRed} />
      <View style={styles.secondYellowFront} />
    </View>
  );
}

function LegendIcon({ source, width, height }: { source: number; width: number; height: number }) {
  return (
    <View style={styles.iconSlot}>
      <ExpoImage source={source} style={{ width, height }} contentFit="contain" />
    </View>
  );
}

function LegendRow({
  label,
  icon,
  rtl,
  color,
}: {
  label: string;
  icon: ReactNode;
  rtl: boolean;
  color: string;
}) {
  return (
    <View style={[styles.row, !rtl && styles.rowLtr]}>
      {rtl ? (
        <>
          <Text style={[styles.label, { color }]} numberOfLines={1}>
            {label}
          </Text>
          {icon}
        </>
      ) : (
        <>
          {icon}
          <Text style={[styles.label, { color }]} numberOfLines={1}>
            {label}
          </Text>
        </>
      )}
    </View>
  );
}

export function MatchEventsLegend({ language, labels }: Props) {
  const { colors } = useMatchDetailsTheme();
  const rtl = language === 'ar';
  const ink = colors.textPrimary;

  const colAlign = rtl ? 'flex-end' : 'flex-start';

  const outcomes = (
    <View style={[styles.col, { alignItems: colAlign }]}>
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.goal}
        icon={<LegendIcon source={ICON_GOAL} width={16} height={16} />}
      />
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.ownGoal}
        icon={<LegendIcon source={ICON_OWN_GOAL} width={16} height={16} />}
      />
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.substitution}
        icon={<LegendIcon source={ICON_SUB} width={16} height={16} />}
      />
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.injurySubstitution}
        icon={<LegendIcon source={ICON_INJURY_SUB} width={16} height={16} />}
      />
    </View>
  );

  const setPieces = (
    <View style={[styles.col, { alignItems: colAlign }]}>
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.penalty}
        icon={<LegendIcon source={ICON_PENALTY} width={16} height={16} />}
      />
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.corner}
        icon={<LegendIcon source={ICON_CORNER} width={16} height={16} />}
      />
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.var}
        icon={
          <View style={styles.iconSlot}>
            <VarMonitorIcon width={22} />
          </View>
        }
      />
    </View>
  );

  const extras = (
    <View style={[styles.col, { alignItems: colAlign }]}>
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.missedPenalty}
        icon={<LegendIcon source={ICON_MISSED_PENALTY} width={16} height={16} />}
      />
      <LegendRow rtl={rtl} color={ink} label={labels.secondYellow} icon={<SecondYellowIcon />} />
      <LegendRow
        rtl={rtl}
        color={ink}
        label={labels.assist}
        icon={<LegendIcon source={ICON_ASSIST} width={14.6456} height={10.9099} />}
      />
    </View>
  );

  // Figma: outcomes on the right; extras + set-pieces clustered on the left.
  return (
    <View style={styles.wrap}>
      <View style={styles.group}>
        {extras}
        {setPieces}
      </View>
      {outcomes}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginTop: 16,
    paddingVertical: 9,
    paddingHorizontal: 4,
    gap: 12,
  },
  group: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 28,
    flexShrink: 1,
  },
  col: {
    gap: 17,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  rowLtr: {
    flexDirection: 'row',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
    lineHeight: 16,
  },
  iconSlot: {
    width: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
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
});
