/**
 * Information tab — Figma 1570:3201 points-system accordion.
 * Values match `computeCoachKingPoints` in the backend.
 */

import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons, MaterialCommunityIcons } from '@expo/vector-icons';

import { useResolvedAppScheme } from '../../hooks/useResolvedAppScheme';
import { useTranslation } from '../../src/i18n';
import { useAppFont } from '../../utils/fontSetup';
import { getCoachKingTheme } from './theme';

type RowKind =
  | 'assist'
  | 'cleanSheet'
  | 'appearance'
  | 'sixty'
  | 'goalFwd'
  | 'goalMid'
  | 'goalDef'
  | 'yellow'
  | 'red'
  | 'ownGoal';

type RowDef = {
  key: RowKind;
  points: string;
  positive: boolean;
  icon: 'shoe' | 'glove' | 'shirt' | 'time' | 'ball' | 'yellow' | 'red' | 'own';
};

const ROWS: RowDef[] = [
  { key: 'assist', points: '+3', positive: true, icon: 'shoe' },
  { key: 'cleanSheet', points: '+4', positive: true, icon: 'glove' },
  { key: 'appearance', points: '+1', positive: true, icon: 'shirt' },
  { key: 'sixty', points: '+1', positive: true, icon: 'time' },
  { key: 'goalFwd', points: '+4', positive: true, icon: 'ball' },
  { key: 'goalMid', points: '+5', positive: true, icon: 'ball' },
  { key: 'goalDef', points: '+6', positive: true, icon: 'ball' },
  { key: 'yellow', points: '- 1', positive: false, icon: 'yellow' },
  { key: 'red', points: '- 3', positive: false, icon: 'red' },
  { key: 'ownGoal', points: '- 2', positive: false, icon: 'own' },
];

function RowIcon({ kind, iconColor }: { kind: RowDef['icon']; iconColor: string }) {
  if (kind === 'yellow') {
    return <View style={[styles.cardPip, { backgroundColor: '#FFD400' }]} />;
  }
  if (kind === 'red') {
    return <View style={[styles.cardPip, { backgroundColor: '#FF244B' }]} />;
  }
  const color = kind === 'own' ? '#FF7181' : iconColor;
  if (kind === 'shoe') {
    return <MaterialCommunityIcons name="shoe-cleat" size={16} color={color} />;
  }
  if (kind === 'glove') {
    return <MaterialCommunityIcons name="hand-back-left-outline" size={16} color={color} />;
  }
  if (kind === 'shirt') {
    return <MaterialCommunityIcons name="tshirt-crew-outline" size={16} color={color} />;
  }
  if (kind === 'time') {
    return <Ionicons name="time-outline" size={16} color={color} />;
  }
  return <Ionicons name="football-outline" size={16} color={color} />;
}

export function CoachKingInfo({ bottomPad }: { bottomPad: number }) {
  const { t, language } = useTranslation();
  const copy = t.coachKingGame.info;
  const isAr = language === 'ar';
  const fontMed = useAppFont(500);
  const fontReg = useAppFont(400);
  const fontBold = useAppFont(700);
  const [open, setOpen] = useState(true);
  const { isDark } = useResolvedAppScheme();
  const theme = useMemo(() => getCoachKingTheme(isDark), [isDark]);

  return (
    <ScrollView
      contentContainerStyle={{ paddingBottom: bottomPad, paddingHorizontal: 16, paddingTop: 8 }}
      showsVerticalScrollIndicator={false}
      testID="ck-info"
    >
      <View style={[styles.panel, { backgroundColor: theme.infoPanelBg, borderColor: theme.infoPanelBorder }]}>
        <Pressable
          onPress={() => setOpen((v) => !v)}
          style={[styles.head, { flexDirection: isAr ? 'row' : 'row-reverse' }]}
          accessibilityRole="button"
          testID="ck-info-points-toggle"
        >
          <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={22} color={theme.ink} />
          <View style={[styles.headTextWrap, { flexDirection: isAr ? 'row' : 'row-reverse' }]}>
            <View style={{ flex: 1, alignItems: isAr ? 'flex-end' : 'flex-start' }}>
              <Text style={[styles.title, { fontFamily: fontMed, color: theme.infoTitle, textAlign: isAr ? 'right' : 'left' }]}>
                {copy.pointsTitle}
              </Text>
              <Text style={[styles.subtitle, { fontFamily: fontReg, color: theme.infoSubtitle, textAlign: isAr ? 'right' : 'left' }]}>
                {copy.pointsSubtitle}
              </Text>
            </View>
            <View style={styles.energy}>
              <Ionicons name="flash" size={20} color={theme.flash} />
            </View>
          </View>
        </Pressable>

        {open ? (
          <View style={styles.list}>
            {ROWS.map((item) => (
              <View
                key={item.key}
                style={[
                  styles.row,
                  { flexDirection: isAr ? 'row' : 'row-reverse', backgroundColor: theme.infoRowBg },
                ]}
              >
                <View style={styles.pointsCluster}>
                  <Text
                    style={[
                      styles.points,
                      { fontFamily: fontBold, color: item.positive ? '#4DE6B5' : '#FF7181' },
                    ]}
                  >
                    {item.points}
                  </Text>
                  <View style={[styles.iconBubble, { backgroundColor: theme.infoIconBg }]}>
                    <RowIcon kind={item.icon} iconColor={theme.infoIcon} />
                  </View>
                </View>
                <Text
                  style={[styles.rowLabel, { fontFamily: fontReg, color: theme.infoRowLabel, textAlign: isAr ? 'right' : 'left' }]}
                  numberOfLines={2}
                >
                  {copy.rows[item.key]}
                </Text>
              </View>
            ))}
          </View>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  panel: {
    borderWidth: 1,
    borderRadius: 24,
    paddingHorizontal: 16,
    paddingVertical: 22,
    rowGap: 18,
  },
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 10,
  },
  headTextWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
    columnGap: 8,
  },
  energy: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { fontSize: 16 },
  subtitle: { fontSize: 14, marginTop: 4 },
  list: { rowGap: 6 },
  row: {
    flexDirection: 'row',
    borderRadius: 12,
    minHeight: 40,
    paddingHorizontal: 11,
    paddingVertical: 8,
    alignItems: 'center',
    justifyContent: 'space-between',
    columnGap: 12,
  },
  pointsCluster: {
    flexDirection: 'row',
    alignItems: 'center',
    columnGap: 12,
  },
  points: { fontSize: 22, minWidth: 42, textAlign: 'center' },
  iconBubble: {
    width: 32,
    height: 32,
    borderRadius: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPip: {
    width: 14,
    height: 18,
    borderRadius: 2,
  },
  rowLabel: {
    flex: 1,
    fontSize: 13,
  },
});
